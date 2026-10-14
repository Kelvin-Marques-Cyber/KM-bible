// Lembrete diário de revisão na web (equivalente a lib/notifications.dart).
//
// Diferente do APK, o navegador não agenda notificações com o app fechado:
// o aviso só é possível enquanto o aplicativo (ou a PWA instalada) está aberto
// ou em execução. Aqui um temporizador verifica o horário escolhido; com a
// permissão concedida mostra uma notificação do sistema (pelo service worker,
// quando disponível) e, com o app visível, um aviso dentro do aplicativo.
import { message } from '../components/ui';
import { t, tr } from './i18n';
import { dateKey, DEFAULT_REMINDER_TIME, msUntilNextReminder, reminderAction } from './notes-memory';
import { cards, pref, setPref, subscribe } from './store';

export type ReminderPermission = NotificationPermission | 'unsupported';

export function notificationPermission(): ReminderPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

/** Pede permissão (aceita a forma antiga, por callback, do Safari). */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') return 'unsupported';
  try {
    return await new Promise<NotificationPermission>((resolve) => {
      const result = Notification.requestPermission((value) => resolve(value));
      if (result && typeof result.then === 'function') result.then(resolve, () => resolve(Notification.permission));
    });
  } catch {
    return notificationPermission();
  }
}

export const reminderEnabled = () => pref('reminder_enabled', false);
export const reminderTime = () => pref('reminder_time', DEFAULT_REMINDER_TIME);

const assetUrl = (path: string) => {
  try {
    return new URL(path, document.baseURI).href;
  } catch {
    return path;
  }
};

/** Mostra a notificação de revisão; prefere o service worker (obrigatório no Android). */
export async function showReminderNotification(due: number): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false;
  const title = t('review');
  const options: NotificationOptions = {
    body: `${t('pendingCards')}: ${due}`,
    tag: 'km-review',
    icon: assetUrl('icons/icon-192.png'),
    badge: assetUrl('icons/favicon-48.png'),
    data: { url: './?area=4' },
  };
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration && typeof registration.showNotification === 'function') {
      await registration.showNotification(title, options);
      return true;
    }
  } catch {
    /* sem service worker: tenta a API direta */
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

type BannerHandler = (due: number) => void;
const toastBanner: BannerHandler = (due) => message(`${tr('Hora da revisão', 'Time to review', 'Hora de repasar')} · ${t('pendingCards')}: ${due}`);
let bannerHandler: BannerHandler = toastBanner;
/** Define como mostrar o aviso dentro do app (toast); devolve a função para remover. */
export function onReminderBanner(handler: BannerHandler): () => void {
  bannerHandler = handler;
  return () => {
    if (bannerHandler === handler) bannerHandler = toastBanner;
  };
}

let checking = false;
/** Verifica o lembrete agora. `onTime` = disparado pelo temporizador no horário. */
export async function checkReminder(onTime = false, now = new Date()): Promise<'none' | 'notify' | 'banner'> {
  if (checking || !reminderEnabled()) return 'none';
  checking = true;
  try {
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    const base = { now, enabled: true, time: reminderTime(), lastShown: pref('reminder_last', ''), permission: notificationPermission(), visible, onTime };
    // Antes do horário ou já avisado hoje: nem consulta o banco.
    if (reminderAction({ ...base, due: 1 }) === 'none') return 'none';
    const due = (await cards(true)).length;
    let action = reminderAction({ ...base, due });
    if (action === 'notify' && !(await showReminderNotification(due))) action = visible ? 'banner' : 'none';
    if (action === 'notify' && visible) bannerHandler(due);
    if (action === 'banner') bannerHandler(due);
    if (action !== 'none') await setPref('reminder_last', dateKey(now), false);
    return action;
  } catch {
    return 'none';
  } finally {
    checking = false;
  }
}

let started = false;
let teardown: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let scheduledKey = '';
const MAX_WAIT = 30 * 60_000;

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!reminderEnabled()) return;
  const wait = msUntilNextReminder(new Date(), reminderTime());
  // Espera no máximo 30 min por vez: relógio ajustado ou aparelho que dormiu.
  timer = setTimeout(
    () => {
      timer = null;
      void checkReminder(wait <= MAX_WAIT).finally(schedule);
    },
    Math.min(wait, MAX_WAIT) + 250,
  );
}

/**
 * Inicia o lembrete enquanto o app estiver aberto (idempotente). Chamado pela
 * tela de memorização; idealmente também na abertura do app.
 */
export function startReminders(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const sync = () => {
    const key = `${reminderEnabled()}|${reminderTime()}`;
    if (key === scheduledKey) return;
    scheduledKey = key;
    schedule();
  };
  const unsubscribe = subscribe(sync);
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    schedule();
    void checkReminder(false);
  };
  document.addEventListener('visibilitychange', onVisible);
  teardown = () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisible);
  };
  sync();
  void checkReminder(false);
}

/** Apenas para testes. */
export function stopReminders(): void {
  teardown?.();
  teardown = null;
  if (timer) clearTimeout(timer);
  timer = null;
  started = false;
  scheduledKey = '';
}

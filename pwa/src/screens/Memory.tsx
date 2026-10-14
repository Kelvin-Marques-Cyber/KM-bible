// Memorização (lib/memory.dart): revisões pendentes, acompanhamento, lembrete
// diário (lib/notifications.dart adaptado à web), lista de cartões, revisão
// espaçada (SM-2) e criação de cartões a partir de uma passagem.
import { Bell, Brain, CircleCheck, Trash2 } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { app, closeSheet, fontSize, lineHeight } from '../lib/app';
import { fromId, refLabel, type Ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import { errorText } from '../lib/notes-logic';
import { CARD_MODES, GRADES, cardPrompt, dueCards, isAfterReminder, memoryStats, normalizeReminderTime, pickCards } from '../lib/notes-memory';
import {
  notificationPermission,
  reminderEnabled,
  reminderTime,
  requestReminderPermission,
  startReminders,
  type ReminderPermission,
} from '../lib/notes-reminders';
import { useAnchoredVirtualizer, VIRTUAL_THRESHOLD } from '../lib/notes-virtual';
import { addCard, cards as loadCards, deleteCard, reviewCard, reviewStats, setPref, storeRevision, subscribe, type Flashcard } from '../lib/store';
import { Button, Card, ErrorBox, Field, Heading, IconButton, Progress, Select, Small, Spinner, Toggle, message, useAsync } from '../components/ui';
import { openReview } from './open';

const useRevision = () => useSyncExternalStore(subscribe, storeRevision);

/** Rótulo "Livro c:v" de um id salvo; ids inválidos aparecem como estão. */
function referenceLabel(id: string): string {
  const r = fromId(id);
  return r ? refLabel(r, lang()) : id;
}

/** Relógio que avança a cada minuto (aviso do lembrete aparece no horário). */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// --------------------------------------------------------------- página
export default function MemoryPage() {
  const revision = useRevision();
  const now = useMinuteClock();
  const state = useAsync(async () => {
    const [all, history] = await Promise.all([loadCards(), reviewStats()]);
    return { all, history };
  }, [revision]);
  useEffect(() => startReminders(), []);

  const all = state.data?.all;
  const due = useMemo(() => dueCards(all ?? [], now.getTime()), [all, now]);
  const stats = useMemo(() => (state.data ? memoryStats(state.data.all, state.data.history) : null), [state.data]);
  const virtualize = (all?.length ?? 0) > VIRTUAL_THRESHOLD;
  const { scroller, anchor, virtual } = useAnchoredVirtualizer({ count: all?.length ?? 0, estimateSize: () => 104, enabled: virtualize });
  const items = virtual.getVirtualItems();

  return (
    <div ref={scroller} className="scroll-area h-full">
      <div className="mx-auto max-w-3xl p-5">
        {state.error ? (
          <ErrorBox error={state.error} onRetry={state.reload} />
        ) : !all || !stats ? (
          <Spinner />
        ) : (
          <>
            <Heading level={2} className="text-2xl font-normal">
              <span aria-live="polite">
                {t('pendingCards')}: {due.length}
              </span>
            </Heading>
            <Button className="mt-4" icon={Brain} disabled={due.length === 0} onClick={() => openReview(due.map((c) => c.id))}>
              {t('review')}
            </Button>
            <ReminderBanner due={due.length} now={now} />
            <Card className="mt-[18px]">
              <div className="p-[18px] text-[15.5px] leading-relaxed">
                <h3 className="font-medium">{t('stats')}</h3>
                <p>
                  {tr(`${stats.cards} cartões · ${stats.reviews} revisões`, `${stats.cards} cards · ${stats.reviews} reviews`, `${stats.cards} tarjetas · ${stats.reviews} repasos`)}
                </p>
                <p>
                  {tr(
                    `${stats.remembered}% lembrados · ${stats.consolidated} com intervalo ≥ 30 dias`,
                    `${stats.remembered}% recalled · ${stats.consolidated} with interval ≥ 30 days`,
                    `${stats.remembered}% recordadas · ${stats.consolidated} con intervalo ≥ 30 días`,
                  )}
                </p>
              </div>
            </Card>
            <ReminderSettings />
            <section className="mt-2" aria-label={tr('Cartões', 'Cards', 'Tarjetas')}>
              {all.length === 0 ? (
                <Small className="px-1 py-4">
                  {tr(
                    'Nenhum cartão ainda. No leitor, selecione versículos e toque em “Criar cartão”.',
                    'No cards yet. In the reader, select verses and tap “Create card”.',
                    'Aún no hay tarjetas. En el lector, seleccione versículos y toque “Crear tarjeta”.',
                  )}
                </Small>
              ) : virtualize ? (
                <div ref={anchor} className="relative" style={{ height: virtual.getTotalSize() }}>
                  {items.map((item) => (
                    <div
                      key={all[item.index].id}
                      data-index={item.index}
                      ref={virtual.measureElement}
                      className="absolute left-0 right-0 top-0"
                      style={{ transform: `translateY(${item.start - virtual.options.scrollMargin}px)` }}
                    >
                      <CardRow card={all[item.index]} />
                    </div>
                  ))}
                </div>
              ) : (
                all.map((c) => <CardRow key={c.id} card={c} />)
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

const CardRow = memo(function CardRow({ card }: { card: Flashcard }) {
  const [busy, setBusy] = useState(false);
  const label = referenceLabel(card.reference);
  return (
    <Card className="mb-2">
      <div className="flex items-start gap-1">
        <button type="button" onClick={() => openReview([card.id])} className="min-w-0 flex-1 rounded-2xl px-4 py-3 text-left transition hover:bg-on-surface/5">
          <span className="block text-[15.5px] leading-snug">
            {label} · {card.translation}
          </span>
          <span className="mt-0.5 block whitespace-pre-line text-sm text-muted" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {`${t(card.mode)} · ${card.topic}\n${card.text.length > 600 ? `${card.text.slice(0, 600)}…` : card.text}`}
          </span>
        </button>
        <IconButton
          className="mr-1 mt-1"
          label={`${t('delete')}: ${label}`}
          icon={Trash2}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await deleteCard(card.id);
            } catch (error) {
              message(`${t('error')}: ${errorText(error)}`);
              setBusy(false);
            }
          }}
        />
      </div>
    </Card>
  );
});

// ------------------------------------------------------------- lembrete
function ReminderBanner({ due, now }: { due: number; now: Date }) {
  if (!reminderEnabled() || due === 0 || !isAfterReminder(now, reminderTime())) return null;
  return (
    <div role="status" className="mt-4 flex items-start gap-3 rounded-2xl bg-secondary-container px-4 py-3">
      <Bell size={20} aria-hidden className="mt-0.5 shrink-0" />
      <p className="text-[15px]">
        {tr(
          `Hora da revisão de hoje (${reminderTime()}): ${due} ${due === 1 ? 'cartão pendente' : 'cartões pendentes'}.`,
          `Time for today's review (${reminderTime()}): ${due} ${due === 1 ? 'card due' : 'cards due'}.`,
          `Hora del repaso de hoy (${reminderTime()}): ${due} ${due === 1 ? 'tarjeta pendiente' : 'tarjetas pendientes'}.`,
        )}
      </p>
    </div>
  );
}

function permissionText(permission: ReminderPermission): string {
  switch (permission) {
    case 'granted':
      return tr('Notificações permitidas neste navegador.', 'Notifications allowed in this browser.', 'Notificaciones permitidas en este navegador.');
    case 'denied':
      return tr(
        'Notificações bloqueadas neste navegador: o lembrete aparece só dentro do aplicativo. Para permitir, altere as permissões do site nas configurações do navegador.',
        'Notifications are blocked in this browser: the reminder only appears inside the app. To allow them, change the site permissions in the browser settings.',
        'Notificaciones bloqueadas en este navegador: el recordatorio solo aparece dentro de la aplicación. Para permitirlas, cambie los permisos del sitio en la configuración del navegador.',
      );
    case 'unsupported':
      return tr(
        'Este navegador não oferece notificações: o lembrete aparece só dentro do aplicativo.',
        'This browser does not support notifications: the reminder only appears inside the app.',
        'Este navegador no admite notificaciones: el recordatorio solo aparece dentro de la aplicación.',
      );
    default:
      return tr('As notificações ainda não foram autorizadas.', 'Notifications have not been authorized yet.', 'Las notificaciones aún no se han autorizado.');
  }
}

function ReminderSettings() {
  const enabled = reminderEnabled();
  const time = reminderTime();
  const [permission, setPermission] = useState<ReminderPermission>(() => notificationPermission());
  const [busy, setBusy] = useState(false);

  const toggle = async (value: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (value) {
        const result = await requestReminderPermission();
        setPermission(result);
        if (result === 'denied' || result === 'default') {
          message(
            `${tr('Permissão de notificações não concedida.', 'Notification permission not granted.', 'Permiso de notificaciones no concedido.')} ${tr(
              'O lembrete aparecerá só dentro do aplicativo.',
              'The reminder will only appear inside the app.',
              'El recordatorio solo aparecerá dentro de la aplicación.',
            )}`,
          );
        } else if (result === 'unsupported') {
          message(permissionText('unsupported'));
        }
        await setPref('reminder_time', normalizeReminderTime(time));
      }
      await setPref('reminder_enabled', value);
      startReminders();
    } catch (error) {
      message(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-3 rounded-2xl px-1" aria-labelledby="memory-reminder">
      <h3 id="memory-reminder" className="sr-only">
        {t('reminder')}
      </h3>
      <Toggle
        label={t('reminder')}
        description={enabled ? `${t('hour')}: ${time}` : tr('Desativado', 'Disabled', 'Desactivado')}
        checked={enabled}
        onChange={(value) => void toggle(value)}
      />
      {enabled && (
        <Field
          type="time"
          label={t('hour')}
          className="max-w-[12rem]"
          value={time}
          required
          onChange={(e) => {
            if (e.target.value) void setPref('reminder_time', normalizeReminderTime(e.target.value));
          }}
        />
      )}
      <Small className="mt-2">
        {tr(
          'Na versão web, o navegador só mostra o lembrete enquanto o aplicativo (ou a PWA instalada) estiver aberto ou em execução. Com o app fechado não há aviso; ao abri-lo depois do horário escolhido, um aviso aparece se houver revisões pendentes. No iPhone, notificações exigem o app instalado na Tela de Início (iOS 16.4 ou posterior).',
          'In the web version the browser can only show the reminder while the app (or the installed PWA) is open or running. With the app closed there is no alert; when you open it after the chosen time, a notice appears if reviews are due. On iPhone, notifications require the app installed on the Home Screen (iOS 16.4 or later).',
          'En la versión web, el navegador solo muestra el recordatorio mientras la aplicación (o la PWA instalada) está abierta o en ejecución. Con la aplicación cerrada no hay aviso; al abrirla después de la hora elegida, aparece un aviso si hay repasos pendientes. En iPhone, las notificaciones requieren la aplicación instalada en la pantalla de inicio (iOS 16.4 o posterior).',
        )}
      </Small>
      {enabled && <Small className="mt-1">{permissionText(permission)}</Small>}
    </section>
  );
}

// ---------------------------------------------------------------- revisão
export function ReviewPage({ cardIds }: { cardIds: string[] | null }) {
  // Lista fixada na abertura: revisar muda "due" e não deve encolher a sessão.
  const key = cardIds ? cardIds.join('|') : '*';
  const state = useAsync(async () => {
    if (!cardIds) return loadCards(true);
    return pickCards(await loadCards(), cardIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (!state.data) return <Spinner />;
  return <ReviewSession key={key} cards={state.data} />;
}

function ReviewSession({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const promptRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const total = cards.length;

  useEffect(() => {
    if (index === 0 && !revealed) return;
    (revealed ? answerRef : promptRef).current?.focus();
  }, [index, revealed]);

  const grade = async (value: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await reviewCard(cards[index], value);
      setIndex((i) => i + 1);
      setRevealed(false);
      setAnswer('');
    } catch (error) {
      message(`${t('error')}: ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  };

  // Atalhos: 1–4 para as notas depois de revelar (fora de campos de texto).
  useEffect(() => {
    if (!revealed) return;
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable=true]')) return;
      const choice = GRADES[Number(event.key) - 1];
      if (choice) {
        event.preventDefault();
        void grade(choice[1]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (total === 0) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-muted">{t('empty')}</p>
      </div>
    );
  }
  if (index >= total) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 p-10 text-center" role="status">
        <CircleCheck size={44} aria-hidden className="text-primary" />
        <p className="text-[28px]">{t('success')}</p>
        <Button variant="tonal" onClick={closeSheet}>
          {t('close')}
        </Button>
      </div>
    );
  }

  const card = cards[index];
  const label = referenceLabel(card.reference);
  const prompt = cardPrompt(card, label, t('recitation'));
  const size = fontSize();
  return (
    <div className="mx-auto max-w-reading p-[26px]">
      <Progress value={index / total} />
      <p className="mt-6 text-[15px]" aria-live="polite">
        {index + 1} / {total} · {t(card.mode)}
      </p>
      <div
        ref={promptRef}
        tabIndex={-1}
        className="mt-6 select-text whitespace-pre-line font-reading outline-none"
        style={{ fontSize: size + 3, lineHeight: 1.5 }}
      >
        {prompt}
      </div>
      {!revealed ? (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            setRevealed(true);
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t('response')}</span>
            <textarea
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="max-h-[12.5em] min-h-[5.5em] w-full resize-y rounded-xl border border-outline bg-surface px-3 py-2.5 text-[16px] leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <Button type="submit" className="mt-5">
            {t('reveal')}
          </Button>
        </form>
      ) : (
        <>
          <div ref={answerRef} tabIndex={-1} className="mt-6 select-text font-reading outline-none" style={{ fontSize: size, lineHeight: lineHeight() }} aria-live="polite">
            <p>
              {label} · {card.translation}
            </p>
            <p className="mt-[1em] whitespace-pre-line">{card.text}</p>
            {card.topic && <p className="mt-[1em]">{card.topic}</p>}
          </div>
          {answer.trim() && (
            <div className="mt-5 rounded-xl bg-surface-low p-3 ring-1 ring-outline/30">
              <p className="text-sm text-muted">{t('response')}</p>
              <p className="whitespace-pre-line text-[15px]">{answer}</p>
            </div>
          )}
          <div role="group" className="mt-6 flex flex-wrap items-center gap-2.5" aria-label={tr('Avaliar lembrança', 'Rate recall', 'Evaluar recuerdo')}>
            {GRADES.map(([key, value], i) => (
              <Button key={key} variant="tonal" disabled={busy} onClick={() => void grade(value)} aria-keyshortcuts={String(i + 1)}>
                {t(key)}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------ criar cartão
export function CreateCard({ reference, text }: { reference: Ref; text: string }) {
  const [mode, setMode] = useState<string>(CARD_MODES[0]);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await addCard(app.translation, reference, text, mode, topic);
      closeSheet();
      message(t('success'));
    } catch (error) {
      message(`${t('error')}: ${errorText(error)}`);
      setBusy(false);
    }
  };

  return (
    <form
      className="mx-auto max-w-3xl p-[22px]"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Heading level={2} className="font-normal">
        {refLabel(reference, lang())}
      </Heading>
      <p className="mt-4 select-text whitespace-pre-line font-reading text-[17px] leading-relaxed">{text}</p>
      <Select
        className="mt-5"
        label={t('cardMode')}
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        options={CARD_MODES.map((value) => ({ value, label: t(value) }))}
      />
      <Field className="mt-4" label={t('topic')} value={topic} onChange={(e) => setTopic(e.target.value)} />
      <Button type="submit" className="mt-5" disabled={busy}>
        {t('save')}
      </Button>
    </form>
  );
}

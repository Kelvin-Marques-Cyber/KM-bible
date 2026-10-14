// Instalação, service worker e atualização automática.
//
// Fluxo de atualização:
// 1. O app consulta app-version.json (poucos bytes, sem cache) ao abrir, ao
//    voltar para a tela, ao reconectar e a cada 30 min.
// 2. Se houver build novo, pede ao service worker que se atualize; ele baixa
//    apenas o "app shell" (JS/CSS/ícones), nunca os dados pessoais.
// 3. Com a nova versão pronta: na abertura aplica na hora; durante o uso,
//    mostra um aviso e aplica sozinho quando o app vai para segundo plano.
// IndexedDB e localStorage nunca são apagados por uma atualização.
import { useSyncExternalStore } from 'react';
import { pref } from './store';

export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_ID: string = __BUILD_ID__;
export const BUILD_DATE: string = __BUILD_DATE__;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface RemoteVersion {
  version: string;
  build: string;
  date: string;
  notes?: string[];
}

interface PwaState {
  online: boolean;
  installAvailable: boolean;
  installed: boolean;
  standalone: boolean;
  updateReady: boolean;
  updating: boolean;
  remote: RemoteVersion | null;
  lastCheck: number | null;
  swSupported: boolean;
  swError: string | null;
}

let state: PwaState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  installAvailable: false,
  installed: false,
  standalone: false,
  updateReady: false,
  updating: false,
  remote: null,
  lastCheck: null,
  swSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  swError: null,
};
const listeners = new Set<() => void>();
function patch(next: Partial<PwaState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}
export function usePwa(): PwaState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
export const pwaState = () => state;

// ------------------------------------------------------------ boot seguro
const BOOT_KEY = 'km-boot';
/** Retorna true se as duas últimas aberturas falharam antes de desenhar a tela. */
export function bootStarted(): boolean {
  try {
    const previous = JSON.parse(localStorage.getItem(BOOT_KEY) ?? '{}') as { build?: string; pending?: number };
    const pending = previous.build === BUILD_ID ? (previous.pending ?? 0) + 1 : 1;
    localStorage.setItem(BOOT_KEY, JSON.stringify({ build: BUILD_ID, pending }));
    return pending >= 3;
  } catch {
    return false;
  }
}
export function bootFinished(): void {
  try {
    localStorage.setItem(BOOT_KEY, JSON.stringify({ build: BUILD_ID, pending: 0 }));
  } catch {
    /* sem localStorage */
  }
}

// ------------------------------------------------------------- instalação
let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export type Platform = 'ios' | 'android' | 'desktop';
export function platform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
export function browserName(): 'chrome' | 'edge' | 'samsung' | 'firefox' | 'safari' | 'opera' | 'other' {
  const ua = navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Edg\//.test(ua)) return 'edge';
  if (/OPR\//.test(ua)) return 'opera';
  if (/Firefox|FxiOS/.test(ua)) return 'firefox';
  if (/CriOS|Chrome/.test(ua)) return 'chrome';
  if (/Safari/.test(ua)) return 'safari';
  return 'other';
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null;
  patch({ installAvailable: false });
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') patch({ installed: true });
    return choice.outcome;
  } catch {
    return 'unavailable';
  }
}

// ----------------------------------------------------------- atualização
let registration: ServiceWorkerRegistration | null = null;
let reloading = false;
const beforeUpdate = new Set<() => void | Promise<void>>();

/** Telas com edição em andamento registram um "salvar agora" antes de recarregar. */
export function onBeforeUpdate(callback: () => void | Promise<void>): () => void {
  beforeUpdate.add(callback);
  return () => beforeUpdate.delete(callback);
}

async function flushEdits() {
  await Promise.allSettled([...beforeUpdate].map((cb) => cb()));
}

function watchWorker(worker: ServiceWorker | null) {
  if (!worker) return;
  const check = () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) patch({ updateReady: true, updating: false });
  };
  worker.addEventListener('statechange', check);
  check();
}

export async function applyUpdate(): Promise<void> {
  patch({ updating: true });
  await flushEdits();
  const waiting = registration?.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    // controllerchange recarrega a página; reserva caso o evento não venha.
    setTimeout(() => location.reload(), 4000);
  } else {
    location.reload();
  }
}

export async function checkForUpdate(manual = false): Promise<'update' | 'current' | 'offline'> {
  try {
    const url = new URL('app-version.json', document.baseURI);
    url.searchParams.set('t', String(Date.now()));
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    const remote = (await response.json()) as RemoteVersion;
    patch({ remote, lastCheck: Date.now() });
    if (remote.build && remote.build !== BUILD_ID) {
      if (registration) {
        await registration.update().catch(() => undefined);
        watchWorker(registration.installing ?? registration.waiting);
        if (registration.waiting) patch({ updateReady: true });
      } else {
        patch({ updateReady: true });
      }
      return 'update';
    }
    return 'current';
  } catch {
    if (manual) patch({ lastCheck: Date.now() });
    return 'offline';
  }
}

async function register() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;
  try {
    registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    if (registration.waiting && navigator.serviceWorker.controller) {
      // Versão nova já baixada em visita anterior: aplica antes do uso.
      if (pref('auto_update', true)) {
        await applyUpdate();
        return;
      }
      patch({ updateReady: true });
    }
    registration.addEventListener('updatefound', () => watchWorker(registration!.installing));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  } catch (error) {
    patch({ swError: String((error as Error)?.message ?? error) });
  }
}

export function startPwa(): void {
  patch({ standalone: isStandalone(), installed: isStandalone() });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    patch({ installAvailable: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    patch({ installAvailable: false, installed: true });
  });
  window.addEventListener('online', () => {
    patch({ online: true });
    void checkForUpdate();
  });
  window.addEventListener('offline', () => patch({ online: false }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!state.lastCheck || Date.now() - state.lastCheck > 5 * 60_000) void checkForUpdate();
    } else if (state.updateReady && pref('auto_update', true)) {
      // Em segundo plano: salva o que estiver aberto e aplica a nova versão.
      void applyUpdate();
    } else {
      void flushEdits();
    }
  });
  const later = (fn: () => void) =>
    'requestIdleCallback' in window ? (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(fn) : setTimeout(fn, 1500);
  later(() => {
    void register().then(() => checkForUpdate());
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  }, 30 * 60_000);
}

// --------------------------------------------------------- armazenamento
export interface StorageInfo {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}
export async function storageInfo(): Promise<StorageInfo> {
  const result: StorageInfo = { usage: null, quota: null, persisted: null };
  try {
    const estimate = await navigator.storage?.estimate?.();
    result.usage = estimate?.usage ?? null;
    result.quota = estimate?.quota ?? null;
  } catch {
    /* não suportado */
  }
  try {
    result.persisted = (await navigator.storage?.persisted?.()) ?? null;
  } catch {
    /* não suportado */
  }
  return result;
}

/** Pede ao navegador para não apagar os dados quando o espaço acabar. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export const formatBytes = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

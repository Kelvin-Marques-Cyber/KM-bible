// Estado global equivalente ao AppController de lib/app.dart.
import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { availableBooks, chapterCount, firstRefOfBook, hasVerse, installed, modules } from './content';
import { fromId, ref, refId, refLabel, type Ref } from './domain';
import { lang } from './i18n';
import { emit, pref, recordReading, savePlace, setPref, storeRevision, subscribe } from './store';

export const app = {
  translation: 'BLN4',
  passage: ref(43, 3, 16) as Ref,
  area: 0,
  revision: 0,
  activeTab: null as string | null,
};

export function initApp(): void {
  // Como no app Flutter: a ARA pré-instalada é a primeira opção de quem ainda
  // não escolheu tradução; nunca substitui a escolha de quem já usa o app.
  let translation = pref('translation', installed('ARA') ? 'ARA' : 'BLN4');
  if (!installed(translation)) translation = modules('bible', true)[0]?.id ?? 'BLN4';
  app.translation = translation;
  let passage = fromId(pref('last_reference', '43:3:16')) ?? ref(43, 3, 16);
  if (!hasVerse(translation, passage)) passage = firstRefOfBook(translation);
  app.passage = passage;
  const area = Number(new URLSearchParams(location.hash.replace(/^#\/?/, '').split('?')[1] ?? '').get('area'));
  if (area >= 0 && area <= 4) app.area = area;
}

export function useApp(): typeof app {
  useSyncExternalStore(subscribe, storeRevision);
  return app;
}

export const isStudy = () => pref('study', false);
export const isFullscreen = () => pref('fullscreen', false);
export const fontSize = () => Math.min(48, Math.max(14, pref('font_size', 23)));
export const lineHeight = () => Math.min(2.5, Math.max(1.1, pref('line_height', 1.6)));
export const margins = () => Math.min(64, Math.max(8, pref('margins', 22)));

export function set(key: string, value: unknown): void {
  void setPref(key, value);
}

export function refresh(): void {
  app.revision++;
  emit();
}

export function navigate(r: Ref, options: { edition?: string; history?: boolean } = {}): boolean {
  const edition = options.edition ?? app.translation;
  if (!hasVerse(edition, r)) return false;
  app.translation = edition;
  app.passage = r;
  app.area = 0;
  app.revision++;
  if (options.history !== false) void recordReading(edition, r);
  if (app.activeTab) void savePlace('study_tabs', refId(r), edition, refLabel(r, lang()), app.activeTab);
  closeAllSheets();
  emit();
  return true;
}

/** Atualiza a posição de leitura sem recarregar o capítulo (rolagem). */
export function rememberPosition(r: Ref): void {
  if (refId(app.passage) === refId(r)) return;
  app.passage = r;
  void setPref('last_reference', refId(r), false);
}

export function changeArea(area: number): void {
  app.area = area;
  closeAllSheets();
  emit();
}

export function step(direction: number): void {
  let b = app.passage.book;
  let c = app.passage.chapter + direction;
  const books = availableBooks(app.translation);
  if (c < 1) {
    const index = books.indexOf(b);
    if (index <= 0) return;
    b = books[index - 1];
    c = chapterCount(app.translation, b);
  } else if (c > chapterCount(app.translation, b)) {
    const index = books.indexOf(b);
    if (index + 1 >= books.length) return;
    b = books[index + 1];
    c = 1;
  }
  navigate(ref(b, c, 1));
}

// ------------------------------------------------------------ folhas (sheets)
export interface Sheet {
  id: number;
  title: string;
  render: () => ReactNode;
  full?: boolean;
}
let sheetId = 0;
export const sheets: Sheet[] = [];
let ignoreNextPop = 0;

export function openSheet(title: string, render: () => ReactNode, options: { full?: boolean } = {}): void {
  sheets.push({ id: ++sheetId, title, render, full: options.full });
  try {
    history.pushState({ kmSheet: sheetId }, '');
  } catch {
    /* navegação restrita */
  }
  emit();
}

export function closeSheet(): void {
  if (sheets.length === 0) return;
  sheets.pop();
  if ((history.state as { kmSheet?: number } | null)?.kmSheet) {
    ignoreNextPop++;
    history.back();
  }
  emit();
}

export function closeAllSheets(): void {
  if (sheets.length === 0) return;
  const count = sheets.length;
  sheets.length = 0;
  if ((history.state as { kmSheet?: number } | null)?.kmSheet) {
    ignoreNextPop++;
    history.go(-count);
  }
}

/** Botão "voltar" do Android/navegador fecha a folha aberta, como no app nativo. */
export function installBackHandler(): void {
  window.addEventListener('popstate', () => {
    if (ignoreNextPop > 0) {
      ignoreNextPop--;
      return;
    }
    if (sheets.length > 0) {
      sheets.pop();
      emit();
    } else if (isFullscreen()) {
      set('fullscreen', false);
    }
  });
}

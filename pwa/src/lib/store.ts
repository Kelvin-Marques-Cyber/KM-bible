// Dados pessoais (equivalente ao personal.sqlite do aplicativo original).
// Tabelas e colunas têm os MESMOS nomes, para que backups sejam trocados
// livremente entre o APK, o Flutter Web e esta PWA.
import { del, get, getAll, openDb, put, requestValue, write } from './db';
import { fromId, refId, review as schedule, type Ref, uuid } from './domain';
import { wikiTargets } from './scripture';

export interface Note {
  id: string;
  title: string;
  body: string;
  reference: string;
  notebook: string;
  tags: string;
  updated_at: number;
}
export interface Place {
  id: string;
  reference: string;
  translation: string;
  title: string;
}
export interface HistoryRow {
  id?: number;
  reference: string;
  translation: string;
  created_at: number;
}
export interface Flashcard {
  id: string;
  reference: string;
  translation: string;
  text: string;
  topic: string;
  mode: string;
  repetitions: number;
  interval: number;
  ease: number;
  due: number;
}
export interface Attachment {
  id: string;
  note_id: string;
  filename: string;
  path: string;
  sha256: string;
  mime?: string;
  blob?: Blob;
}
export interface Highlight {
  translation: string;
  reference: string;
  color: number;
  book?: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let revision = 0;
export const storeRevision = () => revision;
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function emit(): void {
  revision++;
  for (const l of [...listeners]) l();
}

// ---------------------------------------------------------------- preferências
const prefs = new Map<string, unknown>();
let prefsLoaded = false;

/** Preferências que também ficam em localStorage para a primeira pintura. */
const BOOT_KEYS = ['theme', 'contrast', 'language', 'font_size', 'line_height', 'margins', 'font_family', 'reduced_motion'];

export async function loadPrefs(): Promise<void> {
  const rows = await getAll<{ key: string; value: unknown }>('prefs');
  prefs.clear();
  for (const row of rows) prefs.set(row.key, row.value);
  prefsLoaded = true;
}
export const prefsReady = () => prefsLoaded;

export function pref<T>(key: string, fallback: T): T {
  if (!prefs.has(key)) return fallback;
  const value = prefs.get(key);
  if (typeof fallback === 'number' && typeof value === 'number') return value as T;
  if (fallback === null || fallback === undefined) return value as T;
  return typeof value === typeof fallback ? (value as T) : fallback;
}

export function allPrefs(): Record<string, unknown> {
  return Object.fromEntries(prefs);
}

export async function setPref(key: string, value: unknown, notify = true): Promise<void> {
  prefs.set(key, value);
  if (BOOT_KEYS.includes(key)) {
    try {
      localStorage.setItem(`km-pref:${key}`, JSON.stringify(value));
    } catch {
      /* modo privado */
    }
  }
  if (notify) emit();
  await put('prefs', { key, value });
}

// --------------------------------------------------------------- leitura
export async function recordReading(translation: string, reference: Ref): Promise<void> {
  const id = refId(reference);
  void setPref('last_reference', id, false);
  void setPref('translation', translation, false);
  const db = await openDb();
  const tx = db.transaction('reading_history', 'readonly');
  const cursor = await requestValue(tx.objectStore('reading_history').openCursor(null, 'prev'));
  const last = cursor?.value as HistoryRow | undefined;
  if (last && last.reference === id && last.translation === translation) return;
  await write(['reading_history'], async (wtx) => {
    const store = wtx.objectStore('reading_history');
    store.add({ reference: id, translation, created_at: Date.now() });
    const keys = (await requestValue(store.getAllKeys())) as number[];
    if (keys.length > 100) {
      keys.sort((a, b) => a - b);
      for (const key of keys.slice(0, keys.length - 100)) store.delete(key);
    }
  });
}

// --------------------------------------------------------------------- notas
let notesCache: Note[] | null = null;

export async function notes(): Promise<Note[]> {
  if (!notesCache) {
    notesCache = (await getAll<Note>('notes')).sort((a, b) => b.updated_at - a.updated_at);
  }
  return notesCache;
}
export const note = (id: string) => get<Note>('notes', id);

export async function saveNote(input: {
  id?: string;
  title: string;
  body: string;
  reference?: string;
  notebook?: string;
  tags?: string;
}, notify = true): Promise<string> {
  const id = input.id ?? uuid();
  const row: Note = {
    id,
    title: input.title,
    body: input.body,
    reference: input.reference ?? '',
    notebook: input.notebook ?? 'Estudos',
    tags: input.tags ?? '',
    updated_at: Date.now(),
  };
  await write(['notes', 'note_links'], async (tx) => {
    tx.objectStore('notes').put(row);
    const links = tx.objectStore('note_links');
    const old = (await requestValue(links.index('source_id').getAllKeys(id))) as IDBValidKey[];
    for (const key of old) links.delete(key);
    const seen = new Set<string>();
    for (const link of wikiTargets(row.body)) {
      if (seen.has(link.target)) continue;
      seen.add(link.target);
      links.put({ source_id: id, target_id: link.target, kind: link.kind });
    }
  });
  notesCache = null;
  if (notify) emit();
  return id;
}

export async function deleteNote(id: string): Promise<void> {
  await write(['notes', 'note_links'], async (tx) => {
    tx.objectStore('notes').delete(id);
    const links = tx.objectStore('note_links');
    const old = (await requestValue(links.index('source_id').getAllKeys(id))) as IDBValidKey[];
    for (const key of old) links.delete(key);
  });
  notesCache = null;
  emit();
}

export async function backlinks(target: string): Promise<Note[]> {
  const links = await getAll<{ source_id: string }>('note_links', target, 'target_id');
  const ids = new Set(links.map((l) => l.source_id));
  return (await notes()).filter((n) => ids.has(n.id));
}

export async function notesAt(reference: string): Promise<Note[]> {
  return (await notes()).filter((n) => n.reference === reference);
}

export function invalidateNotes(): void {
  notesCache = null;
}

// ---------------------------------------------------------------- destaques
export async function highlight(translation: string, refs: Iterable<string>, color: number | null): Promise<void> {
  await write(['highlights'], (tx) => {
    const store = tx.objectStore('highlights');
    for (const reference of refs) {
      if (color === null) store.delete([translation, reference]);
      else store.put({ translation, reference, color, book: Number(reference.split(':')[0]) });
    }
  });
  emit();
}

export async function highlights(translation: string, book: number): Promise<Map<string, number>> {
  const rows = await getAll<Highlight>('highlights', [translation, book], 'book');
  return new Map(rows.map((r) => [r.reference, r.color]));
}

// ------------------------------------------------- favoritos, abas, histórico
export type PlaceKind = 'bookmarks' | 'study_tabs';

export async function savePlace(kind: PlaceKind, reference: string, translation: string, title: string, id?: string) {
  await put(kind, { id: id ?? uuid(), reference, translation, title });
  emit();
}
export const savedPlaces = (kind: PlaceKind) => getAll<Place>(kind);
export async function readingHistory(): Promise<HistoryRow[]> {
  return (await getAll<HistoryRow>('reading_history')).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
}
export async function deletePlace(kind: PlaceKind, id: string) {
  await del(kind, id);
  emit();
}

// ------------------------------------------------------------ progresso
const progress = new Map<string, boolean>();
export async function loadProgress(): Promise<void> {
  for (const row of await getAll<{ id: string; completed: number }>('learning_progress')) {
    progress.set(row.id, row.completed === 1);
  }
}
export const isCompleted = (id: string) => progress.get(id) === true;
export async function completed(id: string, value: boolean): Promise<void> {
  progress.set(id, value);
  emit();
  await put('learning_progress', { id, completed: value ? 1 : 0, updated_at: Date.now() });
}

// ----------------------------------------------------------- memorização
export async function addCard(translation: string, r: Ref, text: string, mode = 'reference_to_text', topic = '') {
  const card: Flashcard = { id: uuid(), reference: refId(r), translation, text, topic, mode, repetitions: 0, interval: 0, ease: 2.5, due: 0 };
  await put('flashcards', card);
  emit();
}

export async function cards(dueOnly = false): Promise<Flashcard[]> {
  const all = (await getAll<Flashcard>('flashcards')).sort((a, b) => a.due - b.due);
  const now = Date.now();
  return dueOnly ? all.filter((c) => c.due <= now) : all;
}

export async function reviewCard(card: Flashcard, grade: number): Promise<void> {
  const next = schedule({ repetitions: card.repetitions, interval: card.interval, ease: card.ease, due: card.due }, grade);
  await write(['flashcards', 'review_history'], (tx) => {
    tx.objectStore('flashcards').put({ ...card, ...next });
    tx.objectStore('review_history').put({ id: uuid(), card_id: card.id, grade, reviewed_at: Date.now() });
  });
  emit();
}

export async function deleteCard(id: string) {
  await del('flashcards', id);
  emit();
}

export async function reviewStats(): Promise<{ n: number; correct: number }> {
  const rows = await getAll<{ grade: number }>('review_history');
  return { n: rows.length, correct: rows.filter((r) => r.grade >= 3).length };
}

// ---------------------------------------------------------------- anexos
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', view as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function attach(noteId: string, file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new RangeError('O anexo excede 20 MB.');
  const id = uuid();
  const bytes = await file.arrayBuffer();
  const ext = (/\.[a-z0-9]{1,8}$/i.exec(file.name)?.[0] ?? '.bin').toLowerCase();
  await put('attachments', {
    id,
    note_id: noteId,
    filename: file.name.split(/[\\/]/).pop() ?? file.name,
    path: `attachments/${id}${ext}`,
    sha256: await sha256Hex(bytes),
    mime: file.type || 'application/octet-stream',
    blob: new Blob([bytes], { type: file.type || 'application/octet-stream' }),
  } satisfies Attachment);
  return id;
}

export const attachment = (id: string) => get<Attachment>('attachments', id);

const objectUrls = new Map<string, string>();
export async function attachmentUrl(id: string): Promise<string | null> {
  if (objectUrls.has(id)) return objectUrls.get(id)!;
  const a = await attachment(id);
  if (!a?.blob) return null;
  const url = URL.createObjectURL(a.blob);
  objectUrls.set(id, url);
  return url;
}

export const isRef = (s: string) => fromId(s) !== null;

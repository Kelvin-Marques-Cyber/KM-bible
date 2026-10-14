// Lógica pura da área "Estudos" (lib/notes.dart): filtro de anotações,
// cadernos, prévia do texto e Markdown de anexos. Sem React, testável.
import { fold } from './domain';
import type { Note } from './store';

/** Texto dobrado (sem acento/caixa) de título + corpo + etiquetas, em cache por objeto. */
const haystacks = new WeakMap<Note, string>();
export function noteHaystack(note: Note): string {
  let value = haystacks.get(note);
  if (value === undefined) {
    value = fold(`${note.title} ${note.body} ${note.tags}`);
    haystacks.set(note, value);
  }
  return value;
}

/**
 * Mesmo critério do NotesPage original: caderno exato (vazio = todos) e busca
 * dobrada contida em "título corpo etiquetas".
 */
export function filterNotes(all: readonly Note[], notebook: string, query: string): Note[] {
  const needle = fold(query);
  if (!notebook && !needle) return all.slice();
  return all.filter((n) => (!notebook || n.notebook === notebook) && (!needle || noteHaystack(n).includes(needle)));
}

/** Cadernos distintos na ordem em que aparecem (como o Set do Dart); ignora vazios. */
export function notebooksOf(all: readonly Note[]): string[] {
  const seen = new Set<string>();
  for (const n of all) if (n.notebook) seen.add(n.notebook);
  return [...seen];
}

/** "caderno · etiquetas" (linha secundária do cartão). */
export function noteMeta(note: Note): string {
  return `${note.notebook} · ${note.tags}`;
}

/** Prévia curta do corpo: quebras de linha viram espaço; limita o tamanho renderizado. */
export function notePreview(body: string, max = 320): string {
  const head = body.length > max * 2 ? body.slice(0, max * 2) : body;
  const flat = head.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

export function fileExtension(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1 ? base.slice(dot + 1).toLowerCase() : '';
}

export const isImageFile = (name: string) => IMAGE_EXTENSIONS.includes(fileExtension(name));

/**
 * Trecho acrescentado ao corpo após anexar: "\n![nome](attachment:id)\n" para
 * imagens e "\n[nome](attachment:id)\n" para outros arquivos (como o original).
 * Colchetes do nome são escapados para não quebrar o Markdown.
 */
export function attachmentMarkdown(name: string, id: string): string {
  const label = (name.split(/[\\/]/).pop() ?? name).replace(/([[\]\\])/g, '\\$1');
  return `\n${isImageFile(name) ? '!' : ''}[${label}](attachment:${id})\n`;
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

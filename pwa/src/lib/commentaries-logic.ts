// Regras puras (sem React) das telas de comentários, comparação de edições,
// referências cruzadas e lugares salvos — port de lib/reader.dart,
// lib/cross_references.dart e lib/graph.dart (relationLabels).
import type { ModuleInfo } from './catalog';
import type { CommentaryEntry, CrossRef } from './content';
import { fold, fromId, refKey, refLabel, type Ref } from './domain';

// --------------------------------------------------------------- comentários

/** Guias de leitura listados à parte, em "Guias de leitura e referências". */
export const GUIDE_MODULES = ['HDL-GUIA-FONTES', 'JOSEMAR-GUIA-FONTES', 'EXP2-CALV-PT'] as const;
/** Devocionais diários (Café da Manhã com Spurgeon; Jornada Reformada, fontes de Josemar Bessa). */
export const DEVOTIONAL_MODULES = ['EXP-SPURGEON-DIARIO', 'EXP-JORNADA-DIARIO'] as const;
export const PREVIEW_LIMIT = 2500;
export const COPY_LIMIT = 1500;

/** Ordem do original: Hernandes (HDL*) primeiro, Calvino em seguida, demais depois. */
export function commentaryRank(moduleId: string): number {
  return moduleId.startsWith('HDL') ? 0 : moduleId === 'CalvinCommentaries' ? 1 : 2;
}

/** Ordenação estável por prioridade de autor (mantém a ordem de content.commentaries dentro do grupo). */
export function sortCommentaries(entries: readonly CommentaryEntry[]): CommentaryEntry[] {
  return entries
    .map((entry, index) => ({ entry, index, rank: commentaryRank(entry.module_id) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.entry);
}

/** Tradução de estudo em português persistida para a entrada (translatedEntry do original). */
export function translation(entry: CommentaryEntry): { title: string; body: string; status: string } | null {
  return entry.pt && entry.pt.body.trim() !== '' ? entry.pt : null;
}

/**
 * Na interface em português, só mostra entradas de módulos em português ou com
 * tradução de estudo, salvo quando o leitor pede os originais em inglês.
 */
export function localizedEntries(
  entries: readonly CommentaryEntry[],
  language: string,
  showOriginals: boolean,
  moduleLanguage: (id: string) => string,
): CommentaryEntry[] {
  if (language !== 'pt' || showOriginals) return [...entries];
  return entries.filter((entry) => moduleLanguage(entry.module_id).toLowerCase().startsWith('pt') || translation(entry) !== null);
}

/**
 * Regra do original (e da especificação): o aviso sobre os comentários
 * integrais de Hernandes Dias Lopes só aparece quando nenhuma entrada HDL*
 * (inclusive o guia de fontes) consta da lista desta passagem.
 */
export function hasHernandesEntry(entries: readonly CommentaryEntry[]): boolean {
  return entries.some((e) => e.module_id.startsWith('HDL'));
}

/**
 * Junta os resultados carregados módulo a módulo na mesma ordem de
 * content.commentaries (módulo crescente; dentro dele, início decrescente).
 */
export function mergeCommentaryGroups(groups: readonly { id: string; entries: readonly CommentaryEntry[] }[]): CommentaryEntry[] {
  return [...groups]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .flatMap((g) => [...g.entries].sort((a, b) => b.start_key - a.start_key));
}

/** Prévia de até 2 500 caracteres, cortada no último espaço, com reticências. */
export function previewText(body: string, limit = PREVIEW_LIMIT): string {
  if (body.length <= limit) return body;
  const space = body.lastIndexOf(' ', limit);
  return `${body.slice(0, space > 0 ? space : limit)}…`;
}

export interface CommentaryModule {
  id: string;
  author: string;
  title: string;
  language: string;
  version: string;
  license: string;
  source: string;
}

/** Dados do módulo para o cartão; Calvino tem os mesmos valores de reserva do original. */
export function commentaryModule(id: string, info: ModuleInfo | undefined): CommentaryModule {
  if (info) {
    return {
      id: info.id,
      author: info.author || (id === 'CalvinCommentaries' ? 'João Calvino' : id),
      title: info.title,
      language: info.language,
      version: info.version,
      license: info.license,
      source: info.source,
    };
  }
  if (id === 'CalvinCommentaries') {
    return {
      id: 'CalvinCommentaries',
      author: 'João Calvino',
      title: 'Comentários reunidos de João Calvino',
      language: 'en',
      version: 'public.1',
      license: 'Domínio público',
      source: 'CCEL — edição histórica',
    };
  }
  return { id, author: id, title: id, language: '', version: '', license: '', source: '' };
}

/** Rótulo do filtro de autor (FilterChip do original). */
export function authorLabel(id: string, info: ModuleInfo | undefined): string {
  if (id === 'HDL-JOAO') return 'Hernandes · João';
  return info?.author || (id === 'CalvinCommentaries' ? 'João Calvino' : id);
}

/**
 * Rótulos dos filtros por autor. Quando dois módulos têm o mesmo autor
 * (ex.: "Equipe editorial independente"), o título do módulo os distingue.
 */
export function authorChipLabels(ids: readonly string[], lookup: (id: string) => ModuleInfo | undefined): Map<string, string> {
  const base = ids.map((id) => [id, authorLabel(id, lookup(id))] as const);
  const counts = new Map<string, number>();
  for (const [, label] of base) counts.set(label, (counts.get(label) ?? 0) + 1);
  return new Map(base.map(([id, label]) => [id, (counts.get(label) ?? 0) > 1 ? lookup(id)?.title || `${label} · ${id}` : label]));
}

/** Módulos presentes na lista, na ordem em que aparecem (sem repetição). */
export function authorIds(entries: readonly CommentaryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.module_id))];
}

/** Filtro por autor; seleção sem correspondência nesta passagem equivale a "todos". */
export function filterByAuthors(entries: readonly CommentaryEntry[], authors: ReadonlySet<string>): CommentaryEntry[] {
  const active = entries.some((e) => authors.has(e.module_id));
  return active ? entries.filter((e) => authors.has(e.module_id)) : [...entries];
}

/** Texto copiado com citação, idêntico ao aplicativo original. */
export function commentaryCitation(body: string, m: CommentaryModule, referenceLabel: string, entry: CommentaryEntry): string {
  return `${body.slice(0, Math.min(COPY_LIMIT, body.length))}\n\n${m.author}; ${m.title}; ${referenceLabel}; entrada ${entry.reference}–${entry.end_reference}; ${entry.bibliography ?? ''}; módulo ${m.id} ${m.version}; ${m.license}.`;
}

// -------------------------------------------------------------- comparação

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/** Forma comparável de uma palavra: sem acentos/caixa e sem pontuação nas pontas. */
export function diffKey(word: string): string {
  return fold(word).replace(EDGE_PUNCTUATION, '');
}

/** Conjunto de palavras do versículo de base. */
export function baseWords(text: string): Set<string> {
  const set = new Set<string>();
  for (const w of text.split(/\s+/)) {
    const k = diffKey(w);
    if (k) set.add(k);
  }
  return set;
}

export interface Segment {
  text: string;
  changed: boolean;
}

/** Divide o texto preservando espaços e marca palavras ausentes no versículo de base. */
export function diffSegments(text: string, base: ReadonlySet<string>): Segment[] {
  const out: Segment[] = [];
  for (const piece of text.split(/(\s+)/)) {
    if (!piece) continue;
    if (/^\s+$/.test(piece)) {
      if (out.length && !out[out.length - 1].changed) out[out.length - 1].text += piece;
      else out.push({ text: piece, changed: false });
      continue;
    }
    const k = diffKey(piece);
    const changed = k !== '' && !base.has(k);
    const last = out[out.length - 1];
    if (last && last.changed === changed && !changed) last.text += piece;
    else out.push({ text: piece, changed });
  }
  return out;
}

// --------------------------------------------------- referências cruzadas

export type XrefFilter = 'all' | 'textual' | 'editorial' | 'theological';
export const XREF_FILTERS: XrefFilter[] = ['all', 'textual', 'editorial', 'theological'];

/** relationLabels de lib/graph.dart. */
export const RELATION_LABELS: Record<string, [string, string, string]> = {
  editorial: ['Referência editorial', 'Editorial reference', 'Referencia editorial'],
  textual: ['Citação textual', 'Textual quotation', 'Cita textual'],
  theological: ['Interpretação teológica', 'Theological interpretation', 'Interpretación teológica'],
  personal: ['Anotação pessoal', 'Personal note', 'Nota personal'],
  history: ['Acontecimento', 'Event', 'Acontecimiento'],
  place: ['Lugar', 'Place', 'Lugar'],
  topic: ['Tema editorial', 'Editorial topic', 'Tema editorial'],
};

export function relationLabel(kind: string, language: string): string {
  const row = RELATION_LABELS[kind] ?? RELATION_LABELS.editorial;
  return row[language === 'en' ? 1 : language === 'es' ? 2 : 0];
}

export type XrefRow = Pick<CrossRef, 'target' | 'end_reference' | 'kind' | 'provenance' | 'scope'>;
export interface Relation {
  from: string;
  to: string;
  kind: string;
  description: string;
}

/** Relações editoriais curadas, nos dois sentidos. */
export function curatedRows(relations: readonly Relation[], id: string): XrefRow[] {
  const rows: XrefRow[] = [];
  for (const edge of relations) {
    const target = edge.from === id ? edge.to : edge.to === id ? edge.from : null;
    if (target) rows.push({ target, end_reference: target, kind: edge.kind, provenance: edge.description, scope: 'verse' });
  }
  return rows;
}

/** Aplica o filtro e descarta linhas com endereço inválido. */
export function filterXrefs(rows: readonly XrefRow[], filter: XrefFilter): XrefRow[] {
  return rows.filter((row) => fromId(row.target) && (filter === 'all' || row.kind === filter));
}

/** Rótulo do alvo: intervalo apenas quando o fim difere do início. */
export function xrefTitle(target: Ref, end: Ref | null, language: string): string {
  return !end || refKey(end) === refKey(target) ? refLabel(target, language) : `${refLabel(target, language)} – ${refLabel(end, language)}`;
}

/** Texto de um versículo num livro já carregado (formato BookData do acervo). */
export function verseText(book: { c: [number, string, unknown?][][] } | null | undefined, r: Ref): string | null {
  const chapter = book?.c[r.chapter - 1];
  if (!chapter) return null;
  const guess = chapter[r.verse - 1];
  if (guess && guess[0] === r.verse) return guess[1];
  return chapter.find((v) => v[0] === r.verse)?.[1] ?? null;
}

// ---------------------------------------------------------- lugares salvos

export interface PlaceLike {
  id: string;
  reference: string;
  translation: string;
  title: string;
}

/**
 * Ordem canônica (livro, capítulo, versículo), depois título e edição. Os
 * IndexedDB stores usam chaves uuid sem data, então a ordem de inserção do
 * SQLite original não pode ser reproduzida. Endereços inválidos (ex.: backup
 * antigo) vão para o fim, para que ainda possam ser excluídos.
 */
export function sortPlaces<T extends PlaceLike>(rows: readonly T[]): T[] {
  const key = (r: Ref | null) => (r ? refKey(r) : Number.MAX_SAFE_INTEGER);
  return rows
    .map((row) => ({ row, r: fromId(row.reference) }))
    .sort(
      (a, b) =>
        key(a.r) - key(b.r) ||
        (a.row.title ?? '').localeCompare(b.row.title ?? '', 'pt') ||
        (a.row.translation ?? '').localeCompare(b.row.translation ?? ''),
    )
    .map((x) => x.row);
}

/** Título exibido de um lugar salvo (o próprio título, ou o rótulo do endereço). */
export function placeTitle(row: PlaceLike, language: string): string {
  if (row.title) return row.title;
  const r = fromId(row.reference);
  return r ? refLabel(r, language) : row.reference;
}

/** Chaves estáveis para listas que podem ter linhas repetidas (relação curada + TSK). */
export function stableKeys<T>(rows: readonly T[], base: (row: T) => string): string[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const k = base(row);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return n === 0 ? k : `${k}#${n}`;
  });
}

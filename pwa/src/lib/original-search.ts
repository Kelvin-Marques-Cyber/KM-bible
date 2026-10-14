// Pesquisa linguística e lemas sob demanda (LinguisticSearchPage/OriginalPage
// de lib/linguistics.dart) sobre o acervo fragmentado: o índice de formas e
// lemas roda num Web Worker (fallback: fatias ociosas na thread principal) e
// as ocorrências vêm dos baldes lexicon/o e lexicon/m, um de cada vez.
import { catalog, packUrl } from './catalog';
import { lexeme, lexemeList, morphList, morphOccurrences, occurrences, strongId, type Occurrence } from './content';
import { fnv1a, fromId, refKey } from './domain';
import { fetchJson, NotFoundError, OfflineError } from './fetcher';
import {
  createIndexService,
  idlePause,
  lexBucket,
  rankMorphCodes,
  type IndexDataset,
  type IndexProgress,
  type IndexRequest,
  type IndexResult,
  type WorkerMessage,
} from './original-logic';

export const MAX_ROWS = 200;
/** Máximo de baldes de ocorrências baixados por pesquisa (economia de dados). */
export const MAX_SHARDS = 10;
const MATCH_LIMIT = 3000;
const SUGGESTIONS = 12;

export type SearchMode = 'lemma' | 'surface' | 'morphology' | 'Strong';
export const SEARCH_MODES: SearchMode[] = ['lemma', 'surface', 'morphology', 'Strong'];

export interface SearchRow {
  key: string;
  edition: string;
  reference: string;
  surface: string;
  morphology: string;
}
export interface Suggestion {
  lexeme: string;
  label: string;
  detail: string;
}
export interface SearchOutcome {
  mode: SearchMode;
  query: string;
  rows: SearchRow[];
  /** Chegou a MAX_ROWS ocorrências. */
  limited: boolean;
  /** Parou no limite de baldes antes de consultar todos os itens correspondentes. */
  partial: boolean;
  /** Lemas, formas ou códigos correspondentes (ou frequência, no modo Strong). */
  matches: number;
  /** Ocorrências no corpus das formas/códigos correspondentes. */
  corpus: number;
  /** Formas correspondentes cujas ocorrências não constam do índice resumido. */
  unlocated: number;
  suggestions: Suggestion[];
}
export type SearchStatus =
  | { phase: 'start' }
  | { phase: 'download' }
  | { phase: 'index'; value: number }
  | { phase: 'occurrences'; done: number; total: number };

export class SearchCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'SearchCancelled';
  }
}

// ------------------------------------------------------- worker + fallback
class WorkerUnavailable extends Error {}

let worker: Worker | null = null;
let workerBroken = false;
let requestId = 0;
const pending = new Map<number, { resolve: (r: IndexResult) => void; reject: (e: unknown) => void; progress?: (p: IndexProgress) => void }>();
let fallback: ReturnType<typeof createIndexService> | null = null;
let users = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function failAll(error: unknown) {
  for (const p of pending.values()) p.reject(error);
  pending.clear();
}

function toError(message: Extract<WorkerMessage, { type: 'error' }>): Error {
  const url = message.url ?? '';
  if (message.kind === 'offline') return new OfflineError(url);
  if (message.kind === 'missing') return new NotFoundError(url);
  return new Error(message.message);
}

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../workers/original-index.ts', import.meta.url), { type: 'module' });
  } catch {
    workerBroken = true;
    return null;
  }
  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;
    const entry = pending.get(message.id);
    if (!entry) return;
    if (message.type === 'progress') {
      entry.progress?.(message.phase === 'download' ? { phase: 'download' } : { phase: 'index', value: message.value });
    } else if (message.type === 'result') {
      pending.delete(message.id);
      entry.resolve({ total: message.total, rows: message.rows });
    } else {
      pending.delete(message.id);
      entry.reject(toError(message));
    }
  };
  worker.onerror = (event) => {
    // Worker de módulo indisponível (navegadores antigos): usa a thread principal.
    event.preventDefault?.();
    workerBroken = true;
    worker?.terminate();
    worker = null;
    failAll(new WorkerUnavailable());
  };
  return worker;
}

function fallbackService() {
  return (fallback ??= createIndexService((url) => fetchJson<unknown>(url), idlePause));
}

async function indexQuery(request: IndexRequest, onProgress: (p: IndexProgress) => void): Promise<IndexResult> {
  const w = getWorker();
  if (w) {
    try {
      return await new Promise<IndexResult>((resolve, reject) => {
        const id = ++requestId;
        pending.set(id, { resolve, reject, progress: onProgress });
        w.postMessage({ id, ...request });
      });
    } catch (error) {
      if (!(error instanceof WorkerUnavailable)) throw error;
    }
  }
  return fallbackService().query(request, onProgress);
}

/** A tela de pesquisa mantém o índice vivo enquanto aberta; depois libera a memória. */
export function retainIndex(): void {
  users++;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}
export function releaseIndex(delay = 45_000): void {
  users = Math.max(0, users - 1);
  if (users > 0) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (users > 0 || pending.size > 0) return;
    worker?.terminate();
    worker = null;
    fallback?.clear();
    fallback = null;
  }, delay);
}

// --------------------------------------------------------------- pesquisa
interface Context {
  alive: () => boolean;
  status: (s: SearchStatus) => void;
}

const editionRank = (edition: string) => {
  const i = catalog.words.editions.indexOf(edition);
  return i < 0 ? 99 : i;
};
const rowKey = (o: Occurrence) => `${o.edition}|${o.reference}|${o.surface}|${o.morphology}`;

/** Ordem canônica: edição, depois livro/capítulo/versículo (o original ordenava o texto da referência). */
export function sortRows<T extends { edition: string; reference: string }>(rows: T[]): T[] {
  const key = (reference: string) => {
    const r = fromId(reference);
    return r ? refKey(r) : Number.MAX_SAFE_INTEGER;
  };
  return rows
    .map((row) => ({ row, edition: editionRank(row.edition), k: key(row.reference) }))
    .sort((a, b) => a.edition - b.edition || a.k - b.k)
    .map((x) => x.row);
}

/** Linhas distintas (SELECT DISTINCT do original). */
export function distinctRows(rows: Occurrence[]): SearchRow[] {
  const seen = new Map<string, SearchRow>();
  for (const o of rows) {
    const key = rowKey(o);
    if (!seen.has(key)) seen.set(key, { key, ...o });
  }
  return [...seen.values()];
}

/**
 * Percorre itens em ordem de relevância, baixando um balde por vez (com
 * pré-busca dos próximos dois) até MAX_ROWS linhas ou MAX_SHARDS baldes.
 */
async function collect<T>(
  items: T[],
  shardOf: (item: T) => string,
  fetchRows: (item: T) => Promise<Occurrence[]>,
  accept: (o: Occurrence, item: T) => boolean,
  ctx: Context,
): Promise<{ rows: SearchRow[]; limited: boolean; partial: boolean; seen: Set<string> }> {
  const plan: string[] = [];
  const firstItem = new Map<string, T>();
  let skipped = false;
  for (const item of items) {
    const shard = shardOf(item);
    if (firstItem.has(shard)) continue;
    if (plan.length >= MAX_SHARDS) {
      skipped = true;
      continue;
    }
    plan.push(shard);
    firstItem.set(shard, item);
  }
  const allowed = new Set(plan);
  const fetched = new Set<string>();
  const rows = new Map<string, SearchRow>();
  const seen = new Set<string>();
  let limited = false;
  const warm = (index: number) => {
    const shard = plan[index];
    if (shard !== undefined && !fetched.has(shard)) fetchRows(firstItem.get(shard)!).catch(() => undefined);
  };
  outer: for (const item of items) {
    const shard = shardOf(item);
    if (!allowed.has(shard)) continue;
    if (!fetched.has(shard)) {
      ctx.status({ phase: 'occurrences', done: fetched.size, total: plan.length });
      fetched.add(shard);
      const position = plan.indexOf(shard);
      warm(position + 1);
      warm(position + 2);
    }
    const found = await fetchRows(item);
    if (!ctx.alive()) throw new SearchCancelled();
    for (const o of found) {
      if (!accept(o, item)) continue;
      seen.add(o.surface);
      const key = rowKey(o);
      if (rows.has(key)) continue;
      if (rows.size >= MAX_ROWS) {
        limited = true;
        break outer;
      }
      rows.set(key, { key, ...o });
    }
  }
  return { rows: sortRows([...rows.values()]), limited, partial: skipped && !limited, seen };
}

const indexStatus = (ctx: Context) => (p: IndexProgress) => {
  if (ctx.alive()) ctx.status(p.phase === 'download' ? { phase: 'download' } : { phase: 'index', value: p.value });
};

async function searchIndex(dataset: IndexDataset, file: string, query: string, ctx: Context): Promise<IndexResult> {
  const result = await indexQuery({ dataset, url: packUrl(catalog.lexicon, file), query, limit: MATCH_LIMIT }, indexStatus(ctx));
  if (!ctx.alive()) throw new SearchCancelled();
  return result;
}

const empty = (mode: SearchMode, query: string): SearchOutcome => ({
  mode,
  query,
  rows: [],
  limited: false,
  partial: false,
  matches: 0,
  corpus: 0,
  unlocated: 0,
  suggestions: [],
});

async function byLemma(query: string, ctx: Context): Promise<SearchOutcome> {
  const found = await searchIndex('lexemes', 'list.json', query, ctx);
  const lexemes = found.rows as [string, string, string, string][];
  const result = await collect(lexemes, ([id]) => lexBucket(id), async ([id]) => (await occurrences(id)).rows, () => true, ctx);
  return {
    ...empty('lemma', query),
    ...result,
    matches: found.total,
    suggestions: lexemes.slice(0, SUGGESTIONS).map(([id, lemma, transliteration]) => ({ lexeme: id, label: `${id} · ${lemma}`, detail: transliteration })),
  };
}

async function bySurface(query: string, ctx: Context): Promise<SearchOutcome> {
  const found = await searchIndex('surfaces', 'surfaces.json', query, ctx);
  const forms = found.rows as [string, string, number][];
  const byLexeme = new Map<string, Set<string>>();
  let corpus = 0;
  for (const [surface, id, count] of forms) {
    corpus += count;
    if (!id) continue;
    if (!byLexeme.has(id)) byLexeme.set(id, new Set());
    byLexeme.get(id)!.add(surface);
  }
  const ids = [...byLexeme.keys()];
  const result = await collect(
    ids,
    (id) => lexBucket(id),
    async (id) => (await occurrences(id)).rows,
    (o, id) => byLexeme.get(id)!.has(o.surface),
    ctx,
  );
  const complete = !result.limited && !result.partial && found.total <= forms.length;
  return {
    ...empty('surface', query),
    ...result,
    matches: found.total,
    corpus,
    unlocated: complete ? forms.filter(([surface]) => !result.seen.has(surface)).length : 0,
    suggestions: forms
      .filter(([, id]) => id)
      .slice(0, SUGGESTIONS)
      .map(([surface, id, count]) => ({ lexeme: id, label: surface, detail: `${id} · ${count}` })),
  };
}

async function byMorphology(query: string, ctx: Context): Promise<SearchOutcome> {
  ctx.status({ phase: 'download' });
  const list = await morphList();
  if (!ctx.alive()) throw new SearchCancelled();
  const { codes, corpus } = rankMorphCodes(list, query);
  const result = await collect(
    codes,
    ([code]) => String(fnv1a(code) % 32),
    ([code]) => morphOccurrences(code),
    () => true,
    ctx,
  );
  return { ...empty('morphology', query), ...result, matches: codes.length, corpus };
}

async function byStrong(query: string, ctx: Context): Promise<SearchOutcome> {
  const id = strongId(query);
  ctx.status({ phase: 'occurrences', done: 0, total: 1 });
  const { frequency, rows } = await occurrences(id);
  if (!ctx.alive()) throw new SearchCancelled();
  const distinct = sortRows(distinctRows(rows));
  return {
    ...empty('Strong', query),
    rows: distinct,
    limited: rows.length >= MAX_ROWS && frequency > rows.length,
    matches: frequency,
    corpus: frequency,
    suggestions: frequency > 0 ? [{ lexeme: id, label: id, detail: '' }] : [],
  };
}

/** Executa uma pesquisa; alive() falso cancela (SearchCancelled). */
export async function runSearch(
  mode: SearchMode,
  raw: string,
  options: { alive?: () => boolean; onStatus?: (s: SearchStatus) => void } = {},
): Promise<SearchOutcome> {
  const query = raw.trim();
  const ctx: Context = { alive: options.alive ?? (() => true), status: (s) => options.onStatus?.(s) };
  if (!query) return empty(mode, query);
  ctx.status({ phase: 'start' });
  switch (mode) {
    case 'lemma':
      return byLemma(query, ctx);
    case 'surface':
      return bySurface(query, ctx);
    case 'morphology':
      return byMorphology(query, ctx);
    default:
      return byStrong(query, ctx);
  }
}

// ------------------------------------------------- lemas da OriginalPage
const lemmaCache = new Map<string, string>();
const glossCache = new Map<string, string>();
let listLoad: Promise<void> | null = null;

/** Muitos baldes diferentes num versículo: uma única lista de lemas sai mais barata. */
export function preloadLemmaList(): Promise<void> {
  listLoad ??= lexemeList().then(
    (list) => {
      for (const [id, lemma] of list) if (!lemmaCache.has(id)) lemmaCache.set(id, lemma);
    },
    (error) => {
      listLoad = null;
      throw error;
    },
  );
  return listLoad;
}

export const distinctBuckets = (ids: string[]) => new Set(ids.filter(Boolean).map((id) => lexBucket(strongId(id)))).size;

export interface LexemeSummary {
  lemma: string | null;
  /** Glosa portuguesa completa (quando o verbete foi carregado). */
  gloss: string | null;
}

/** Lema de um verbete (store.wordsAt fazia JOIN com lexemes): lista já carregada ou o balde do verbete. */
export async function lexemeSummary(id0: string): Promise<LexemeSummary> {
  const id = strongId(id0);
  if (!id) return { lemma: null, gloss: null };
  if (!lemmaCache.has(id) && listLoad) await listLoad.catch(() => undefined);
  if (lemmaCache.has(id)) return { lemma: lemmaCache.get(id)!, gloss: glossCache.get(id) ?? null };
  const entry = await lexeme(id);
  if (!entry) return { lemma: null, gloss: null };
  lemmaCache.set(id, entry.lemma);
  const gloss = entry.pt?.gloss?.trim() ?? '';
  if (gloss) glossCache.set(id, gloss);
  return { lemma: entry.lemma, gloss: gloss || null };
}

/** Já em memória (renderização imediata, sem estado de carregamento). */
export function cachedLexemeSummary(id0: string): LexemeSummary | null {
  const id = strongId(id0);
  return lemmaCache.has(id) ? { lemma: lemmaCache.get(id)!, gloss: glossCache.get(id) ?? null } : null;
}

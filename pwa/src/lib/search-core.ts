// Núcleo da pesquisa geral (SearchPage de lib/search.dart + store.search(),
// suggestion() e fts() de lib/store.dart) sem dependências de DOM: roda no
// Web Worker (workers/search.worker.ts) e, como alternativa, na thread principal.
//
// Semântica (FTS5 do original): todos os termos da consulta precisam aparecer
// como palavras inteiras (AND), sem acentos e sem caixa; o ÚLTIMO termo com 3+
// letras também casa por prefixo (o usuário ainda está digitando).
import { editDistance, fnv1a, fold, keyToRef, refId, refKey, tokenize } from './domain';

// ------------------------------------------------------------------ limites
/** Limites por categoria, iguais aos LIMIT das consultas do original. */
export const LIMITS = { topic: 30, bible: 60, notes: 40, documents: 40, studies: 40, commentary: 60, lexicon: 40 } as const;
export type Group = keyof typeof LIMITS;
/** Ordem das seções no resultado (a mesma de store.search). */
export const GROUP_ORDER: Group[] = ['topic', 'bible', 'notes', 'documents', 'studies', 'commentary', 'lexicon'];
/** fts() do original lê no máximo 300 caracteres. */
export const MAX_QUERY_LENGTH = 300;
/** Os títulos sobem ao topo dentro desta janela de candidatos (em ordem do acervo). */
export const WINDOW_FACTOR = 3;
/** Blocos de registros baixados da REDE por índice e por pesquisa (os já salvos não contam). */
export const NETWORK_BUDGET = 6;
const BOOK_CONCURRENCY = 6;
const CHUNK_CONCURRENCY = 4;
const SHARD_CACHE = 12;
const CHUNK_CACHE = 8;
const USER_CACHE = 4;
/** Candidatos examinados por módulo importado (títulos primeiro entre eles). */
const USER_SCAN = 5000;
/** Índice bíblico incompleto (sem conexão) é refeito depois deste intervalo. */
export const RETRY_INCOMPLETE_MS = 30_000;
/** Fatia máxima de trabalho contínuo antes de ceder a vez (ms). */
const SLICE_MS = 12;

// ------------------------------------------------------------------ consulta
export interface Query {
  /** Termos que precisam aparecer como palavras inteiras. */
  exact: string[];
  /** Último termo (3+ letras), que também casa por prefixo. */
  prefix: string | null;
  /** Todos os termos, para destacar no texto. */
  terms: string[];
}

export function parseQuery(text: string): Query {
  const tokens = tokenize(text.slice(0, MAX_QUERY_LENGTH));
  if (tokens.length === 0) return { exact: [], prefix: null, terms: [] };
  const last = tokens[tokens.length - 1];
  const prefix = last.length >= 3 ? last : null;
  return { exact: [...new Set(prefix ? tokens.slice(0, -1) : tokens)], prefix, terms: [...new Set(tokens)] };
}

export const isEmptyQuery = (q: Query) => q.exact.length === 0 && q.prefix === null;

/** Os termos de um texto satisfazem a consulta? */
export function tokensMatch(tokens: ReadonlySet<string>, q: Query): boolean {
  if (isEmptyQuery(q)) return false;
  for (const e of q.exact) if (!tokens.has(e)) return false;
  if (q.prefix === null) return true;
  if (tokens.has(q.prefix)) return true;
  for (const t of tokens) if (t.startsWith(q.prefix)) return true;
  return false;
}

export const matchesText = (text: string, q: Query) => tokensMatch(new Set(tokenize(text)), q);

// ------------------------------------------------------------- destaque
export interface Part {
  text: string;
  hit: boolean;
}
const WORD = /[\p{L}\p{N}\p{M}]+/gu;
const foldWord = (w: string) => w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Divide o texto em trechos, marcando as palavras que correspondem à consulta. */
export function highlightParts(text: string, q: Query): Part[] {
  if (!text || q.terms.length === 0) return [{ text, hit: false }];
  const exact = new Set(q.terms);
  const parts: Part[] = [];
  let cursor = 0;
  const push = (value: string, hit: boolean) => {
    if (!value) return;
    const last = parts[parts.length - 1];
    if (last && last.hit === hit) last.text += value;
    else parts.push({ text: value, hit });
  };
  for (const m of text.matchAll(WORD)) {
    const word = foldWord(m[0]);
    const hit = exact.has(word) || (q.prefix !== null && word.startsWith(q.prefix));
    if (!hit) continue;
    push(text.slice(cursor, m.index), false);
    push(m[0], true);
    cursor = (m.index ?? 0) + m[0].length;
  }
  push(text.slice(cursor), false);
  return parts.length ? parts : [{ text, hit: false }];
}

// ------------------------------------------------------------- trechos
const LINK_TARGET = /\((?:biblia|confession|attachment):[^)\s]*\)?/gi;

/** Remove destinos de links internos que sobram nos trechos ("Números 20:5(biblia:4:20:5)"). */
export function cleanSnippet(text: string): string {
  const cleaned = text.replace(LINK_TARGET, '').replace(/\s+/g, ' ').trim();
  return text.trimEnd().endsWith('…') && !cleaned.endsWith('…') ? `${cleaned}…` : cleaned;
}

/** Igual a snippet() de scripts/build_data.py (texto simples, até 200 caracteres). */
export function snippet(text: string, limit = 200): string {
  const plain = (text || '')
    .replace(LINK_TARGET, '')
    .replace(/[#*_>`[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= limit) return plain;
  const space = plain.lastIndexOf(' ', limit - 1);
  return `${plain.slice(0, space > 0 ? space : limit)}…`;
}

// ------------------------------------------------- listas ordenadas de inteiros
const EMPTY = new Uint32Array(0);

/** Postagens do índice gerado em Python: diferenças sucessivas (delta) a partir de 0. */
export function decodeDeltas(deltas: readonly number[]): Uint32Array {
  const out = new Uint32Array(deltas.length);
  let value = 0;
  for (let i = 0; i < deltas.length; i++) {
    value += deltas[i];
    out[i] = value;
  }
  return out;
}

export function intersectSorted(a: ArrayLike<number>, b: ArrayLike<number>): Uint32Array {
  const out = new Uint32Array(Math.min(a.length, b.length));
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < a.length && j < b.length) {
    const x = a[i];
    const y = b[j];
    if (x === y) {
      out[k++] = x;
      i++;
      j++;
    } else if (x < y) i++;
    else j++;
  }
  return out.subarray(0, k);
}

export function unionSorted(lists: ArrayLike<number>[]): Uint32Array {
  if (lists.length === 0) return EMPTY;
  if (lists.length === 1) return Uint32Array.from(lists[0]);
  let total = 0;
  for (const l of lists) total += l.length;
  const all = new Uint32Array(total);
  let offset = 0;
  for (const l of lists) {
    all.set(l, offset);
    offset += l.length;
  }
  all.sort();
  let k = 0;
  for (let i = 0; i < all.length; i++) if (k === 0 || all[i] !== all[k - 1]) all[k++] = all[i];
  return all.subarray(0, k);
}

/** Interseção das listas (menor primeiro), como o AND do FTS5. */
export function intersectAll(lists: ArrayLike<number>[]): Uint32Array {
  if (lists.length === 0) return EMPTY;
  const sorted = [...lists].sort((a, b) => a.length - b.length);
  let out: Uint32Array = Uint32Array.from(sorted[0]);
  for (let i = 1; i < sorted.length && out.length > 0; i++) out = intersectSorted(out, sorted[i]);
  return out;
}

/**
 * Fragmento de um termo nos índices: fnv1a (unidades UTF-16) dos 2 primeiros
 * caracteres, como shard_of() de build_data.py. token[:2] do Python conta pontos
 * de código: letras fora do BMP (pares substitutos) também caem no mesmo fragmento.
 */
export function shardOf(token: string, shards: number): number {
  const head = token.slice(0, 2);
  const code = head.charCodeAt(0);
  const astral = (code >= 0xd800 && code <= 0xdbff) || (head.length === 2 && head.charCodeAt(1) >= 0xd800 && head.charCodeAt(1) <= 0xdbff);
  return fnv1a(astral ? Array.from(token.slice(0, 4)).slice(0, 2).join('') : head) % shards;
}

// ------------------------------------------------------- índice de termos
/** Índice invertido compacto (CSR): termos ordenados + postagens contíguas. */
export class TokenIndex {
  constructor(
    readonly terms: string[],
    readonly offsets: Uint32Array,
    readonly postings: Uint32Array,
    readonly size: number,
  ) {}

  private lowerBound(value: string): number {
    let lo = 0;
    let hi = this.terms.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.terms[mid] < value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  find(term: string): number {
    const i = this.lowerBound(term);
    return i < this.terms.length && this.terms[i] === term ? i : -1;
  }

  postingsAt(i: number): Uint32Array {
    return this.postings.subarray(this.offsets[i], this.offsets[i + 1]);
  }

  frequency(i: number): number {
    return this.offsets[i + 1] - this.offsets[i];
  }

  prefixRange(prefix: string): [number, number] {
    return [this.lowerBound(prefix), this.lowerBound(`${prefix}￿`)];
  }

  /** Documentos (em ordem) que satisfazem a consulta. */
  search(q: Query, limit = Infinity): number[] {
    if (isEmptyQuery(q) || this.size === 0) return [];
    const lists: Uint32Array[] = [];
    for (const e of q.exact) {
      const i = this.find(e);
      if (i < 0) return [];
      lists.push(this.postingsAt(i));
    }
    let marks: Uint8Array | null = null;
    if (q.prefix !== null) {
      const [lo, hi] = this.prefixRange(q.prefix);
      if (lo >= hi) return [];
      if (hi - lo === 1) lists.push(this.postingsAt(lo));
      else {
        marks = new Uint8Array(this.size);
        for (let i = lo; i < hi; i++) for (const p of this.postingsAt(i)) marks[p] = 1;
      }
    }
    const out: number[] = [];
    if (lists.length > 0) {
      for (const id of intersectAll(lists)) {
        if (marks && !marks[id]) continue;
        out.push(id);
        if (out.length >= limit) break;
      }
    } else if (marks) {
      for (let id = 0; id < marks.length && out.length < limit; id++) if (marks[id]) out.push(id);
    }
    return out;
  }

  /**
   * suggestion() do original: uma única palavra com 4+ letras; candidatos que
   * começam pelas mesmas 2 letras; a melhor distância de edição precisa ser
   * <= 2 e diferente da própria consulta (palavra existente → sem sugestão).
   * Empates: o termo mais frequente.
   */
  suggest(text: string): string | null {
    const q = fold(text);
    if (q.length < 4 || /\s/.test(q)) return null;
    // Com o prefixo (palavra ainda sendo digitada), "princip" já encontra "principio":
    // não há o que corrigir.
    const [plo, phi] = this.prefixRange(q);
    if (plo < phi) return null;
    const [lo, hi] = this.prefixRange(q.slice(0, 2));
    let best: string | null = null;
    let bestDistance = Infinity;
    let bestFrequency = -1;
    for (let i = lo; i < hi; i++) {
      const term = this.terms[i];
      // A distância nunca é menor que a diferença de tamanho: corta cedo.
      if (Math.abs(term.length - q.length) > 2) continue;
      const d = editDistance(q, term);
      const f = this.frequency(i);
      if (d < bestDistance || (d === bestDistance && f > bestFrequency)) {
        best = term;
        bestDistance = d;
        bestFrequency = f;
      }
    }
    return best !== null && bestDistance <= 2 && best !== q ? best : null;
  }
}

export class TokenIndexBuilder {
  private map = new Map<string, number[]>();
  private count = 0;

  get size(): number {
    return this.count;
  }

  /** Acrescenta um documento e devolve seu número (ordem de inserção). */
  add(text: string): number {
    const id = this.count++;
    for (const token of tokenize(text)) {
      const list = this.map.get(token);
      if (!list) this.map.set(token, [id]);
      else if (list[list.length - 1] !== id) list.push(id);
    }
    return id;
  }

  finish(): TokenIndex {
    const terms = [...this.map.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const offsets = new Uint32Array(terms.length + 1);
    let total = 0;
    for (let i = 0; i < terms.length; i++) {
      offsets[i] = total;
      total += this.map.get(terms[i])!.length;
    }
    offsets[terms.length] = total;
    const postings = new Uint32Array(total);
    for (let i = 0; i < terms.length; i++) postings.set(this.map.get(terms[i])!, offsets[i]);
    this.map = new Map();
    return new TokenIndex(terms, offsets, postings, this.count);
  }
}

// --------------------------------------------------------------- registros
/** [categoria, id, título, trecho, fonte/módulo, referência] (scripts/build_data.py). */
export type SearchRecord = [string, string, string, string, string, string];
export interface RecordHit {
  r: SearchRecord;
  /** O título contém todos os termos (sobe para o topo). */
  t: boolean;
}

/** Grupo de limite de uma categoria (documentos de todos os tipos dividem o mesmo LIMIT 40). */
export function groupOf(category: string): Group {
  return category === 'topic' || category === 'studies' || category === 'lexicon' || category === 'commentary' || category === 'bible' || category === 'notes'
    ? category
    : 'documents';
}

/** Títulos que contêm a consulta primeiro; empates mantêm a ordem do acervo. */
export function titleFirst<T extends { t: boolean }>(items: T[]): T[] {
  return [...items.filter((x) => x.t), ...items.filter((x) => !x.t)];
}

// ------------------------------------------------------- especificações
export interface Segment {
  start: number;
  end: number;
  group: Group;
  /** Módulo dono dos registros do intervalo (documentos e comentários). */
  module?: string;
  /** false: módulo desinstalado — os candidatos nem chegam a ser baixados. */
  allowed: boolean;
}

export interface IndexSpec {
  name: 'general' | 'commentary';
  /** URL absoluta da pasta do pacote, terminada em "/". */
  base: string;
  /** Hash do pacote (?v=), o mesmo usado pelo cache do service worker. */
  version: string;
  shards: number;
  records: number;
  chunk: number;
  /** Disposição dos registros calculada do catálogo (null: desconhecida). */
  segments: Segment[] | null;
  /** Módulos instalados aceitos nos grupos documents/commentary. */
  allowed: string[];
  limits: Partial<Record<Group, number>>;
}

export const indexUrl = (spec: Pick<IndexSpec, 'base' | 'version'>, file: string) => `${spec.base}${file}?v=${spec.version}`;

export type BibleSource = { key: string; translation: string; books: number[] } & (
  | { kind: 'urls'; urls: string[] }
  | { kind: 'user'; module: string }
);

export interface UserSpec {
  id: string;
  kind: 'docs' | 'commentary';
  /** Muda quando o módulo é reinstalado (invalida o índice em memória). */
  stamp: string;
  books: number[];
}

export interface SearchRequest {
  text: string;
  query: Query;
  bible: BibleSource | null;
  indexes: IndexSpec[];
  user: UserSpec[];
  /** Sem limite de dados: consulta todos os blocos do índice. */
  deep: boolean;
}

export interface ErrorInfo {
  message: string;
  kind: 'offline' | 'missing' | 'http' | 'other';
  url?: string;
}

export interface BibleSection {
  name: 'bible';
  translation: string;
  /** [refKey, texto] em ordem canônica. */
  hits: [number, string][];
  suggestion: string | null;
  /** Livros da tradução e livros que não puderam ser lidos. */
  total: number;
  missing: number;
  offline: boolean;
  error?: ErrorInfo;
}
export interface RecordSection {
  name: 'general' | 'commentary' | 'user';
  groups: Partial<Record<Group, RecordHit[]>>;
  /** Blocos deixados de lado para economizar dados (veja NETWORK_BUDGET). */
  partial: boolean;
  /** Blocos indisponíveis sem conexão. */
  offline: boolean;
  error?: ErrorInfo;
}
export type SectionResult = BibleSection | RecordSection;

// ---------------------------------------------------- mensagens do worker
export type SearchWorkerRequest =
  | { id: number; type: 'search'; request: SearchRequest }
  | { id: number; type: 'warm'; bible: BibleSource }
  | { id: number; type: 'cancel' }
  | { id: number; type: 'clear' };
export type SearchWorkerMessage =
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'section'; section: SectionResult }
  | { id: number; type: 'error'; error: ErrorInfo }
  | { id: number; type: 'done' };

// --------------------------------------------------------------- serviço
export class SearchLoadError extends Error {
  constructor(
    readonly kind: 'offline' | 'missing' | 'http',
    readonly url: string,
    message?: string,
  ) {
    super(message ?? (kind === 'offline' ? 'offline' : kind === 'missing' ? 'missing' : 'http'));
    this.name = 'SearchLoadError';
  }
}
export class SearchCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'SearchCancelled';
  }
}

export function errorInfo(error: unknown): ErrorInfo {
  if (error instanceof SearchLoadError) return { message: error.message, kind: error.kind, url: error.url };
  const e = error as { name?: string; message?: string; url?: string } | null;
  if (e?.name === 'OfflineError') return { message: e.message ?? 'offline', kind: 'offline', url: e.url };
  if (e?.name === 'NotFoundError') return { message: e.message ?? 'missing', kind: 'missing', url: e.url };
  return { message: error instanceof Error ? error.message : String(error), kind: 'other' };
}

export interface SearchLoaders {
  /** JSON estático; falhas como SearchLoadError (offline/missing/http). */
  json(url: string): Promise<unknown>;
  /** O arquivo já está salvo no aparelho (cache do service worker)? */
  isCached?(url: string): Promise<boolean>;
  /** user_module_data[module, key].value do IndexedDB, ou null. */
  userData(module: string, key: string): Promise<unknown>;
  /** Cede a vez ao laço de eventos (mensagens novas, pintura). */
  pause?(): Promise<void>;
  now?(): number;
}

export interface RunContext {
  cancelled(): boolean;
  progress?(done: number, total: number): void;
  section(result: SectionResult): void;
}

interface BookLike {
  b?: number;
  c?: [number, string, unknown?][][];
}
type RawDoc = [string, string, string, string, string, unknown?, string?, string?, string?];
type RawComm = [string, number, number, string, string, ...unknown[]];

export interface BibleIndex {
  key: string;
  translation: string;
  index: TokenIndex;
  refs: Uint32Array;
  texts: string[];
  total: number;
  missing: number[];
  offline: boolean;
  builtAt: number;
}

interface UserIndex {
  index: TokenIndex;
  records: SearchRecord[];
}

class Lru<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

/** Executa as tarefas com concorrência limitada; as promessas seguem a ordem das tarefas. */
export function pooled<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T>[] {
  const slots = tasks.map(() => {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((a, b) => {
      resolve = a;
      reject = b;
    });
    promise.catch(() => undefined); // tratada por quem aguarda; evita aviso de rejeição solta
    return { promise, resolve, reject };
  });
  let next = 0;
  const launch = (): void => {
    if (next >= tasks.length) return;
    const i = next++;
    let started: Promise<T>;
    try {
      started = tasks[i]();
    } catch (error) {
      started = Promise.reject(error);
    }
    started.then(slots[i].resolve, slots[i].reject).finally(launch);
  };
  for (let k = 0; k < Math.min(concurrency, tasks.length); k++) launch();
  return slots.map((s) => s.promise);
}

const own = (o: Record<string, number[]>, key: string): number[] | undefined =>
  Object.prototype.hasOwnProperty.call(o, key) ? o[key] : undefined;

export type SearchService = ReturnType<typeof createSearchService>;

export function createSearchService(loaders: SearchLoaders) {
  const now = () => (loaders.now ? loaders.now() : Date.now());
  const shardCache = new Lru<Promise<Record<string, number[]>>>(SHARD_CACHE * 2);
  const chunkCache = new Lru<Promise<SearchRecord[]>>(CHUNK_CACHE * 2);
  const userCache = new Lru<Promise<UserIndex>>(USER_CACHE);
  const brokenLayouts = new Set<string>();
  let bible: {
    key: string;
    abort: { aborted: boolean };
    listeners: Set<(done: number, total: number) => void>;
    promise: Promise<BibleIndex>;
    index: BibleIndex | null;
    last: [number, number] | null;
  } | null = null;

  let sliceStart = now();
  async function breathe(force = false): Promise<void> {
    if (!loaders.pause) return;
    if (force || now() - sliceStart > SLICE_MS) {
      await loaders.pause();
      sliceStart = now();
    }
  }

  // ------------------------------------------------------------ Bíblia
  async function buildBible(source: BibleSource, abort: { aborted: boolean }, report: (d: number, t: number) => void): Promise<BibleIndex> {
    const builder = new TokenIndexBuilder();
    const refs: number[] = [];
    const texts: string[] = [];
    const total = source.books.length;
    const missing: number[] = [];
    let offline = false;
    let failure: unknown = null;
    const load = (i: number): Promise<unknown> =>
      source.kind === 'urls' ? loaders.json(source.urls[i]) : loaders.userData(source.module, `b:${source.books[i]}`);
    const pending = pooled(
      source.books.map((_, i) => () => (abort.aborted ? Promise.resolve(null) : load(i))),
      BOOK_CONCURRENCY,
    );
    report(0, total);
    for (let i = 0; i < total; i++) {
      if (abort.aborted) throw new SearchCancelled();
      let data: BookLike | null = null;
      try {
        data = (await pending[i]) as BookLike | null;
      } catch (error) {
        if (errorInfo(error).kind === 'offline') offline = true;
        else failure ??= error;
      }
      if (abort.aborted) throw new SearchCancelled();
      if (data && Array.isArray(data.c)) {
        const book = typeof data.b === 'number' ? data.b : source.books[i];
        for (let c = 0; c < data.c.length; c++) {
          for (const verse of data.c[c] ?? []) {
            if (!Array.isArray(verse) || typeof verse[1] !== 'string') continue;
            builder.add(verse[1]);
            refs.push(refKey({ book, chapter: c + 1, verse: verse[0] }));
            texts.push(verse[1]);
          }
          await breathe();
          if (abort.aborted) throw new SearchCancelled();
        }
      } else missing.push(source.books[i]);
      report(i + 1, total);
      await breathe();
    }
    if (refs.length === 0 && failure && !offline) throw failure;
    return {
      key: source.key,
      translation: source.translation,
      index: builder.finish(),
      refs: Uint32Array.from(refs),
      texts,
      total,
      missing,
      offline,
      builtAt: now(),
    };
  }

  function ensureBible(source: BibleSource, progress?: (d: number, t: number) => void): Promise<BibleIndex> {
    const current = bible;
    if (current && current.key === source.key) {
      const stale = current.index && current.index.missing.length > 0 && now() - current.index.builtAt > RETRY_INCOMPLETE_MS;
      if (!stale) {
        if (progress && !current.index) {
          current.listeners.add(progress);
          if (current.last) progress(...current.last);
        }
        return current.promise;
      }
    }
    if (current) current.abort.aborted = true;
    const entry: NonNullable<typeof bible> = {
      key: source.key,
      abort: { aborted: false },
      listeners: new Set(progress ? [progress] : []),
      promise: null as unknown as Promise<BibleIndex>,
      index: null,
      last: null,
    };
    entry.promise = buildBible(source, entry.abort, (d, t) => {
      entry.last = [d, t];
      for (const listener of entry.listeners) listener(d, t);
    }).then((index) => {
      entry.index = index;
      entry.listeners.clear();
      return index;
    });
    entry.promise.catch(() => {
      if (bible === entry) bible = null;
    });
    bible = entry;
    return entry.promise;
  }

  async function bibleSection(request: SearchRequest, ctx: RunContext): Promise<BibleSection | null> {
    const source = request.bible!;
    const listener = ctx.progress ? (d: number, t: number) => !ctx.cancelled() && ctx.progress!(d, t) : undefined;
    try {
      const index = await ensureBible(source, listener);
      if (ctx.cancelled()) return null;
      const ids = index.index.search(request.query, LIMITS.bible);
      return {
        name: 'bible',
        translation: source.translation,
        hits: ids.map((i) => [index.refs[i], index.texts[i]]),
        suggestion: index.index.suggest(request.text),
        total: index.total,
        missing: index.missing.length,
        offline: index.offline,
      };
    } finally {
      if (listener) bible?.listeners.delete(listener);
    }
  }

  // ---------------------------------------------------------- índices
  function loadShard(spec: IndexSpec, shard: number): Promise<Record<string, number[]>> {
    const url = indexUrl(spec, `p/${shard}.json`);
    let promise = shardCache.get(url);
    if (!promise) {
      promise = loaders.json(url).then(
        (value) => (value && typeof value === 'object' ? (value as Record<string, number[]>) : {}),
        (error) => {
          // Fragmento inexistente = nenhum termo nele.
          if (error instanceof SearchLoadError && error.kind === 'missing') return {};
          throw error;
        },
      );
      shardCache.set(url, promise);
      promise.catch(() => shardCache.delete(url));
    }
    return promise;
  }

  function loadChunk(spec: IndexSpec, chunk: number): Promise<SearchRecord[]> {
    const url = indexUrl(spec, `r/${chunk}.json`);
    let promise = chunkCache.get(url);
    if (!promise) {
      promise = loaders.json(url).then((value) => (Array.isArray(value) ? (value as SearchRecord[]) : []));
      chunkCache.set(url, promise);
      promise.catch(() => chunkCache.delete(url));
    }
    return promise;
  }

  async function candidates(spec: IndexSpec, q: Query): Promise<Uint32Array> {
    const wanted = new Set<number>([...q.exact, ...(q.prefix ? [q.prefix] : [])].map((t) => shardOf(t, spec.shards)));
    const shards = new Map<number, Record<string, number[]>>();
    await Promise.all(
      [...wanted].map(async (id) => {
        shards.set(id, await loadShard(spec, id));
      }),
    );
    const lists: Uint32Array[] = [];
    for (const term of q.exact) {
      const deltas = own(shards.get(shardOf(term, spec.shards))!, term);
      if (!deltas) return EMPTY;
      lists.push(decodeDeltas(deltas));
    }
    if (q.prefix) {
      const shard = shards.get(shardOf(q.prefix, spec.shards))!;
      const parts: Uint32Array[] = [];
      for (const key of Object.keys(shard)) if (key.startsWith(q.prefix)) parts.push(decodeDeltas(shard[key]));
      if (parts.length === 0) return EMPTY;
      lists.push(unionSorted(parts));
    }
    await breathe();
    return intersectAll(lists);
  }

  type Window = Map<Group | '*', number[]>;

  /** Primeiros candidatos de cada grupo (até WINDOW_FACTOR × limite), sem módulos desinstalados. */
  function windowOf(spec: IndexSpec, ids: Uint32Array, segments: Segment[] | null): Window {
    const windows: Window = new Map();
    if (!segments) {
      const total = Object.values(spec.limits).reduce((a, b) => a + (b ?? 0), 0);
      windows.set('*', Array.from(ids.subarray(0, total * WINDOW_FACTOR)));
      return windows;
    }
    let s = 0;
    for (const id of ids) {
      while (s < segments.length && segments[s].end <= id) s++;
      const segment = segments[s];
      if (!segment || id < segment.start || !segment.allowed) continue;
      const limit = spec.limits[segment.group];
      if (!limit) continue;
      let list = windows.get(segment.group);
      if (!list) windows.set(segment.group, (list = []));
      if (list.length < limit * WINDOW_FACTOR) list.push(id);
    }
    return windows;
  }

  async function collect(
    spec: IndexSpec,
    q: Query,
    ids: Uint32Array,
    segments: Segment[] | null,
    deep: boolean,
    section: RecordSection,
    ctx: RunContext,
  ): Promise<'ok' | 'mismatch'> {
    const windows = windowOf(spec, ids, segments);
    const needed = [...new Set([...windows.values()].flat().map((i) => Math.floor(i / spec.chunk)))].sort((a, b) => a - b);
    let budget = deep ? Infinity : NETWORK_BUDGET;
    const chosen: number[] = [];
    const inMemory = needed.map((chunk) => chunkCache.get(indexUrl(spec, `r/${chunk}.json`)) !== undefined);
    const onDevice = await Promise.all(
      needed.map((chunk, i) =>
        inMemory[i] || !loaders.isCached ? Promise.resolve(false) : loaders.isCached(indexUrl(spec, `r/${chunk}.json`)).catch(() => false),
      ),
    );
    for (let i = 0; i < needed.length; i++) {
      const chunk = needed[i];
      if (inMemory[i]) {
        chosen.push(chunk);
        continue;
      }
      const cached = onDevice[i];
      if (cached || budget > 0) {
        if (!cached) budget--;
        chosen.push(chunk);
      } else section.partial = true;
    }
    if (ctx.cancelled()) return 'ok';
    const loaded = new Map<number, SearchRecord[]>();
    const results = pooled(chosen.map((c) => () => loadChunk(spec, c)), CHUNK_CONCURRENCY);
    for (let i = 0; i < chosen.length; i++) {
      try {
        loaded.set(chosen[i], await results[i]);
      } catch (error) {
        const info = errorInfo(error);
        if (info.kind === 'offline') section.offline = true;
        else if (info.kind !== 'missing') section.error ??= info;
      }
    }
    await breathe();
    if (ctx.cancelled()) return 'ok';
    const allowed = new Set(spec.allowed);
    const permitted = (group: Group, r: SearchRecord) => (group === 'documents' || group === 'commentary' ? allowed.has(r[4]) : true);
    const lists = new Map<Group, (RecordHit & { id: number })[]>();
    const add = (group: Group, id: number, r: SearchRecord, title: boolean) => {
      let list = lists.get(group);
      if (!list) lists.set(group, (list = []));
      list.push({ id, r, t: title });
    };
    const recordAt = (id: number): SearchRecord | undefined => {
      const chunk = loaded.get(Math.floor(id / spec.chunk));
      const r = chunk?.[id % spec.chunk];
      return Array.isArray(r) ? r : undefined;
    };
    /** Confere a disposição deduzida do catálogo; se não bater, refaz sem ela. */
    const fits = (segment: Segment | undefined, group: Group, r: SearchRecord) =>
      !!segment && groupOf(r[0]) === group && (segment.module === undefined || segment.module === r[4]);
    const inWindow = new Set<number>();
    for (const [group, list] of windows) {
      let s = 0;
      for (const id of list) {
        inWindow.add(id);
        const r = recordAt(id);
        if (!r) continue;
        if (group === '*') {
          const g = groupOf(r[0]);
          if (!spec.limits[g] || !permitted(g, r)) continue;
          if ((lists.get(g)?.length ?? 0) < spec.limits[g]! * WINDOW_FACTOR) add(g, id, r, matchesText(r[2], q));
          continue;
        }
        while (segments && s < segments.length && segments[s].end <= id) s++;
        if (!fits(segments?.[s], group, r)) return 'mismatch';
        if (permitted(group, r)) add(group, id, r, matchesText(r[2], q));
      }
    }
    // Títulos que contêm a consulta em blocos JÁ carregados também sobem ao topo,
    // mesmo fora da janela (ex.: o tema "Graça" no meio da ordem alfabética), sem
    // baixar nada a mais.
    let s = 0;
    let scanned = 0;
    for (const id of ids) {
      if (inWindow.has(id) || !loaded.has(Math.floor(id / spec.chunk))) continue;
      let segment: Segment | undefined;
      if (segments) {
        while (s < segments.length && segments[s].end <= id) s++;
        segment = segments[s];
        if (!segment || id < segment.start || !segment.allowed || !spec.limits[segment.group]) continue;
      }
      const r = recordAt(id);
      if (!r) continue;
      const group: Group = segment ? segment.group : groupOf(r[0]);
      if (segment && !fits(segment, group, r)) return 'mismatch';
      if (!spec.limits[group] || !permitted(group, r)) continue;
      if (++scanned % 512 === 0) {
        await breathe();
        if (ctx.cancelled()) return 'ok';
      }
      if (matchesText(r[2], q)) add(group, id, r, true);
    }
    for (const [group, list] of lists) {
      list.sort((a, b) => a.id - b.id);
      section.groups[group] = titleFirst(list)
        .slice(0, spec.limits[group])
        .map(({ r, t }) => ({ r, t }));
    }
    return 'ok';
  }

  async function indexSection(spec: IndexSpec, request: SearchRequest, ctx: RunContext): Promise<RecordSection | null> {
    const section: RecordSection = { name: spec.name, groups: {}, partial: false, offline: false };
    const ids = await candidates(spec, request.query);
    if (ctx.cancelled()) return null;
    if (ids.length === 0) return section;
    const layoutKey = `${spec.name}:${spec.version}`;
    const segments = spec.segments && !brokenLayouts.has(layoutKey) ? spec.segments : null;
    if ((await collect(spec, request.query, ids, segments, request.deep, section, ctx)) === 'mismatch') {
      brokenLayouts.add(layoutKey);
      const retry: RecordSection = { name: spec.name, groups: {}, partial: false, offline: false };
      await collect(spec, request.query, ids, null, request.deep, retry, ctx);
      return ctx.cancelled() ? null : retry;
    }
    return ctx.cancelled() ? null : section;
  }

  // ------------------------------------------------- módulos importados
  async function buildUser(spec: UserSpec): Promise<UserIndex> {
    const builder = new TokenIndexBuilder();
    const records: SearchRecord[] = [];
    if (spec.kind === 'docs') {
      const docs = ((await loaders.userData(spec.id, 'docs')) as RawDoc[] | null) ?? [];
      for (const d of docs) {
        if (!Array.isArray(d)) continue;
        // Como build_data.py: título e corpo em português quando o pacote os traz.
        const title = typeof d[6] === 'string' && d[6] ? d[6] : String(d[2] ?? '');
        const body = typeof d[7] === 'string' && d[7] ? d[7] : String(d[3] ?? '');
        records.push([String(d[1] ?? ''), String(d[0]), title, snippet(body), spec.id, String(d[4] ?? '')]);
        builder.add([d[2], d[3], d[6], d[7]].filter((x) => typeof x === 'string').join(' '));
        await breathe();
      }
    } else {
      const seen = new Set<string>();
      for (const book of spec.books) {
        const rows = ((await loaders.userData(spec.id, `c:${book}`)) as RawComm[] | null) ?? [];
        for (const c of rows) {
          if (!Array.isArray(c) || seen.has(String(c[0]))) continue;
          seen.add(String(c[0]));
          const title = typeof c[7] === 'string' && c[7].trim() ? c[7] : String(c[3] ?? '');
          const body = typeof c[8] === 'string' && c[8] ? c[8] : String(c[4] ?? '');
          records.push(['commentary', String(c[0]), title, snippet(body), spec.id, refId(keyToRef(Number(c[1])))]);
          builder.add([c[3], c[4], c[7], c[8]].filter((x) => typeof x === 'string').join(' '));
        }
        await breathe();
      }
    }
    return { index: builder.finish(), records };
  }

  function userIndex(spec: UserSpec): Promise<UserIndex> {
    const key = `${spec.id}|${spec.kind}|${spec.stamp}`;
    let promise = userCache.get(key);
    if (!promise) {
      promise = buildUser(spec);
      userCache.set(key, promise);
      promise.catch(() => userCache.delete(key));
    }
    return promise;
  }

  async function userSection(request: SearchRequest, ctx: RunContext): Promise<RecordSection | null> {
    const section: RecordSection = { name: 'user', groups: {}, partial: false, offline: false };
    const lists = new Map<Group, RecordHit[]>();
    for (const spec of request.user) {
      try {
        const { index, records } = await userIndex(spec);
        if (ctx.cancelled()) return null;
        const group: Group = spec.kind === 'commentary' ? 'commentary' : 'documents';
        let list = lists.get(group);
        if (!list) lists.set(group, (list = []));
        // Tudo em memória: os títulos de todos os candidatos podem subir ao topo.
        let n = 0;
        for (const i of index.search(request.query, USER_SCAN)) {
          list.push({ r: records[i], t: matchesText(records[i][2], request.query) });
          if (++n % 512 === 0) await breathe();
        }
        if (ctx.cancelled()) return null;
      } catch (error) {
        section.error ??= errorInfo(error);
      }
    }
    for (const [group, list] of lists) section.groups[group] = titleFirst(list).slice(0, LIMITS[group]);
    return section;
  }

  // ---------------------------------------------------------- execução
  async function guarded<T extends SectionResult>(
    name: SectionResult['name'],
    work: () => Promise<T | null>,
    ctx: RunContext,
    translation = '',
  ): Promise<void> {
    try {
      const result = await work();
      if (result && !ctx.cancelled()) ctx.section(result);
    } catch (error) {
      if (error instanceof SearchCancelled || ctx.cancelled()) return;
      const info = errorInfo(error);
      ctx.section(
        name === 'bible'
          ? { name, translation, hits: [], suggestion: null, total: 0, missing: 0, offline: info.kind === 'offline', error: info }
          : { name, groups: {}, partial: false, offline: info.kind === 'offline', error: info },
      );
    }
  }

  return {
    /** Executa a pesquisa; cada seção é entregue assim que fica pronta. */
    async run(request: SearchRequest, ctx: RunContext): Promise<void> {
      if (isEmptyQuery(request.query)) return;
      const jobs: Promise<void>[] = [];
      for (const spec of request.indexes) jobs.push(guarded(spec.name, () => indexSection(spec, request, ctx), ctx));
      if (request.user.length) jobs.push(guarded('user', () => userSection(request, ctx), ctx));
      if (request.bible) jobs.push(guarded('bible', () => bibleSection(request, ctx), ctx, request.bible.translation));
      await Promise.all(jobs);
    },
    /** Prepara o índice bíblico antes da primeira consulta. */
    async warm(source: BibleSource, progress?: (d: number, t: number) => void): Promise<void> {
      try {
        await ensureBible(source, progress);
      } finally {
        if (progress) bible?.listeners.delete(progress);
      }
    },
    clear(): void {
      if (bible) bible.abort.aborted = true;
      bible = null;
      shardCache.clear();
      chunkCache.clear();
      userCache.clear();
    },
    /** Apenas para testes e diagnóstico. */
    bibleIndex: () => bible?.index ?? null,
  };
}

// ------------------------------------------------------------- resultado
export interface SearchHit {
  /** categoria:id — chave de deduplicação, como no original. */
  key: string;
  category: string;
  id: string;
  title: string;
  body: string;
  source: string;
  reference: string;
  titleMatch: boolean;
}

export function recordHit(h: RecordHit): SearchHit {
  const [category, id, title, body, source, reference] = h.r;
  return {
    key: `${category}:${id}`,
    category: String(category),
    id: String(id),
    title: String(title ?? ''),
    body: cleanSnippet(String(body ?? '')),
    source: String(source ?? ''),
    reference: String(reference ?? ''),
    titleMatch: h.t,
  };
}

/** Junta listas da mesma categoria (acervo + módulos importados) mantendo o limite. */
export function combine(lists: (SearchHit[] | undefined)[], limit: number): SearchHit[] {
  const all = lists.flatMap((l) => l ?? []).map((h) => ({ h, t: h.titleMatch }));
  return titleFirst(all)
    .slice(0, limit)
    .map((x) => x.h);
}

/** Ordem final (temas, Bíblia, anotações, documentos, estudos, comentários, léxico) sem repetições. */
export function mergeHits(parts: Partial<Record<Group, SearchHit[]>>): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const group of GROUP_ORDER) {
    for (const hit of parts[group] ?? []) {
      if (seen.has(hit.key)) continue;
      seen.add(hit.key);
      out.push(hit);
    }
  }
  return out;
}

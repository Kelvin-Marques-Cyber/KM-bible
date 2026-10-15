// Pesquisa geral (store.search, suggestion e fts de lib/store.dart) sobre o
// acervo estático: Bíblia (índice montado no Web Worker a partir de todos os
// livros da tradução), índices invertidos do acervo (temas, documentos,
// estudos, léxico e comentários), módulos importados e anotações pessoais.
// Tudo local; com o service worker, funciona sem internet quando os pacotes
// já estão salvos no aparelho.
import { catalog, dataBase, packUrl } from './catalog';
import { installed, module, modules, userModule, userModuleList } from './content';
import { get, isMemoryOnly } from './db';
import { fromId, keyToRef, refId, refKey, refLabel, tokenize } from './domain';
import { lang, t, tr } from './i18n';
import { notes } from './store';
import {
  combine,
  createSearchService,
  errorInfo,
  isEmptyQuery,
  LIMITS,
  mergeHits,
  parseQuery,
  recordHit,
  SearchLoadError,
  snippet,
  tokensMatch,
  type BibleSection,
  type BibleSource,
  type ErrorInfo,
  type Group,
  type IndexSpec,
  type Query,
  type RecordSection,
  type SearchHit,
  type SearchRequest,
  type SearchService,
  type SearchWorkerMessage,
  type SearchWorkerRequest,
  type SectionResult,
  type Segment,
  type UserSpec,
} from './search-core';

export type { Query, SearchHit } from './search-core';
export { highlightParts, parseQuery } from './search-core';

// -------------------------------------------------------------- rótulos
/** Nomes legíveis das categorias (o original mostrava o identificador interno). */
export function categoryLabel(category: string): string {
  switch (category) {
    case 'bible':
      return t('bible');
    case 'commentary':
      return t('commentaries');
    case 'notes':
      return t('notes');
    case 'topic':
      return tr('Temas', 'Topics', 'Temas');
    case 'lexicon':
      return tr('Léxico', 'Lexicon', 'Léxico');
    case 'studies':
      return t('studies');
    case 'confession':
      return tr('Confissões', 'Confessions', 'Confesiones');
    case 'place':
      return tr('Lugares', 'Places', 'Lugares');
    case 'history':
      return tr('Acontecimentos', 'Events', 'Acontecimientos');
    case 'model_index':
      return tr('Modelos 3D', '3D models', 'Modelos 3D');
    case 'study':
      return tr('Estudos editoriais', 'Editorial studies', 'Estudios editoriales');
    default:
      return tr('Documentos', 'Documents', 'Documentos');
  }
}

const MODULE_SOURCES = new Set(['bible', 'notes', 'topic', 'lexicon', 'studies']);

/** Fonte mostrada ao lado da categoria: título do módulo quando houver. */
export function sourceLabel(hit: SearchHit): string {
  if (MODULE_SOURCES.has(hit.category)) return hit.source;
  return module(hit.source)?.title ?? hit.source;
}

const REF_ONLY = /^[\d:\s·—–-]+$/;

/**
 * Título exibido. Vários comentários do acervo têm como título só os
 * identificadores internos ("40:1:22 · 40:1:22"): mostramos a referência legível.
 */
export function hitTitle(hit: SearchHit, language: string = lang()): string {
  const title = hit.title.trim();
  if (hit.category !== 'commentary' || (title && !REF_ONLY.test(title))) return title || hit.id;
  const ids = (title.match(/\d+:\d+:\d+/g) ?? []).map(fromId);
  const start = fromId(hit.reference) ?? ids[0] ?? null;
  if (!start) return title || hit.id;
  const label = refLabel(start, language);
  const end = ids.length > 1 ? ids[ids.length - 1] : null;
  if (!end || end.book !== start.book || refKey(end) <= refKey(start)) return label;
  return end.chapter === start.chapter ? `${label}–${end.verse}` : `${label}–${end.chapter}:${end.verse}`;
}

// ------------------------------------------------- worker (singleton)
interface Listener {
  progress?(done: number, total: number): void;
  section?(section: SectionResult): void;
  error?(error: ErrorInfo): void;
  done(): void;
}
type Outgoing = Extract<SearchWorkerRequest, { type: 'search' | 'warm' }>;
type OutgoingBody = { type: 'search'; request: SearchRequest } | { type: 'warm'; bible: BibleSource };

let worker: Worker | null = null;
let workerBroken = false;
let fallback: SearchService | null = null;
let nextId = 0;
const pending = new Map<number, { message: Outgoing; listener: Listener }>();
const fallbackRunning = new Set<number>();
const fallbackCancelled = new Set<number>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../workers/search.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    workerBroken = true;
    return null;
  }
  worker.onmessage = (event: MessageEvent<SearchWorkerMessage>) => {
    const message = event.data;
    const entry = pending.get(message.id);
    if (!entry) return;
    const { listener } = entry;
    if (message.type === 'progress') listener.progress?.(message.done, message.total);
    else if (message.type === 'section') listener.section?.(message.section);
    else if (message.type === 'error') listener.error?.(message.error);
    else {
      pending.delete(message.id);
      listener.done();
    }
  };
  worker.onerror = (event) => {
    // Navegador sem worker de módulo (ou falha ao carregá-lo): segue na thread principal.
    event.preventDefault?.();
    workerBroken = true;
    worker?.terminate();
    worker = null;
    const entries = [...pending];
    pending.clear();
    for (const [id, entry] of entries) runFallback(id, entry.message, entry.listener);
  };
  return worker;
}

async function fallbackJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new SearchLoadError('offline', url);
  }
  if (response.status === 404) throw new SearchLoadError('missing', url);
  if (response.status === 503 || response.status === 504) throw new SearchLoadError('offline', url);
  if (!response.ok) throw new SearchLoadError('http', url, `HTTP ${response.status}`);
  return response.json();
}

const idle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function fallbackService(): SearchService {
  return (fallback ??= createSearchService({
    json: fallbackJson,
    isCached: async (url) => {
      try {
        return typeof caches !== 'undefined' && (await caches.match(url)) !== undefined;
      } catch {
        return false;
      }
    },
    userData: async (module, key) => (await get<{ value?: unknown }>('user_module_data', [module, key]))?.value ?? null,
    pause: idle,
    now: () => performance.now(),
  }));
}

function runFallback(id: number, message: Outgoing, listener: Listener): void {
  const service = fallbackService();
  const alive = () => !fallbackCancelled.has(id);
  fallbackRunning.add(id);
  void (async () => {
    try {
      if (message.type === 'warm') await service.warm(message.bible, (d, t) => alive() && listener.progress?.(d, t));
      else
        await service.run(message.request, {
          cancelled: () => !alive(),
          progress: (d, t) => alive() && listener.progress?.(d, t),
          section: (s) => alive() && listener.section?.(s),
        });
    } catch (error) {
      if (alive()) listener.error?.(errorInfo(error));
    } finally {
      if (alive()) listener.done();
      fallbackRunning.delete(id);
      fallbackCancelled.delete(id);
    }
  })();
}

const usesImported = (body: OutgoingBody) =>
  body.type === 'warm' ? body.bible.kind === 'user' : body.request.user.length > 0 || body.request.bible?.kind === 'user';

function dispatch(body: OutgoingBody, listener: Listener): () => void {
  const id = ++nextId;
  const message = { ...body, id } as Outgoing;
  // Banco só em memória (navegação privada): o worker não enxerga os módulos
  // importados; só essas consultas ficam na thread principal.
  const w = isMemoryOnly() && usesImported(body) ? null : getWorker();
  if (w) {
    pending.set(id, { message, listener });
    w.postMessage(message);
    return () => {
      if (pending.delete(id)) worker?.postMessage({ id, type: 'cancel' } satisfies SearchWorkerRequest);
    };
  }
  runFallback(id, message, listener);
  return () => {
    if (fallbackRunning.has(id)) fallbackCancelled.add(id);
  };
}

let users = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/** A tela de pesquisa mantém o índice vivo enquanto aberta. */
export function retainSearch(): void {
  users++;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}

/** Sem uso por alguns minutos, o worker é encerrado para liberar memória. */
export function releaseSearch(delay = 5 * 60_000): void {
  users = Math.max(0, users - 1);
  if (users > 0) return;
  if (idleTimer) clearTimeout(idleTimer);
  const check = () => {
    idleTimer = null;
    if (users > 0) return;
    // Ainda há consultas em andamento (ex.: o índice bíblico sendo montado): espera mais.
    if (pending.size > 0 || fallbackRunning.size > 0) {
      idleTimer = setTimeout(check, delay);
      return;
    }
    worker?.terminate();
    worker = null;
    fallback?.clear();
    fallback = null;
  };
  idleTimer = setTimeout(check, delay);
}

// ------------------------------------------------------- especificações
function bibleSource(translation: string): BibleSource | null {
  const user = userModule(translation);
  if (user) {
    if (!user.enabled) return null;
    const books = Object.keys(user.books ?? {})
      .map(Number)
      .sort((a, b) => a - b);
    return { kind: 'user', key: `user:${translation}:${user.installedAt}:${user.bytes}`, translation, module: translation, books };
  }
  const pack = catalog.bibles[translation];
  if (!pack || !installed(translation)) return null;
  const books = Object.keys(pack.chapters)
    .map(Number)
    .sort((a, b) => a - b);
  // URLs absolutas (o worker não conhece a base da página); as mesmas do cache do service worker.
  return { kind: 'urls', key: `${translation}:${pack.hash}`, translation, books, urls: books.map((b) => packUrl(pack, `${b}.json`)) };
}

function layout(entries: [number, Group, string?][], records: number, allowed: Set<string>): Segment[] | null {
  const segments: Segment[] = [];
  let at = 0;
  for (const [count, group, owner] of entries) {
    if (!Number.isInteger(count) || count < 0) return null;
    if (count > 0) segments.push({ start: at, end: at + count, group, module: owner, allowed: owner === undefined || allowed.has(owner) });
    at += count;
  }
  return at === records ? segments : null;
}

/**
 * Disposição dos registros de search/general (build_data.py): temas, documentos
 * por módulo (ordem do catálogo), estudos de apologética e léxico. Permite
 * descartar módulos desinstalados antes de baixar qualquer bloco.
 */
export function generalSegments(allowed: Set<string>): Segment[] | null {
  const pack = catalog.search.general;
  const topics = catalog.topics?.topics;
  const lexemes = catalog.lexicon?.lexemes;
  if (!Number.isInteger(topics) || !Number.isInteger(lexemes)) return null;
  const docs = Object.entries(catalog.docs.modules).map(([id, info]) => [info.count, 'documents', id] as [number, Group, string]);
  const studies = pack.records - topics - lexemes - docs.reduce((sum, [n]) => sum + n, 0);
  return layout([[topics, 'topic'], ...docs, [studies, 'studies'], [lexemes, 'lexicon']], pack.records, allowed);
}

export function commentarySegments(allowed: Set<string>): Segment[] | null {
  const entries = Object.entries(catalog.commentaries).map(([id, pack]) => [pack.entries, 'commentary', id] as [number, Group, string]);
  return layout(entries, catalog.search.commentary.records, allowed);
}

function indexSpec(name: 'general' | 'commentary', allowed: string[], limits: Partial<Record<Group, number>>): IndexSpec {
  const pack = catalog.search[name];
  const set = new Set(allowed);
  return {
    name,
    base: `${dataBase()}${pack.path}/`,
    version: pack.hash,
    shards: pack.shards,
    records: pack.records,
    chunk: pack.chunk,
    segments: name === 'general' ? generalSegments(set) : commentarySegments(set),
    allowed,
    limits,
  };
}

function userSpecs(): UserSpec[] {
  const specs: UserSpec[] = [];
  for (const m of userModuleList()) {
    if (!installed(m.id)) continue;
    const kind = String(m.manifest.kind);
    if (kind === 'bible' || kind === 'lexicon') continue;
    const stamp = `${m.installedAt}:${m.bytes}`;
    if (kind === 'commentary') specs.push({ id: m.id, kind: 'commentary', stamp, books: m.commentaryBooks ?? [] });
    else specs.push({ id: m.id, kind: 'docs', stamp, books: [] });
  }
  return specs;
}

export function buildRequest(text: string, translation: string, deep = false): SearchRequest {
  const docs = Object.keys(catalog.docs.modules).filter((id) => installed(id));
  const commentaries = modules('commentary', true).map((m) => m.id);
  return {
    text,
    query: parseQuery(text),
    bible: bibleSource(translation),
    indexes: [
      indexSpec('general', docs, { topic: LIMITS.topic, documents: LIMITS.documents, studies: LIMITS.studies, lexicon: LIMITS.lexicon }),
      indexSpec('commentary', commentaries, { commentary: LIMITS.commentary }),
    ],
    user: userSpecs(),
    deep,
  };
}

// ---------------------------------------------------------- anotações
const noteTokens = new Map<string, { stamp: number; tokens: Set<string> }>();

/** note_search do original: título, corpo e etiquetas; até 40 anotações. */
export async function searchNotes(q: Query, alive: () => boolean = () => true): Promise<SearchHit[] | null> {
  const list = await notes();
  const out: SearchHit[] = [];
  let start = performance.now();
  let complete = true;
  for (const n of list) {
    let entry = noteTokens.get(n.id);
    if (!entry || entry.stamp !== n.updated_at) {
      entry = { stamp: n.updated_at, tokens: new Set(tokenize(`${n.title} ${n.body} ${n.tags}`)) };
      noteTokens.set(n.id, entry);
    }
    if (tokensMatch(entry.tokens, q)) {
      out.push({
        key: `notes:${n.id}`,
        category: 'notes',
        id: n.id,
        title: n.title || t('newNote'),
        body: snippet(n.body),
        source: n.notebook,
        reference: n.reference,
        titleMatch: false,
      });
      if (out.length >= LIMITS.notes) {
        complete = false;
        break;
      }
    }
    if (performance.now() - start > 12) {
      await idle();
      if (!alive()) return null;
      start = performance.now();
    }
  }
  if (complete) {
    const live = new Set(list.map((n) => n.id));
    for (const id of [...noteTokens.keys()]) if (!live.has(id)) noteTokens.delete(id);
  }
  return out;
}

// -------------------------------------------------------------- pesquisa
export interface SearchState {
  text: string;
  query: Query;
  hits: SearchHit[];
  suggestion: string | null;
  /** Ainda há seções em andamento. */
  loading: boolean;
  /** Preparação do índice bíblico (livros lidos / total). */
  progress: { done: number; total: number } | null;
  /** Tradução pesquisada e livros que ficaram de fora (sem conexão). */
  bible: { translation: string; total: number; missing: number; offline: boolean } | null;
  /** Parte do índice não está salva no aparelho e não há conexão. */
  offline: boolean;
  /** Blocos deixados de lado para economizar dados. */
  partial: boolean;
  /** Falhas não relacionadas à conexão (mensagens legíveis). */
  errors: string[];
  /** Nenhuma seção funcionou: erro para a ErrorBox. */
  failed: Error | null;
}

export interface SearchOptions {
  translation: string;
  /** Consulta todos os blocos dos índices, sem limite de dados. */
  deep?: boolean;
}

function readable(section: string, error: ErrorInfo): string {
  if (error.kind === 'other') return error.message;
  const what =
    section === 'bible'
      ? tr('o texto bíblico', 'the Bible text', 'el texto bíblico')
      : section === 'notes'
        ? t('notes').toLowerCase()
        : section === 'user'
          ? tr('os módulos importados', 'the imported modules', 'los módulos importados')
          : tr('o índice de pesquisa', 'the search index', 'el índice de búsqueda');
  return tr(`Não foi possível ler ${what}.`, `Could not read ${what}.`, `No se pudo leer ${what}.`);
}

/**
 * Inicia uma pesquisa; onUpdate recebe o estado a cada seção concluída. A
 * função devolvida cancela a consulta (a próxima digitação descarta a anterior).
 */
export function startSearch(text: string, options: SearchOptions, onUpdate: (state: SearchState) => void): () => void {
  const query = parseQuery(text);
  const empty: SearchState = {
    text,
    query,
    hits: [],
    suggestion: null,
    loading: false,
    progress: null,
    bible: null,
    offline: false,
    partial: false,
    errors: [],
    failed: null,
  };
  if (isEmptyQuery(query)) {
    onUpdate(empty);
    return () => undefined;
  }
  const language = lang();
  let alive = true;
  let workerDone = false;
  let notesDone = false;
  let notesHits: SearchHit[] = [];
  let notesError: ErrorInfo | null = null;
  let workerError: ErrorInfo | null = null;
  let progress: SearchState['progress'] = null;
  const records: Partial<Record<'general' | 'commentary' | 'user', { section: RecordSection; groups: Partial<Record<Group, SearchHit[]>> }>> = {};
  let bible: { section: BibleSection; hits: SearchHit[] } | null = null;
  const request = buildRequest(text, options.translation, options.deep === true);
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let first = true;

  const compose = (): SearchState => {
    const group = (name: 'general' | 'commentary' | 'user', g: Group) => records[name]?.groups[g];
    const hits = mergeHits({
      topic: group('general', 'topic'),
      bible: bible?.hits,
      notes: notesHits,
      documents: combine([group('general', 'documents'), group('user', 'documents')], LIMITS.documents),
      studies: group('general', 'studies'),
      commentary: combine([group('commentary', 'commentary'), group('user', 'commentary')], LIMITS.commentary),
      lexicon: group('general', 'lexicon'),
    });
    const sections: { name: string; error?: ErrorInfo; offline: boolean }[] = [
      ...Object.values(records).map((r) => r!.section),
      ...(bible ? [bible.section] : []),
    ];
    const errors: string[] = [];
    let offline = false;
    for (const s of sections) {
      if (s.offline || s.error?.kind === 'offline') offline = true;
      if (s.error && s.error.kind !== 'offline') errors.push(readable(s.name, s.error));
    }
    if (notesError) errors.push(readable('notes', notesError));
    if (workerError) {
      if (workerError.kind === 'offline') offline = true;
      else errors.push(readable('search', workerError));
    }
    const loading = !(workerDone && notesDone);
    // Sem conexão não é falha: o aviso explica e mostramos o que estiver salvo.
    const realError = (e?: ErrorInfo | null) => !!e && e.kind !== 'offline';
    const allFailed =
      !loading &&
      hits.length === 0 &&
      (realError(workerError) || (sections.length > 0 && sections.every((s) => realError(s.error)) && (realError(notesError) || notesHits.length === 0)));
    return {
      text,
      query,
      hits,
      suggestion: bible?.section.suggestion ?? null,
      loading,
      progress: bible ? null : progress,
      bible: bible ? { translation: bible.section.translation, total: bible.section.total, missing: bible.section.missing, offline: bible.section.offline } : null,
      offline,
      partial: Object.values(records).some((r) => r!.section.partial),
      errors: [...new Set(errors)],
      failed: allFailed ? new Error(errors[0] ?? t('empty')) : null,
    };
  };

  const flush = () => {
    timer = null;
    if (!alive) return;
    first = false;
    onUpdate(compose());
  };
  // A primeira entrega espera um pouco (até 250 ms) para não "piscar" a lista
  // com resultados parciais; depois, cada novidade aparece logo.
  const schedule = () => {
    if (!alive) return;
    const finished = workerDone && notesDone;
    if (timer && !finished) return;
    if (timer) clearTimeout(timer);
    const wait = finished ? 0 : first ? Math.max(0, 250 - (performance.now() - started)) : 32;
    timer = setTimeout(flush, wait);
  };

  const cancel = dispatch(
    { type: 'search', request },
    {
      progress(done, total) {
        progress = { done, total };
        schedule();
      },
      section(section) {
        if (section.name === 'bible') {
          bible = {
            section,
            hits: section.hits.map(([key, verse]) => {
              const r = keyToRef(key);
              const id = refId(r);
              return { key: `bible:${id}`, category: 'bible', id, title: refLabel(r, language), body: verse, source: section.translation, reference: id, titleMatch: false };
            }),
          };
        } else {
          const groups: Partial<Record<Group, SearchHit[]>> = {};
          for (const [g, list] of Object.entries(section.groups)) groups[g as Group] = (list ?? []).map(recordHit);
          records[section.name] = { section, groups };
        }
        schedule();
      },
      error(error) {
        workerError = error;
        schedule();
      },
      done() {
        workerDone = true;
        schedule();
      },
    },
  );

  searchNotes(query, () => alive).then(
    (hits) => {
      if (hits === null) return;
      notesHits = hits;
      notesDone = true;
      schedule();
    },
    (error) => {
      notesError = errorInfo(error);
      notesDone = true;
      schedule();
    },
  );

  return () => {
    alive = false;
    if (timer) clearTimeout(timer);
    cancel();
  };
}

/** Prepara o índice bíblico em segundo plano ao abrir a pesquisa (exceto com economia de dados). */
export function warmBible(translation: string, onProgress?: (progress: { done: number; total: number } | null) => void): () => void {
  const source = bibleSource(translation);
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (!source || connection?.saveData) return () => undefined;
  let alive = true;
  const cancel = dispatch(
    { type: 'warm', bible: source },
    {
      progress: (done, total) => alive && onProgress?.(done < total ? { done, total } : null),
      error: () => alive && onProgress?.(null),
      done: () => alive && onProgress?.(null),
    },
  );
  return () => {
    alive = false;
    cancel();
  };
}

// Gerenciador de conteúdo offline. O service worker (scripts/sw-template.js) já
// guarda em "km-data-v1", por ordem de uso, tudo o que é lido; aqui o usuário
// baixa grupos inteiros de antemão (ou TUDO, para usar 100% sem internet).
//
// Regras: concorrência 4 (3 no iOS), novas tentativas com espera, cancelamento,
// retomada (o que já está no cache é pulado), verificação de espaço antes de
// começar e corpos de resposta nunca retidos na memória: cada Response vai
// direto para cache.put().
import { catalog, dataBase, packUrl } from './catalog';
import { modules, userModule } from './content';
import { tr } from './i18n';
import { platform, requestPersistence } from './pwa';

export const DATA_CACHE = 'km-data-v1';
/** localStorage: "1" quando o download completo terminou sem falhas. */
export const FULL_FLAG = 'km-offline-full';
/** Cabeçalho que avisa o service worker de que a própria página grava no cache. */
export const DOWNLOAD_HEADER = 'X-KM-Download';

export type FilesIndex = Record<string, { hash: string; files: string[] }>;

export interface OfflinePack {
  path: string;
  hash: string;
  bytes: number;
  /** Tamanho individual conhecido de alguns arquivos (modelos 3D). */
  sizes?: Record<string, number>;
}

export type GroupKind = 'bible' | 'commentary' | 'xref' | 'original' | 'topics' | 'documents' | 'search' | 'models';

export interface OfflineGroup {
  id: string;
  kind: GroupKind;
  title: string;
  description: string;
  packs: OfflinePack[];
  /** Soma dos bytes do catálogo. */
  bytes: number;
}

export interface DownloadItem {
  url: string;
  bytes: number;
}

export interface DownloadProgress {
  total: number;
  /** Arquivos prontos no cache (inclui os que já estavam). */
  done: number;
  /** Já estavam no cache antes de começar. */
  skipped: number;
  failed: number;
  bytesTotal: number;
  bytesDone: number;
}

export interface DownloadResult extends DownloadProgress {
  cancelled: boolean;
  failures: string[];
}

export interface GroupStatus {
  present: number;
  total: number;
  bytesPresent: number;
  bytes: number;
}

// ------------------------------------------------------------------ erros
export class OfflineUnsupportedError extends Error {
  constructor() {
    super(
      tr(
        'Este navegador não permite guardar conteúdo para uso offline (Cache API indisponível). Use um navegador atualizado ou instale o aplicativo.',
        'This browser cannot store content for offline use (Cache API unavailable). Use an up-to-date browser or install the app.',
        'Este navegador no permite guardar contenido sin conexión (Cache API no disponible). Use un navegador actualizado o instale la aplicación.',
      ),
    );
    this.name = 'OfflineUnsupportedError';
  }
}

export class OfflineQuotaError extends Error {
  constructor(
    public needed: number,
    public available: number | null,
  ) {
    super(
      available === null
        ? tr(
            'O armazenamento do navegador está cheio. Libere espaço no aparelho ou baixe só alguns grupos abaixo.',
            'Browser storage is full. Free up space on this device or download only some of the groups below.',
            'El almacenamiento del navegador está lleno. Libere espacio o descargue solo algunos grupos.',
          )
        : tr(
            `Espaço insuficiente: são necessários cerca de ${formatSize(needed)}, mas o navegador permite usar só ${formatSize(available)}. Libere espaço no aparelho ou baixe só alguns grupos abaixo (por exemplo, a sua tradução e as referências cruzadas).`,
            `Not enough space: about ${formatSize(needed)} is needed, but the browser allows only ${formatSize(available)}. Free up space or download only some groups below (for example, your translation and cross references).`,
            `Espacio insuficiente: se necesitan unos ${formatSize(needed)}, pero el navegador solo permite ${formatSize(available)}. Libere espacio o descargue solo algunos grupos.`,
          ),
    );
    this.name = 'OfflineQuotaError';
  }
}

export class OfflineIndexError extends Error {
  constructor() {
    super(
      tr(
        'Não foi possível carregar a lista de arquivos do acervo. Conecte-se à internet e tente novamente.',
        'Could not load the list of content files. Connect to the internet and try again.',
        'No se pudo cargar la lista de archivos. Conéctese a internet e inténtelo de nuevo.',
      ),
    );
    this.name = 'OfflineIndexError';
  }
}

function formatSize(n: number): string {
  if (n < 1024 ** 2) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function isQuotaError(error: unknown): boolean {
  const e = error as { name?: string; code?: number } | null;
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22);
}

const isAbort = (error: unknown) => (error as { name?: string } | null)?.name === 'AbortError';

// -------------------------------------------------------------- índice
export function filesIndexUrl(base = dataBase()): string {
  // packUrl({path: ''}) geraria data/v1//files.json; o arquivo fica na raiz.
  return `${base}files.json?v=${catalog.filesIndex.hash}`;
}

/** URL de um arquivo de pacote, igual à usada por content.ts (o service worker casa a URL exata). */
export function packFileUrl(pack: { path: string; hash: string }, file: string, base = dataBase()): string {
  return packUrl(pack, file, base);
}

const normalize = (url: string) => {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
};

export function hasCacheApi(): boolean {
  return typeof caches !== 'undefined' && typeof caches.open === 'function';
}

export async function openDataCache(): Promise<Cache> {
  if (!hasCacheApi()) throw new OfflineUnsupportedError();
  return caches.open(DATA_CACHE);
}

let indexPromise: Promise<FilesIndex> | null = null;

/** data/v1/files.json — do cache quando possível (a tela offline funciona sem internet). */
export function loadFilesIndex(): Promise<FilesIndex> {
  if (indexPromise) return indexPromise;
  const promise = (async () => {
    const url = filesIndexUrl();
    const cache = hasCacheApi() ? await caches.open(DATA_CACHE).catch(() => null) : null;
    const hit = await cache?.match(url).catch(() => undefined);
    if (hit) return (await hit.json()) as FilesIndex;
    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new OfflineIndexError();
    }
    if (!response.ok) throw new OfflineIndexError();
    if (cache) await cache.put(url, response.clone()).catch(() => undefined);
    return (await response.json()) as FilesIndex;
  })();
  indexPromise = promise;
  promise.catch(() => {
    if (indexPromise === promise) indexPromise = null;
  });
  return promise;
}

/** Apenas para testes. */
export function resetOfflineState(): void {
  indexPromise = null;
  job = null;
}

// -------------------------------------------------------------- grupos
const pack = (p: { path: string; hash: string; bytes?: number } | null | undefined, sizes?: Record<string, number>): OfflinePack[] =>
  p ? [{ path: p.path, hash: p.hash, bytes: p.bytes ?? 0, sizes }] : [];

function group(id: string, kind: GroupKind, title: string, description: string, packs: OfflinePack[]): OfflineGroup {
  return { id, kind, title, description, packs, bytes: packs.reduce((sum, p) => sum + p.bytes, 0) };
}

/**
 * Grupos mostrados na tela offline: cada tradução e cada comentário instalados,
 * referências cruzadas, idioma original, temas, documentos, pesquisa e 3D.
 * Módulos importados pelo usuário já ficam no aparelho (IndexedDB) e não entram.
 */
export function offlineGroups(): OfflineGroup[] {
  const list: OfflineGroup[] = [];
  for (const m of modules('bible', true)) {
    const p = catalog.bibles[m.id];
    if (!p || userModule(m.id)) continue;
    list.push(group(`bible:${m.id}`, 'bible', m.title, tr('Tradução da Bíblia', 'Bible translation', 'Traducción de la Biblia'), pack(p)));
  }
  for (const m of modules('commentary', true)) {
    const p = catalog.commentaries[m.id];
    if (!p || userModule(m.id)) continue;
    list.push(
      group(
        `comm:${m.id}`,
        'commentary',
        m.title,
        tr(`Comentário · ${p.entries.toLocaleString('pt-BR')} verbetes`, `Commentary · ${p.entries.toLocaleString('en')} entries`, `Comentario · ${p.entries.toLocaleString('es')} entradas`),
        pack(p),
      ),
    );
  }
  list.push(
    group('xref', 'xref', tr('Referências cruzadas', 'Cross references', 'Referencias cruzadas'), tr('Todas as referências de todos os capítulos', 'All references for every chapter', 'Todas las referencias de todos los capítulos'), pack(catalog.xref)),
    group(
      'original',
      'original',
      tr('Idioma original', 'Original language', 'Idioma original'),
      tr('Hebraico e grego palavra por palavra, léxico e ocorrências', 'Hebrew and Greek word by word, lexicon and occurrences', 'Hebreo y griego palabra por palabra, léxico y ocurrencias'),
      [...pack(catalog.words), ...pack(catalog.lexicon)],
    ),
    group('topics', 'topics', tr('Temas', 'Topics', 'Temas'), tr('Temas bíblicos e suas referências', 'Bible topics and their references', 'Temas bíblicos y sus referencias'), pack(catalog.topics)),
    group(
      'documents',
      'documents',
      tr('Documentos, estudos e contexto', 'Documents, studies and context', 'Documentos, estudios y contexto'),
      tr(
        'Confissões, catecismos, devocionais, estudos, apologética, Agostinho, contexto histórico e licenças',
        'Confessions, catechisms, devotionals, studies, apologetics, Augustine, historical context and licenses',
        'Confesiones, catecismos, devocionales, estudios, apologética, Agustín, contexto histórico y licencias',
      ),
      [...pack(catalog.docs), ...pack(catalog.misc), ...pack(catalog.licenses), ...pack(catalog.apologetica), ...pack(catalog.agostinho)],
    ),
    group(
      'search',
      'search',
      tr('Pesquisa', 'Search', 'Búsqueda'),
      tr('Índices para pesquisar na Bíblia e nos comentários sem internet', 'Indexes to search the Bible and commentaries offline', 'Índices para buscar en la Biblia y los comentarios sin conexión'),
      [...pack(catalog.search.general), ...pack(catalog.search.commentary)],
    ),
    group('models', 'models', tr('Modelos 3D', '3D models', 'Modelos 3D'), tr('Reconstruções 3D e visualizador', '3D reconstructions and viewer', 'Reconstrucciones 3D y visor'), pack(catalog.models3d, catalog.models3d.sizes)),
  );
  return list;
}

/** Grupos do "Baixar o essencial": tradução atual, referências, temas, documentos e pesquisa. */
export function essentialGroups(translation: string, groups = offlineGroups()): OfflineGroup[] {
  const ids = new Set([`bible:${translation}`, 'xref', 'topics', 'documents', 'search']);
  return groups.filter((g) => ids.has(g.id));
}

/** Tamanho total do download completo (bytes do catálogo). */
export function fullSize(groups = offlineGroups()): number {
  return groups.reduce((sum, g) => sum + g.bytes, 0);
}

export const groupsSize = (groups: OfflineGroup[]) => groups.reduce((sum, g) => sum + g.bytes, 0);

/** Lista de URLs (com tamanho estimado) de um grupo, segundo files.json. */
export function groupItems(g: OfflineGroup, index: FilesIndex, base = dataBase()): DownloadItem[] {
  const items: DownloadItem[] = [];
  for (const p of g.packs) {
    const entry = index[p.path];
    if (!entry) continue;
    const known = p.sizes ?? {};
    const knownTotal = entry.files.reduce((sum, f) => sum + (known[f] ?? 0), 0);
    const unknown = entry.files.filter((f) => known[f] === undefined).length;
    const average = unknown ? Math.max(0, p.bytes - knownTotal) / unknown : 0;
    // O hash do catálogo é o que content.ts usa; files.json serve de reserva.
    const hash = p.hash || entry.hash;
    for (const file of entry.files) {
      items.push({ url: packFileUrl({ path: p.path, hash }, file, base), bytes: Math.round(known[file] ?? (average || 2048)) });
    }
  }
  return items;
}

export function itemsFor(groups: OfflineGroup[], index: FilesIndex, base = dataBase()): DownloadItem[] {
  const seen = new Set<string>();
  const items: DownloadItem[] = [{ url: filesIndexUrl(base), bytes: 0 }];
  seen.add(items[0].url);
  for (const g of groups) {
    for (const item of groupItems(g, index, base)) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      items.push(item);
    }
  }
  return items;
}

// --------------------------------------------------------------- status
/** URLs presentes no cache (uma única chamada a cache.keys()). */
export async function cachedUrls(cache?: Cache): Promise<Set<string>> {
  const target = cache ?? (await openDataCache());
  const keys = await target.keys();
  return new Set(keys.map((r) => normalize(r.url)));
}

async function presence(items: DownloadItem[], cache: Cache): Promise<boolean[]> {
  try {
    const set = await cachedUrls(cache);
    return items.map((i) => set.has(normalize(i.url)));
  } catch {
    // Implementações sem keys(): confere uma a uma.
    return Promise.all(items.map((i) => cache.match(i.url).then((r) => !!r, () => false)));
  }
}

/** Quantos arquivos de cada grupo já estão no aparelho. */
export async function groupStatuses(groups: OfflineGroup[], index: FilesIndex, cache?: Cache): Promise<Record<string, GroupStatus>> {
  const target = cache ?? (await openDataCache());
  const all = groups.map((g) => groupItems(g, index));
  const flags = await presence(all.flat(), target);
  const result: Record<string, GroupStatus> = {};
  let offset = 0;
  groups.forEach((g, i) => {
    const items = all[i];
    let present = 0;
    let bytesPresent = 0;
    items.forEach((item, j) => {
      if (flags[offset + j]) {
        present++;
        bytesPresent += item.bytes;
      }
    });
    offset += items.length;
    result[g.id] = { present, total: items.length, bytesPresent, bytes: g.bytes };
  });
  return result;
}

export const isComplete = (s: GroupStatus | undefined) => !!s && s.total > 0 && s.present >= s.total;

// ------------------------------------------------------------ espaço
export interface Room {
  usage: number | null;
  quota: number | null;
  available: number | null;
}

export async function storageRoom(): Promise<Room> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    const usage = estimate?.usage ?? null;
    const quota = estimate?.quota ?? null;
    return { usage, quota, available: quota === null ? null : Math.max(0, quota - (usage ?? 0)) };
  } catch {
    return { usage: null, quota: null, available: null };
  }
}

/** Recusa começar quando a cota informada pelo navegador não comporta o download. */
export async function ensureRoom(needed: number, room?: Room): Promise<void> {
  const r = room ?? (await storageRoom());
  if (r.available !== null && needed > r.available * 0.95) throw new OfflineQuotaError(needed, r.available);
}

// ------------------------------------------------------------- download
export const defaultConcurrency = () => {
  try {
    return platform() === 'ios' ? 3 : 4;
  } catch {
    return 4;
  }
};

export interface DownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
  concurrency?: number;
  retries?: number;
  /** Espera base entre tentativas (ms); dobra a cada falha. */
  retryDelay?: number;
  cache?: Cache;
  fetcher?: typeof fetch;
  /** Para testes: substitui navigator.storage.estimate(). */
  room?: Room;
  /** Pede armazenamento persistente antes de começar (padrão: sim). */
  persist?: boolean;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done);
  });
}

/**
 * Baixa as URLs ausentes do cache. Já presentes são puladas (retomada após
 * interrupção). Lança OfflineQuotaError se o espaço acabar.
 */
export async function downloadItems(items: DownloadItem[], options: DownloadOptions = {}): Promise<DownloadResult> {
  const cache = options.cache ?? (await openDataCache());
  const fetcher = options.fetcher ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const signal = options.signal;
  const retries = options.retries ?? 3;
  const retryDelay = options.retryDelay ?? 600;
  const flags = await presence(items, cache);
  const missing = items.filter((_, i) => !flags[i]);
  const progress: DownloadProgress = {
    total: items.length,
    done: items.length - missing.length,
    skipped: items.length - missing.length,
    failed: 0,
    bytesTotal: items.reduce((sum, i) => sum + i.bytes, 0),
    bytesDone: items.reduce((sum, item, i) => sum + (flags[i] ? item.bytes : 0), 0),
  };
  const failures: string[] = [];
  const report = () => options.onProgress?.({ ...progress });
  report();
  if (missing.length === 0 || signal?.aborted) return { ...progress, cancelled: !!signal?.aborted, failures };

  await ensureRoom(missing.reduce((sum, i) => sum + i.bytes, 0), options.room);
  if (options.persist !== false) await requestPersistence().catch(() => false);

  let fatal: unknown = null;
  let next = 0;
  const one = async (item: DownloadItem) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (signal?.aborted || fatal) return;
      try {
        const response = await fetcher(item.url, { signal, headers: { [DOWNLOAD_HEADER]: '1' } });
        if (response.ok && response.status === 200 && !response.headers.get('X-KM-Offline')) {
          // Sem clone e sem ler o corpo: o fluxo vai direto para o disco.
          await cache.put(item.url, response);
          progress.done++;
          progress.bytesDone += item.bytes;
          report();
          return;
        }
        try {
          await response.body?.cancel();
        } catch {
          /* corpo já consumido */
        }
        if (response.status === 404 || response.status === 410) break;
      } catch (error) {
        if (isAbort(error) && signal?.aborted) return;
        if (isQuotaError(error)) {
          fatal = new OfflineQuotaError(0, null);
          return;
        }
      }
      if (attempt < retries) await wait(retryDelay * 2 ** attempt, signal);
    }
    if (signal?.aborted || fatal) return;
    progress.failed++;
    failures.push(item.url);
    report();
  };
  const worker = async () => {
    while (!signal?.aborted && !fatal && next < missing.length) {
      const item = missing[next++];
      await one(item);
    }
  };
  const lanes = Math.max(1, Math.min(options.concurrency ?? defaultConcurrency(), missing.length));
  await Promise.all(Array.from({ length: lanes }, worker));
  if (fatal) throw fatal;
  return { ...progress, cancelled: !!signal?.aborted, failures };
}

/** Baixa os grupos indicados (e files.json, para a tela offline funcionar sem rede). */
export async function downloadGroups(groups: OfflineGroup[], options: DownloadOptions = {}): Promise<DownloadResult> {
  const index = await loadFilesIndex();
  return downloadItems(itemsFor(groups, index), options);
}

export const downloadGroup = (g: OfflineGroup, options: DownloadOptions = {}) => downloadGroups([g], options);

function setFullFlag(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(FULL_FLAG, '1');
      localStorage.setItem(`${FULL_FLAG}-at`, String(Date.now()));
    } else {
      localStorage.removeItem(FULL_FLAG);
    }
  } catch {
    /* modo privado */
  }
}

/** Indicador rápido (síncrono): o usuário concluiu "Baixar tudo" e não removeu nada depois. */
export function fullOfflineFlag(): boolean {
  try {
    return localStorage.getItem(FULL_FLAG) === '1';
  } catch {
    return false;
  }
}

/**
 * Baixa TUDO: todas as traduções e comentários instalados, referências,
 * idioma original, temas, documentos/estudos/contexto, pesquisa e 3D.
 */
export async function downloadAll(
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  options: Omit<DownloadOptions, 'onProgress' | 'signal'> = {},
): Promise<DownloadResult> {
  const result = await downloadGroups(offlineGroups(), { ...options, onProgress, signal });
  if (!result.cancelled && result.failed === 0) setFullFlag(true);
  return result;
}

export async function downloadEssential(
  translation: string,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  options: Omit<DownloadOptions, 'onProgress' | 'signal'> = {},
): Promise<DownloadResult> {
  return downloadGroups(essentialGroups(translation), { ...options, onProgress, signal });
}

/**
 * Confere no cache se todos os arquivos de todos os grupos estão presentes.
 * (O indicador km-offline-full registra a escolha do usuário; uma atualização
 * do acervo pode deixar arquivos novos por baixar sem apagar essa escolha.)
 */
export async function isFullyOffline(cache?: Cache): Promise<boolean> {
  try {
    const index = await loadFilesIndex();
    const target = cache ?? (await openDataCache());
    const items = itemsFor(offlineGroups(), index);
    return (await presence(items, target)).every(Boolean);
  } catch {
    return false;
  }
}

/** Remove do aparelho todos os arquivos dos pacotes do grupo (inclusive versões antigas). */
export async function removeGroup(g: OfflineGroup, cache?: Cache, base = dataBase()): Promise<number> {
  const target = cache ?? (await openDataCache());
  const prefixes = g.packs.map((p) => new URL(`${base}${p.path}/`).pathname);
  let removed = 0;
  for (const request of await target.keys()) {
    const path = new URL(request.url).pathname;
    if (prefixes.some((prefix) => path.startsWith(prefix))) {
      if (await target.delete(request)) removed++;
    }
  }
  setFullFlag(false);
  return removed;
}

/**
 * Depois de uma atualização do acervo (hashes novos), mantém completo quem
 * escolheu "Baixar tudo": baixa só o que falta, sem pedir, se houver rede e
 * o usuário não estiver economizando dados. Chamado em segundo plano.
 */
export async function refreshFullOffline(): Promise<DownloadResult | null> {
  if (!fullOfflineFlag() || job?.state === 'running') return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; type?: string } }).connection;
  if (connection?.saveData || connection?.type === 'cellular') return null;
  if (await isFullyOffline()) return null;
  return runOfflineJob('all', tr('Atualizando o conteúdo offline', 'Updating offline content', 'Actualizando el contenido sin conexión'), (onProgress, signal) =>
    downloadAll(onProgress, signal),
  );
}

// ----------------------------------------------------------- tarefa atual
/** Um download por vez; o estado sobrevive ao fechamento da tela. */
export interface OfflineJob {
  id: string;
  label: string;
  state: 'running' | 'done' | 'cancelled' | 'error';
  progress: DownloadProgress | null;
  result: DownloadResult | null;
  error: unknown;
}

let job: OfflineJob | null = null;
let controller: AbortController | null = null;
const jobListeners = new Set<() => void>();
const notify = () => jobListeners.forEach((l) => l());
const patchJob = (next: Partial<OfflineJob>) => {
  if (!job) return;
  job = { ...job, ...next };
  notify();
};

export const offlineJob = () => job;
export function subscribeOfflineJob(listener: () => void): () => void {
  jobListeners.add(listener);
  return () => jobListeners.delete(listener);
}

export function runOfflineJob(
  id: string,
  label: string,
  task: (onProgress: (p: DownloadProgress) => void, signal: AbortSignal) => Promise<DownloadResult>,
): Promise<DownloadResult | null> {
  if (job?.state === 'running') return Promise.resolve(null);
  const own = new AbortController();
  controller = own;
  job = { id, label, state: 'running', progress: null, result: null, error: null };
  notify();
  const current = job;
  const mine = () => job !== null && job.id === current.id && job.state === 'running';
  // No máximo ~10 atualizações por segundo na interface; a última sempre chega
  // (uma espera de rede longa não deixa números antigos na tela).
  let last = 0;
  let pending: DownloadProgress | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (!pending || !mine()) return;
    last = Date.now();
    const progress = pending;
    pending = null;
    patchJob({ progress });
  };
  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return task((progress) => {
    pending = progress;
    const wait = 100 - (Date.now() - last);
    if (wait <= 0 || progress.done + progress.failed >= progress.total) flush();
    else if (!timer) timer = setTimeout(flush, wait);
  }, own.signal).then(
    (result) => {
      stop();
      if (controller === own) controller = null;
      patchJob({ state: result.cancelled ? 'cancelled' : 'done', result, progress: result });
      return result;
    },
    (error) => {
      stop();
      if (controller === own) controller = null;
      patchJob({ state: isAbort(error) ? 'cancelled' : 'error', error });
      return null;
    },
  );
}

export function cancelOfflineJob(): void {
  controller?.abort();
}

export function clearOfflineJob(): void {
  if (job?.state !== 'running') {
    job = null;
    notify();
  }
}

// ------------------------------------------------------------ tela ativa
type Sentinel = { released?: boolean; release: () => Promise<void> };

/** Mantém a tela acesa durante o download (quando o navegador permite). Devolve a liberação. */
export function keepScreenAwake(): () => void {
  const nav = (typeof navigator === 'undefined' ? null : navigator) as (Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } }) | null;
  if (!nav?.wakeLock) return () => undefined;
  let sentinel: Sentinel | null = null;
  let active = true;
  const acquire = async () => {
    if (!active || document.visibilityState !== 'visible') return;
    try {
      const s = await nav.wakeLock!.request('screen');
      if (!active) await s.release().catch(() => undefined);
      else sentinel = s;
    } catch {
      /* negado (economia de bateria) */
    }
  };
  // O navegador libera o bloqueio quando a página sai de vista: pede de novo ao voltar.
  const onVisibility = () => {
    if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void acquire();
  };
  document.addEventListener('visibilitychange', onVisibility);
  void acquire();
  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisibility);
    void sentinel?.release().catch(() => undefined);
    sentinel = null;
  };
}

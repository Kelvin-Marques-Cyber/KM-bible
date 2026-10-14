// API de conteúdo: equivalente às consultas de lib/store.dart, mas lendo
// arquivos estáticos fragmentados (acervo público) e o IndexedDB (módulos
// importados pelo usuário). Nada é carregado antes de ser necessário.
import { builtinModule, catalog, packUrl, type ModuleInfo } from './catalog';
import { get, getAll } from './db';
import { fold, fromId, keyToRef, ref, refId, refKey, type Ref } from './domain';
import { fetchJson, fetchOptional } from './fetcher';
import { pref } from './store';

// ------------------------------------------------------------------- módulos
export interface UserModule {
  id: string;
  manifest: Record<string, unknown> & { id: string; title: string; kind: string };
  enabled: boolean;
  installedAt: number;
  bytes: number;
  books?: Record<string, number[]>;
  commentaryBooks?: number[];
  mappings?: { source_reference: string; target_translation: string; target_reference: string; kind?: string }[];
}

let userModules: UserModule[] = [];
export async function loadUserModules(): Promise<void> {
  userModules = await getAll<UserModule>('user_modules');
}
export const userModuleList = () => userModules;
export const userModule = (id: string) => userModules.find((m) => m.id === id);

const disabled = () => new Set(pref<string[]>('disabled_modules', []));

function fromUser(m: UserModule): ModuleInfo {
  const x = m.manifest as Record<string, unknown>;
  return {
    id: m.id,
    title: String(x.title),
    kind: String(x.kind),
    language: String(x.language ?? ''),
    version: String(x.version ?? ''),
    author: String(x.author ?? ''),
    license: String(x.license ?? ''),
    source: String(x.source ?? ''),
    installed: m.enabled,
    builtin: false,
    metadata: (x.metadata as Record<string, unknown>) ?? {},
    origin: 'user',
  };
}

/** Lista de módulos (embutidos + importados). Importados substituem placeholders (ex.: ARA). */
export function modules(kind?: string, installedOnly = false): ModuleInfo[] {
  const off = disabled();
  const list: ModuleInfo[] = [];
  const seen = new Set<string>();
  for (const m of userModules) {
    list.push(fromUser(m));
    seen.add(m.id);
  }
  for (const m of catalog.modules) {
    if (seen.has(m.id)) continue;
    list.push({ ...m, installed: m.installed && !off.has(m.id) });
  }
  const rank = (id: string) => (id === 'ARA' ? 0 : id === 'BLN4' ? 1 : 2);
  return list
    .filter((m) => (!kind || m.kind === kind) && (!installedOnly || m.installed))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.title.localeCompare(b.title, 'pt'));
}

export function module(id: string): ModuleInfo | undefined {
  const user = userModule(id);
  if (user) return fromUser(user);
  const m = builtinModule(id);
  return m ? { ...m, installed: m.installed && !disabled().has(m.id) } : undefined;
}
export const installed = (id: string) => module(id)?.installed === true;

export async function licenseText(id: string): Promise<string> {
  const user = userModule(id);
  if (user) return String(user.manifest.license_text ?? '');
  try {
    const response = await fetch(packUrl(catalog.licenses, `${id}.txt`));
    return response.ok ? await response.text() : '';
  } catch {
    return '';
  }
}

// -------------------------------------------------------------------- Bíblia
export interface VerseMeta {
  h?: string;
  r?: [number, number][];
  p?: 1;
  /** Notas da edição (quando o módulo as traz). */
  n?: unknown[];
}
export type RawVerse = [number, string, VerseMeta?];
export interface BookData {
  b: number;
  c: RawVerse[][];
}
export interface VerseRow {
  reference: string;
  book: number;
  chapter: number;
  verse: number;
  text: string;
  meta: VerseMeta;
}

const userData = <T>(module: string, key: string) =>
  get<{ module: string; key: string; value: T }>('user_module_data', [module, key]).then((r) => r?.value ?? null);

export async function bibleBook(translation: string, book: number): Promise<BookData | null> {
  const user = userModule(translation);
  if (user) return user.enabled ? userData<BookData>(translation, `b:${book}`) : null;
  const pack = catalog.bibles[translation];
  if (!pack || !pack.chapters[String(book)] || !installed(translation)) return null;
  return fetchJson<BookData>(packUrl(pack, `${book}.json`));
}

function bookInfo(translation: string): Record<string, number[]> {
  const user = userModule(translation);
  if (user) return user.enabled ? user.books ?? {} : {};
  return installed(translation) ? catalog.bibles[translation]?.chapters ?? {} : {};
}

export function availableBooks(translation: string): number[] {
  return Object.keys(bookInfo(translation)).map(Number).sort((a, b) => a - b);
}
export function chapterCount(translation: string, book: number): number {
  return bookInfo(translation)[String(book)]?.length ?? 0;
}
export function verseCount(translation: string, book: number, chapter: number): number {
  return bookInfo(translation)[String(book)]?.[chapter - 1] ?? 0;
}
/** Teste síncrono equivalente a store.verse(...) != null, pelo índice (maior versículo do capítulo). */
export function hasVerse(translation: string, r: Ref): boolean {
  const last = verseCount(translation, r.book, r.chapter);
  return last > 0 && r.verse >= 1 && r.verse <= last;
}

export function toRows(book: BookData, chapter?: number): VerseRow[] {
  const rows: VerseRow[] = [];
  const chapters = chapter === undefined ? book.c.map((_, i) => i + 1) : [chapter];
  for (const c of chapters) {
    for (const [v, text, meta] of book.c[c - 1] ?? []) {
      rows.push({ reference: `${book.b}:${c}:${v}`, book: book.b, chapter: c, verse: v, text, meta: meta ?? {} });
    }
  }
  return rows;
}

export async function verses(translation: string, book: number, chapter?: number): Promise<VerseRow[]> {
  const data = await bibleBook(translation, book);
  return data ? toRows(data, chapter) : [];
}

export async function verse(translation: string, r: Ref): Promise<VerseRow | null> {
  if (!installed(translation)) return null;
  const rows = await verses(translation, r.book, r.chapter);
  return rows.find((v) => v.verse === r.verse) ?? null;
}

const versification = (id: string) => String(module(id)?.metadata.versification ?? '');

/** Correspondência entre edições (store.mapped do original). */
export function mapped(a: string, r: Ref, b: string): Ref | null {
  const id = refId(r);
  for (const m of [userModule(a), userModule(b)]) {
    for (const row of m?.mappings ?? []) {
      if (m!.id === a && row.source_reference === id && row.target_translation === b) return fromId(row.target_reference);
    }
  }
  const reverse = (userModule(b)?.mappings ?? []).filter((row) => row.target_translation === a && row.target_reference === id);
  if (reverse.length === 1) return fromId(reverse[0].source_reference);
  if (a === b || (versification(a) === 'KJV' && versification(b) === 'KJV')) return r;
  return null;
}

// --------------------------------------------------------------- comentários
/** [id, início, fim, título, corpo, tipo, bibliografia|0, títuloPt?, corpoPt?, situaçãoPt?] */
export type RawCommentary = [string, number, number, string, string, string, string | 0, string?, string?, string?];
export interface CommentaryEntry {
  id: string;
  module_id: string;
  reference: string;
  end_reference: string;
  start_key: number;
  end_key: number;
  title: string;
  body: string;
  kind: string;
  bibliography: string;
  pt?: { title: string; body: string; status: string };
}

function entry(module: string, raw: RawCommentary, bibliography: string): CommentaryEntry {
  const pt = raw.length > 7 ? { title: raw[7] ?? '', body: raw[8] ?? '', status: raw[9] ?? '' } : undefined;
  return {
    id: raw[0],
    module_id: module,
    reference: refId(keyToRef(raw[1])),
    end_reference: refId(keyToRef(raw[2])),
    start_key: raw[1],
    end_key: raw[2],
    title: raw[3],
    body: raw[4],
    kind: raw[5],
    bibliography: raw[6] || bibliography,
    pt,
  };
}

async function commentaryShard(module: string, r: Ref): Promise<RawCommentary[]> {
  const user = userModule(module);
  if (user) {
    if (!user.enabled || !user.commentaryBooks?.includes(r.book)) return [];
    return (await userData<RawCommentary[]>(module, `c:${r.book}`)) ?? [];
  }
  const pack = catalog.commentaries[module];
  if (!pack || !pack.books.includes(r.book)) return [];
  const file = pack.shard === 'module' ? 'all.json' : pack.shard === 'book' ? `${r.book}.json` : `${r.book}/${r.chapter}.json`;
  return (await fetchOptional<RawCommentary[]>(packUrl(pack, file))) ?? [];
}

const ARA_SHIFTED = new Set(['9:20', '11:22', '47:13', '64:1']);

export async function commentaries(
  r0: Ref,
  options: { moduleId?: string; sourceTranslation?: string; includeDisabled?: boolean } = {},
): Promise<CommentaryEntry[]> {
  let r = r0;
  if (options.sourceTranslation) {
    const m = mapped(options.sourceTranslation, r, 'BLN4');
    if (m) r = m;
    else if (versification(options.sourceTranslation) === 'ARA1993' && ARA_SHIFTED.has(`${r.book}:${r.chapter}`)) return [];
  }
  const key = refKey(r);
  const ids = modules('commentary', !options.includeDisabled)
    .map((m) => m.id)
    .filter((id) => !options.moduleId || id === options.moduleId);
  const groups = await Promise.all(
    ids.map(async (id) => {
      const bib = catalog.commentaries[id]?.bibliography ?? module(id)?.title ?? id;
      return (await commentaryShard(id, r)).filter((x) => x[1] <= key && x[2] >= key).map((x) => entry(id, x, bib));
    }),
  );
  return groups
    .flat()
    .sort((a, b) => (a.module_id < b.module_id ? -1 : a.module_id > b.module_id ? 1 : b.start_key - a.start_key));
}

// --------------------------------------------------- referências cruzadas
export interface CrossRef {
  target: string;
  end_reference: string;
  priority: number;
  kind: string;
  provenance: string;
  scope: 'verse' | 'chapter';
}
type RawXref = [string, string | 0, number, number, number];

async function xrefChapter(book: number, chapter: number): Promise<Record<string, RawXref[]>> {
  return (await fetchOptional<Record<string, RawXref[]>>(packUrl(catalog.xref, `${book}/${chapter}.json`))) ?? {};
}

const toCross = (x: RawXref, scope: 'verse' | 'chapter'): CrossRef => ({
  target: x[0],
  end_reference: x[1] || x[0],
  priority: x[2],
  kind: catalog.xref.kinds[x[3]] ?? 'editorial',
  provenance: catalog.xref.provenances[x[4]] ?? '',
  scope,
});

export async function crossReferences(r: Ref, limit = 30, includeChapter = true): Promise<CrossRef[]> {
  const chapter = await xrefChapter(r.book, r.chapter);
  let rows = (chapter[String(r.verse)] ?? []).slice(0, limit).map((x) => toCross(x, 'verse'));
  if (rows.length === 0 && includeChapter) {
    rows = Object.values(chapter)
      .flat()
      .sort((a, b) => b[2] - a[2] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .slice(0, limit)
      .map((x) => toCross(x, 'chapter'));
  }
  const seen = new Set<string>();
  return rows.filter((x) => {
    const k = `${x.target}..${x.end_reference}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function crossReferenceCount(r: Ref): Promise<number> {
  return (await xrefChapter(r.book, r.chapter))[String(r.verse)]?.length ?? 0;
}

// ------------------------------------------------------- original e léxico
export interface Word {
  position: number;
  surface: string;
  lexeme: string;
  morphology: string;
  edition: string;
  module_id: string;
  transliteration: string;
  gloss: string;
}
type RawWord = [number, string, string, string, number];

let glance: Promise<Record<string, [string, string]>> | null = null;
export const lexiconGlance = () =>
  (glance ??= fetchJson<Record<string, [string, string]>>(packUrl(catalog.lexicon, 'glance.json')));

export async function wordsAt(r0: Ref, sourceTranslation?: string): Promise<Word[]> {
  let r = r0;
  if (sourceTranslation && versification(sourceTranslation) === 'ARA1993' && ['47:13', '64:1'].includes(`${r.book}:${r.chapter}`)) {
    const m = mapped(sourceTranslation, r, 'BLN4');
    if (!m) return [];
    r = m;
  }
  const [chapter, info] = await Promise.all([
    fetchOptional<Record<string, RawWord[]>>(packUrl(catalog.words, `${r.book}/${r.chapter}.json`)),
    lexiconGlance(),
  ]);
  return (chapter?.[String(r.verse)] ?? [])
    .map((w) => ({
      position: w[0],
      surface: w[1],
      lexeme: w[2],
      morphology: w[3],
      edition: catalog.words.editions[w[4]],
      module_id: catalog.words.modules[w[4]] ?? catalog.words.editions[w[4]],
      transliteration: info[w[2]]?.[0] ?? '',
      gloss: info[w[2]]?.[1] ?? '',
    }))
    .filter((w) => installed(w.module_id));
}

export function strongId(s: string): string {
  const m = /^([GH])0*(\d+)$/i.exec(s.trim());
  return m ? `${m[1].toUpperCase()}${Number(m[2])}` : s.trim();
}

const bucket = (id: string) => {
  const m = /^([A-Za-z]+)(\d+)/.exec(id);
  return m ? `${m[1].toUpperCase()}${Math.floor(Number(m[2]) / 250)}` : 'x';
};

export interface Lexeme {
  id: string;
  lemma: string;
  transliteration: string;
  gloss: string;
  definition: string;
  language: string;
  source: string;
  pt?: { gloss: string; body: string; status: string };
}

export async function lexeme(id0: string): Promise<Lexeme | null> {
  const id = strongId(id0);
  const items = await fetchOptional<Record<string, string[]>>(packUrl(catalog.lexicon, `l/${bucket(id)}.json`));
  const x = items?.[id];
  if (!x) return null;
  return {
    id,
    lemma: x[0],
    transliteration: x[1],
    gloss: x[2],
    definition: x[3],
    language: x[4],
    source: x[5],
    pt: x.length > 6 ? { gloss: x[6], body: x[7], status: x[8] } : undefined,
  };
}

export interface Occurrence {
  edition: string;
  reference: string;
  surface: string;
  morphology: string;
}
export async function occurrences(id0: string): Promise<{ frequency: number; rows: Occurrence[] }> {
  const id = strongId(id0);
  const items = await fetchOptional<Record<string, [number, [number, string, string, string][]]>>(
    packUrl(catalog.lexicon, `o/${bucket(id)}.json`),
  );
  const x = items?.[id];
  if (!x) return { frequency: 0, rows: [] };
  return {
    frequency: x[0],
    rows: x[1].map((o) => ({ edition: catalog.words.editions[o[0]], reference: o[1], surface: o[2], morphology: o[3] })),
  };
}

let lexList: Promise<[string, string, string, string][]> | null = null;
export const lexemeList = () => (lexList ??= fetchJson(packUrl(catalog.lexicon, 'list.json')));
let surfaces: Promise<[string, string, number][]> | null = null;
export const surfaceList = () => (surfaces ??= fetchJson(packUrl(catalog.lexicon, 'surfaces.json')));
let morphs: Promise<[string, number][]> | null = null;
export const morphList = () => (morphs ??= fetchJson(packUrl(catalog.lexicon, 'morphs.json')));
export async function morphOccurrences(code: string): Promise<Occurrence[]> {
  let h = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const items = await fetchOptional<Record<string, [number, string, string, string][]>>(
    packUrl(catalog.lexicon, `m/${(h >>> 0) % 32}.json`),
  );
  return (items?.[code] ?? []).map((o) => ({ edition: catalog.words.editions[o[0]], reference: o[1], surface: o[2], morphology: code }));
}

// ---------------------------------------------------------------- temas
export interface Topic {
  id: string;
  title: string;
  original_title: string;
}
export interface TopicDetail extends Topic {
  body: string;
  source: string;
  original_body: string;
  review_status: string;
  references: string[];
}
let topicIndex: Promise<Topic[]> | null = null;
export const topics = () =>
  (topicIndex ??= fetchJson<[string, string, string][]>(packUrl(catalog.topics, 'index.json')).then((rows) =>
    rows.map(([id, title, original_title]) => ({ id, title, original_title })),
  ));

export async function topic(id: string): Promise<TopicDetail | null> {
  const list = await topics();
  const index = list.findIndex((t) => t.id === id);
  if (index < 0) return null;
  const items = await fetchJson<Record<string, [string, string, string, string, string[]]>>(
    packUrl(catalog.topics, `t/${Math.floor(index / 40)}.json`),
  );
  const x = items[id];
  if (!x) return null;
  return { ...list[index], body: x[0], source: x[1], original_body: x[2], review_status: x[3], references: x[4] };
}

export async function topicsAt(r: Ref, limit = 80): Promise<Topic[]> {
  const [list, map] = await Promise.all([
    topics(),
    fetchOptional<Record<string, number[]>>(packUrl(catalog.topics, `v/${r.book}.json`)),
  ]);
  return (map?.[`${r.chapter}:${r.verse}`] ?? []).slice(0, limit).map((i) => list[i]).filter(Boolean);
}

export async function filterTopics(query: string, limit = 80): Promise<Topic[]> {
  const list = await topics();
  const q = fold(query);
  if (!q) return list.slice(0, limit);
  return list.filter((t) => fold(`${t.title} ${t.original_title}`).includes(q)).slice(0, limit);
}

// ------------------------------------------------------------- documentos
/** [id, tipo, título, corpo, referência, metadados, títuloPt?, corpoPt?, situaçãoPt?] */
export type RawDocument = [string, string, string, string, string, Record<string, unknown>, string?, string?, string?];
export interface DocumentRow {
  id: string;
  module_id: string;
  kind: string;
  title: string;
  body: string;
  reference: string;
  metadata: Record<string, unknown>;
  pt?: { title: string; body: string; status: string };
}

const toDocument = (module: string, d: RawDocument): DocumentRow => ({
  id: d[0],
  module_id: module,
  kind: d[1],
  title: d[2],
  body: d[3],
  reference: d[4],
  metadata: d[5] ?? {},
  pt: d.length > 6 ? { title: d[6] ?? '', body: d[7] ?? '', status: d[8] ?? '' } : undefined,
});

export async function moduleDocuments(id: string): Promise<DocumentRow[]> {
  const user = userModule(id);
  if (user) return ((await userData<RawDocument[]>(id, 'docs')) ?? []).map((d) => toDocument(id, d));
  if (!catalog.docs.modules[id]) return [];
  return (await fetchJson<RawDocument[]>(packUrl(catalog.docs, `${id}.json`))).map((d) => toDocument(id, d));
}

export async function documents(options: { moduleId?: string; kind?: string } = {}): Promise<DocumentRow[]> {
  const candidates = modules(undefined, true)
    .filter((m) => (options.moduleId ? m.id === options.moduleId : true))
    .filter((m) => catalog.docs.modules[m.id] || (userModule(m.id) && !['bible', 'commentary', 'lexicon'].includes(m.kind)))
    .filter((m) => !options.kind || catalog.docs.modules[m.id]?.kinds.includes(options.kind) || userModule(m.id)?.manifest.kind === options.kind);
  const all = (await Promise.all(candidates.map((m) => moduleDocuments(m.id)))).flat();
  return all.filter((d) => !options.kind || d.kind === options.kind).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export async function document(id: string): Promise<DocumentRow | null> {
  const prefix = id.startsWith('model:') ? 'APP-3D' : id.includes(':') ? id.slice(0, id.indexOf(':')) : id.split('.')[0];
  const candidates = [prefix, ...modules(undefined, true).map((m) => m.id).filter((m) => m !== prefix)];
  for (const m of candidates) {
    if (!installed(m) || (!catalog.docs.modules[m] && !userModule(m))) continue;
    const found = (await moduleDocuments(m)).find((d) => d.id === id);
    if (found) return found;
    if (m === prefix && catalog.docs.modules[m]) break;
  }
  return null;
}

// ------------------------------------------------------------- estudos etc.
export interface Study {
  id: string;
  level: number;
  topic: string;
  target: string;
  title: string;
  exposition: string;
  response: string;
  strongest: string;
  rejoinder: string;
  refs: string[];
  sources: (string | { title: string; url: string })[];
}
let studyList: Promise<Study[]> | null = null;
export const allStudies = () =>
  (studyList ??= fetchJson<unknown[][]>(packUrl(catalog.misc, 'studies.json')).then((rows) =>
    rows.map((s) => ({
      id: s[0] as string,
      level: s[1] as number,
      topic: s[2] as string,
      target: s[3] as string,
      title: s[4] as string,
      exposition: (s[5] as string) ?? '',
      response: (s[6] as string) ?? '',
      strongest: (s[7] as string) ?? '',
      rejoinder: (s[8] as string) ?? '',
      refs: (s[9] as string[]) ?? [],
      sources: (s[10] as Study['sources']) ?? [],
    })),
  ));

export async function studies(filter: { topic?: string | null; target?: string | null; level?: number | null } = {}): Promise<Study[]> {
  return (await allStudies()).filter(
    (s) =>
      (filter.topic == null || s.topic === filter.topic) &&
      (filter.target == null || s.target === filter.target) &&
      (filter.level == null || s.level === filter.level),
  );
}

const miscCache = new Map<string, Promise<unknown>>();
export function misc<T>(name: string): Promise<T> {
  if (!miscCache.has(name)) miscCache.set(name, fetchJson<T>(packUrl(catalog.misc, `${name}.json`)));
  return miscCache.get(name) as Promise<T>;
}

export interface ContextEvent {
  id: string;
  title: string;
  start: number | null;
  end: number | null;
  location: string | null;
  references: string[];
  description: string;
  certainty: string;
  world: boolean;
  alternatives: { label: string; start: number; end: number }[];
  sources: (string | { title: string; url: string })[];
  ranges: { start: string; end: string }[];
}
export interface ContextLocation {
  id: string;
  ancient: string;
  modern: string;
  lat: number;
  lon: number;
  uncertainty: string;
  source: string;
}
export interface ContextData {
  locations: ContextLocation[];
  events: ContextEvent[];
  routes: { id: string; title: string; places: string[]; source: string; certainty: string }[];
}

/** Contexto histórico + módulos de atlas importados (loadContext do original). */
export async function loadContext(): Promise<ContextData> {
  const base = await misc<ContextData>('context');
  const data: ContextData = {
    locations: [...base.locations],
    events: [...base.events],
    routes: [...base.routes],
  };
  for (const m of userModuleList().filter((x) => x.enabled && x.manifest.kind === 'atlas')) {
    for (const doc of await moduleDocuments(m.id)) {
      const meta = doc.metadata as Record<string, unknown>;
      const prefix = `${doc.id}:`;
      let index = 0;
      for (const raw of (meta.locations as Record<string, unknown>[]) ?? []) {
        const l = { ...raw } as Record<string, unknown>;
        l.id = prefix + String(l.id ?? `place${index++}`);
        l.ancient = l.ancient ?? l.title ?? l.name ?? l.id;
        l.modern = l.modern ?? l.ancient;
        l.uncertainty = l.uncertainty ?? 'Localização fornecida pelo módulo; consulte a fonte.';
        l.source = module(m.id)?.source ?? '';
        data.locations.push(l as unknown as ContextLocation);
      }
      for (const raw of (meta.events as Record<string, unknown>[]) ?? []) {
        const e = { ...raw } as Record<string, unknown>;
        e.id = prefix + String(e.id ?? `event${index++}`);
        e.title = e.title ?? doc.title;
        e.description = e.description ?? doc.body;
        e.certainty = e.certainty ?? 'módulo importado';
        e.references = ((e.references as string[]) ?? []).filter((r) => fromId(String(r)));
        e.ranges = (e.references as string[]).map((r) => ({ start: r, end: String(r).replace(/:[^:]+$/, ':176') }));
        e.sources = [module(m.id)?.source ?? ''];
        e.world = e.world === true;
        e.location = e.location == null ? null : prefix + String(e.location);
        e.alternatives = [];
        data.events.push(e as unknown as ContextEvent);
      }
    }
  }
  return data;
}

export function eventsAt(data: ContextData, r: Ref): ContextEvent[] {
  const key = refKey(r);
  return data.events.filter((e) =>
    e.ranges.some((range) => {
      const s = fromId(range.start), en = fromId(range.end);
      return s && en && key >= refKey(s) && key <= refKey(en);
    }),
  );
}

export interface Model3D {
  id: string;
  title: string;
  description: string;
  references: string[];
  file?: string;
  layers: string[];
  license: string;
  author: string;
  certainty: string;
  category?: string;
  source?: string;
  parts?: string[];
  quality?: string;
  local?: { module: string; key: string };
}

export async function loadModels(): Promise<Model3D[]> {
  const bundled = await misc<Model3D[]>('models');
  const models = bundled.map((m) => ({ ...m }));
  for (const m of userModuleList().filter((x) => x.enabled && x.manifest.kind === 'model')) {
    for (const d of await moduleDocuments(m.id)) {
      const meta = d.metadata as Record<string, unknown>;
      models.push({
        id: String(meta.id ?? d.id),
        title: d.title,
        description: String(meta.description ?? d.body),
        layers: (meta.layers as string[]) ?? ['Estrutura'],
        references: ((meta.references as string[]) ?? []).filter((r) => fromId(String(r))),
        certainty: String(meta.certainty ?? 'Reconstrução fornecida pelo módulo. Consulte as fontes.'),
        author: module(m.id)?.author ?? '',
        license: module(m.id)?.license ?? '',
        category: 'Módulo importado',
        local: { module: m.id, key: String(meta.local_key ?? '') },
      });
    }
  }
  return models;
}

export interface SceneBlock {
  id: string;
  book: number;
  start_chapter: number;
  end_chapter: number;
  items: { model_id: string; reference: string; kind: string; genre: string; explanation: string }[];
}
export async function modelScenes(): Promise<SceneBlock[]> {
  return (await misc<{ scenes: SceneBlock[] }>('model-scenes')).scenes;
}
export const modelBlockAt = (scenes: SceneBlock[], r: Ref) =>
  scenes.find((b) => b.book === r.book && r.chapter >= b.start_chapter && r.chapter <= b.end_chapter) ?? null;

export const modelFileUrl = (file: string) => packUrl(catalog.models3d, file);
export const viewerUrl = (file: string | null, reduced: boolean) =>
  `${packUrl(catalog.models3d, 'viewer.html')}${file ? `&model=${encodeURIComponent(file)}` : ''}${reduced ? '&reduced=1' : ''}`;

export async function userModelBuffer(module: string, key: string): Promise<ArrayBuffer | null> {
  const blob = await userData<Blob>(module, key);
  return blob ? blob.arrayBuffer() : null;
}

export interface BookBackground {
  book: number;
  title: string;
  genre: string;
  body: string;
  themes: string[];
  references: string[];
  scope: string;
  chronology: string;
}
export const bookBackgrounds = () => misc<BookBackground[]>('book-backgrounds');
export const relations = () => misc<{ from: string; to: string; kind: string; description: string }[]>('relations');

export function bookIntros(book: number): { module: string; id: string; title: string }[] {
  return (catalog.bookIntros[String(book)] ?? [])
    .filter(([m]) => installed(m))
    .map(([m, id, title]) => ({ module: m, id, title }));
}

export const firstRefOfBook = (translation: string) => ref(availableBooks(translation)[0] ?? 1, 1, 1);

// ------------------------------------------------ apologética aprofundada
export interface ApologeticsDossier {
  impersonal: string;
  reformed: string;
}
/** Panorama impessoal aprofundado + dossiê presbiteriano de uma tradição (sob demanda). */
export async function apologeticsDossier(target: string): Promise<ApologeticsDossier | null> {
  const pack = catalog.apologetica;
  if (!pack || !pack.targets.includes(target)) return null;
  return fetchOptional<ApologeticsDossier>(packUrl(pack, `${target}.json`));
}

// --------------------------------------------- Confissões de Agostinho
export interface AugustineChapter {
  chapter: number;
  title?: string;
  body: string;
  footnotes?: { number: number | string; text: string }[];
}
export interface AugustineManifest {
  chapterCounts: number[];
  chapterCount: number;
  source?: string;
  translator?: string;
  edition?: string;
  license?: string;
  [key: string]: unknown;
}
export const augustineAvailable = () => catalog.agostinho !== null;
export async function augustineManifest(): Promise<AugustineManifest | null> {
  return catalog.agostinho ? fetchJson<AugustineManifest>(packUrl(catalog.agostinho, 'manifest.json')) : null;
}
export async function augustineBook(n: number): Promise<{ book: number; chapters: AugustineChapter[] } | null> {
  return catalog.agostinho ? fetchJson(packUrl(catalog.agostinho, `${n}.json`)) : null;
}

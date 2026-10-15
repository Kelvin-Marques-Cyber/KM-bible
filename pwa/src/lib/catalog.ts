// Índice do acervo gerado por scripts/build_data.py e incorporado ao bundle.
import raw from '../generated/catalog.json';

export interface PackInfo {
  path: string;
  hash: string;
  bytes: number;
  files: number;
}
export interface ModuleInfo {
  id: string;
  title: string;
  kind: string;
  language: string;
  version: string;
  author: string;
  license: string;
  source: string;
  installed: boolean;
  builtin: boolean;
  metadata: Record<string, unknown>;
  origin: 'catalogue' | 'package' | 'user';
  package?: string;
}
export interface BiblePack extends PackInfo {
  chapters: Record<string, number[]>;
  verses: number;
}
export interface CommentaryPack extends PackInfo {
  shard: 'module' | 'book' | 'chapter';
  books: number[];
  entries: number;
  bibliography: string;
  translated: number;
}
export interface SearchPack extends PackInfo {
  shards: number;
  records: number;
  chunk: number;
}
export interface ApologeticsVisualInfo {
  path: string;
  title: string;
  alt: string;
  caption: string;
  credit: string;
  kind: string;
  photo?: { src: string; alt: string; caption: string; credit: string; source: string };
}

export interface Catalog {
  format: number;
  generated: string;
  modules: ModuleInfo[];
  licenses: { path: string; hash: string };
  bibles: Record<string, BiblePack>;
  commentaries: Record<string, CommentaryPack>;
  xref: PackInfo & { kinds: string[]; provenances: string[]; metadata: Record<string, unknown> };
  words: PackInfo & { editions: string[]; modules: string[] };
  lexicon: PackInfo & { lexemes: number; words: number; translated: number };
  topics: PackInfo & { topics: number; links: number; metadata: Record<string, unknown> };
  docs: PackInfo & { modules: Record<string, { count: number; kinds: string[] }> };
  bookIntros: Record<string, [string, string, string][]>;
  misc: PackInfo;
  agostinho: PackInfo | null;
  apologetica: (PackInfo & { targets: string[]; visuals?: Record<string, ApologeticsVisualInfo> }) | null;
  models3d: PackInfo & { sizes: Record<string, number> };
  search: { general: SearchPack; commentary: SearchPack };
  repairs: Record<string, number>;
  /** data/v1/files.json: { [caminhoDoPacote]: { hash, files[] } } para downloads offline. */
  filesIndex: { path: string; hash: string };
}

export const catalog = raw as unknown as Catalog;

/** Base da publicação (funciona em /KM-bible/ e em testes locais). */
export function siteBase(): string {
  if (typeof document !== 'undefined') return new URL('./', document.baseURI).href;
  return new URL('./', (self as unknown as { location: Location }).location.href).href;
}

export const dataBase = () => `${siteBase()}data/v1/`;

export function packUrl(pack: { path: string; hash: string }, file: string, base = dataBase()): string {
  return `${base}${pack.path}/${file}?v=${pack.hash}`;
}

export const builtinModule = (id: string) => catalog.modules.find((m) => m.id === id);

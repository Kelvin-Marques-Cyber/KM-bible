// Migração dos dados pessoais da versão Flutter Web para a PWA.
//
// A versão Flutter Web guardava o personal.sqlite no IndexedDB por meio do
// IndexedDbFileSystem do pacote sqlite3.dart:
//   banco "biblia_reformada_web_v2_core" (versões recentes) ou "biblia_reformada_web" (antigas)
//   object store "files":  chaves autoIncrement, valores { name, length }, índice "fileName" (name)
//   object store "blocks": chaves [idDoArquivo, deslocamento], valores Blob/ArrayBuffer de 4096 bytes
// O arquivo é remontado bloco a bloco (cortado em file.length), aberto com sql.js — carregado
// SOMENTE quando há dados antigos — e mesclado no IndexedDB da PWA sem sobrescrever anotações
// mais novas. Os bancos antigos nunca são apagados automaticamente (veja deleteLegacy()).
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { bytesOf, linksFor, mirrorBootPrefs, toStoreRow, type BackupTable } from './settings-rows';
import { get, put, requestValue, write, type StoreName } from './db';
import { tr } from './i18n';
import { emit, invalidateNotes, loadPrefs, loadProgress, type Flashcard, type HistoryRow, type Note } from './store';

export const LEGACY_CORE_DB = 'biblia_reformada_web_v2_core';
export const LEGACY_OLD_DB = 'biblia_reformada_web';
/** Bancos que podem conter o personal.sqlite, em ordem de preferência. */
export const LEGACY_PERSONAL_DBS = [LEGACY_CORE_DB, LEGACY_OLD_DB] as const;
/** Bancos de conteúdo da versão 2 (openResource em sqlite_runtime_web.dart). */
export const LEGACY_RESOURCE_DBS = ['lexicon', 'library', 'connections', 'topics', 'portuguese'].map((n) => `biblia_reformada_web_v2_${n}`);
export const LEGACY_ALL_DBS = [...LEGACY_PERSONAL_DBS, ...LEGACY_RESOURCE_DBS];
export const LEGACY_BLOCK_SIZE = 4096;

/** Tabelas lidas do personal.sqlite (attachments: sem bytes no Flutter Web). */
export const MIGRATED_TABLES = [
  'preferences',
  'notes',
  'note_links',
  'highlights',
  'bookmarks',
  'study_tabs',
  'reading_history',
  'flashcards',
  'review_history',
  'learning_progress',
] as const;
type MigratedTable = (typeof MIGRATED_TABLES)[number];

/** Preferências internas do Flutter Web (hashes de bancos, módulos embutidos): não são migradas. */
const INTERNAL_PREF = /^(browser_asset_sha256_|bundled_imported_|private_imported_|bundled_error_|editorial_expansion_hash$|model_index_hash$)/;

export interface LegacyFile {
  id: number;
  name: string;
  length: number;
}
export interface LegacySource {
  dbName: string;
  file: LegacyFile;
  /** Tamanho do "-journal" (transação interrompida quando > 0). */
  journal: number;
  /** Tamanho do "-wal" (modo WAL, quando existir). */
  wal: number;
}
export interface MigrationMeta {
  key: 'migration';
  from: string;
  sources: string[];
  at: number;
  counts: Record<string, number>;
  warnings: string[];
}
interface MigrationFailure {
  key: 'migration_error';
  at: number;
  error: string;
  attempts: number;
}
export interface MigrationResult {
  migrated: boolean;
  counts?: Record<string, number>;
  error?: string;
  from?: string;
  warnings?: string[];
}

type SqlLoader = () => Promise<SqlJsStatic>;
export interface MigrationOptions {
  /** Executa mesmo que a migração já tenha sido feita (botão "Migrar agora"). */
  force?: boolean;
  /** Fábrica do IndexedDB onde estão os bancos antigos (testes). */
  factory?: IDBFactory;
  /** Carregador do sql.js (testes em Node). */
  sql?: SqlLoader;
}

const MAX_AUTOMATIC_ATTEMPTS = 3;

// ------------------------------------------------------------------ IndexedDB bruto
function legacyFactory(factory?: IDBFactory): IDBFactory | null {
  if (factory) return factory;
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB;
  } catch {
    return null;
  }
}

/** Nomes dos bancos existentes (indexedDB.databases()), ou null quando indisponível. */
async function databaseNames(factory: IDBFactory): Promise<Set<string> | null> {
  if (typeof factory.databases !== 'function') return null;
  try {
    // Algumas versões do Safari nunca resolvem databases(): limite de 1,5 s.
    const list = await Promise.race([
      factory.databases(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    if (!list) return null;
    return new Set(list.map((d) => d.name).filter((n): n is string => typeof n === 'string'));
  } catch {
    return null;
  }
}

/** Abre um banco SEM criá-lo: se não existia (oldVersion 0), cancela o upgrade e devolve null. */
function openExisting(factory: IDBFactory, name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let created = false;
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (settled) {
        db?.close();
        return;
      }
      settled = true;
      resolve(db);
    };
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(name);
    } catch {
      finish(null);
      return;
    }
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        created = true;
        try {
          request.transaction?.abort();
        } catch {
          /* já encerrada */
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (created) {
        db.close();
        finish(null);
        return;
      }
      // Outra aba (versão clássica) pedindo upgrade: libera a conexão.
      db.onversionchange = () => db.close();
      finish(db);
    };
    request.onerror = (event) => {
      event.preventDefault();
      finish(null);
    };
    request.onblocked = () => finish(null);
  });
}

async function withLegacyDb<T>(factory: IDBFactory, name: string, known: Set<string> | null, body: (db: IDBDatabase) => Promise<T>): Promise<T | null> {
  if (known && !known.has(name)) return null;
  const db = await openExisting(factory, name);
  if (!db) return null;
  try {
    if (!db.objectStoreNames.contains('files') || !db.objectStoreNames.contains('blocks')) return null;
    return await body(db);
  } finally {
    db.close();
  }
}

/** Arquivos da VFS do sqlite3.dart: { id (chave), name, length }. */
function listFiles(db: IDBDatabase): Promise<LegacyFile[]> {
  return new Promise((resolve, reject) => {
    const files: LegacyFile[] = [];
    const tx = db.transaction('files', 'readonly');
    const request = tx.objectStore('files').openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const value = cursor.value as { name?: unknown; length?: unknown } | null;
      const id = Number(cursor.primaryKey);
      if (value && typeof value.name === 'string' && Number.isFinite(id)) {
        const length = Number(value.length);
        files.push({ id, name: value.name, length: Number.isFinite(length) && length > 0 ? length : 0 });
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve(files);
    tx.onerror = () => reject(tx.error ?? request.error);
    tx.onabort = () => reject(tx.error ?? new DOMException('Transação cancelada', 'AbortError'));
  });
}

const fileNamed = (files: LegacyFile[], suffix: string) => files.find((f) => f.name === suffix || f.name.endsWith(`/${suffix}`));

/** Reconstrói o conteúdo de um arquivo a partir dos blocos de 4096 bytes. */
export async function readLegacyFile(db: IDBDatabase, file: LegacyFile): Promise<Uint8Array> {
  const blocks = await new Promise<{ offset: number; value: unknown }[]>((resolve, reject) => {
    const out: { offset: number; value: unknown }[] = [];
    const tx = db.transaction('blocks', 'readonly');
    const range = IDBKeyRange.bound([file.id, 0], [file.id, Number.MAX_SAFE_INTEGER]);
    const request = tx.objectStore('blocks').openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const key = cursor.key as unknown[];
      out.push({ offset: Number(key[1]), value: cursor.value });
      cursor.continue();
    };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error ?? request.error);
    tx.onabort = () => reject(tx.error ?? new DOMException('Transação cancelada', 'AbortError'));
  });
  // Os Blobs continuam válidos depois da transação; lidos fora dela.
  const result = new Uint8Array(file.length);
  for (const block of blocks) {
    if (!Number.isFinite(block.offset) || block.offset < 0 || block.offset >= file.length) continue;
    const bytes = await bytesOf(block.value);
    if (!bytes) continue;
    result.set(bytes.subarray(0, Math.min(bytes.length, file.length - block.offset)), block.offset);
  }
  return result;
}

/** Todas as fontes com personal.sqlite não vazio, na ordem de preferência (mais recente primeiro). */
export async function detectLegacySources(options: { factory?: IDBFactory } = {}): Promise<LegacySource[]> {
  const factory = legacyFactory(options.factory);
  if (!factory) return [];
  const known = await databaseNames(factory);
  const sources: LegacySource[] = [];
  for (const dbName of LEGACY_PERSONAL_DBS) {
    try {
      const found = await withLegacyDb(factory, dbName, known, async (db) => {
        const files = await listFiles(db);
        const file = fileNamed(files, 'personal.sqlite');
        if (!file || file.length === 0) return null;
        return {
          dbName,
          file,
          journal: fileNamed(files, 'personal.sqlite-journal')?.length ?? 0,
          wal: fileNamed(files, 'personal.sqlite-wal')?.length ?? 0,
        } satisfies LegacySource;
      });
      if (found) sources.push(found);
    } catch {
      /* banco ilegível: ignora esta fonte */
    }
  }
  return sources;
}

/** Banco legado com dados pessoais (v2_core primeiro, depois o antigo), ou null. */
export async function detectLegacy(options: { factory?: IDBFactory } = {}): Promise<LegacySource | null> {
  return (await detectLegacySources(options))[0] ?? null;
}

/** Bancos da versão antiga presentes e o tamanho estimado (soma de file.length). */
export async function legacyDatabases(options: { factory?: IDBFactory } = {}): Promise<{ name: string; bytes: number }[]> {
  const factory = legacyFactory(options.factory);
  if (!factory) return [];
  const known = await databaseNames(factory);
  const out: { name: string; bytes: number }[] = [];
  for (const name of LEGACY_ALL_DBS) {
    try {
      const bytes = await withLegacyDb(factory, name, known, async (db) => (await listFiles(db)).reduce((sum, f) => sum + f.length, 0));
      if (bytes !== null) out.push({ name, bytes });
    } catch {
      /* ignora */
    }
  }
  return out;
}

export async function legacySize(options: { factory?: IDBFactory } = {}): Promise<number> {
  return (await legacyDatabases(options)).reduce((sum, d) => sum + d.bytes, 0);
}

/**
 * Apaga os bancos da versão Flutter (somente quando o usuário confirma).
 * "blocked": a versão clássica está aberta em outra aba; o navegador conclui ao fechá-la.
 */
export async function deleteLegacy(options: { factory?: IDBFactory } = {}): Promise<{ deleted: string[]; blocked: string[] }> {
  const factory = legacyFactory(options.factory);
  const result = { deleted: [] as string[], blocked: [] as string[] };
  if (!factory) return result;
  const present = (await legacyDatabases({ factory })).map((d) => d.name);
  for (const name of present) {
    const outcome = await new Promise<'deleted' | 'blocked' | 'error'>((resolve) => {
      let blockedTimer: ReturnType<typeof setTimeout> | null = null;
      const request = factory.deleteDatabase(name);
      request.onsuccess = () => {
        if (blockedTimer) clearTimeout(blockedTimer);
        resolve('deleted');
      };
      request.onerror = () => resolve('error');
      request.onblocked = () => {
        blockedTimer = setTimeout(() => resolve('blocked'), 3000);
      };
    });
    if (outcome === 'deleted') result.deleted.push(name);
    else if (outcome === 'blocked') result.blocked.push(name);
  }
  return result;
}

// ---------------------------------------------------------------------- sql.js
async function defaultSql(): Promise<SqlJsStatic> {
  const [mod, wasm] = await Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm.wasm?url')]);
  const init = ((mod as unknown as { default?: unknown }).default ?? mod) as (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
  return init({ locateFile: () => wasm.default });
}

type SqlRow = Record<string, SqlValue>;

function readTable(db: Database, table: string): SqlRow[] {
  const exists = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]);
  if (!exists.length || !exists[0].values.length) return [];
  const result = db.exec(`SELECT * FROM "${table}"`);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

/** Abre um personal.sqlite (cópia em memória) e lê as tabelas pessoais. */
export function readPersonalDatabase(SQL: SqlJsStatic, bytes: Uint8Array): Record<MigratedTable | 'attachments', SqlRow[]> {
  const copy = bytes.slice();
  // Cabeçalho em modo WAL (bytes 18/19 = 2): sem o -wal, lê como banco comum.
  if (copy.length >= 100 && copy[18] === 2 && copy[19] === 2) {
    copy[18] = 1;
    copy[19] = 1;
  }
  const db = new SQL.Database(copy);
  try {
    const out = {} as Record<MigratedTable | 'attachments', SqlRow[]>;
    for (const table of [...MIGRATED_TABLES, 'attachments'] as const) out[table] = readTable(db, table);
    return out;
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------- mescla
const textOf = (error: unknown) => String((error as Error)?.message ?? error);

export async function migrationStatus(): Promise<{ meta: MigrationMeta | null; failure: MigrationFailure | null }> {
  const [meta, failure] = await Promise.all([get<MigrationMeta>('meta', 'migration'), get<MigrationFailure>('meta', 'migration_error')]);
  return { meta: meta ?? null, failure: failure ?? null };
}

const MIGRATION_STORES: StoreName[] = [
  'prefs',
  'notes',
  'note_links',
  'highlights',
  'bookmarks',
  'study_tabs',
  'reading_history',
  'flashcards',
  'review_history',
  'learning_progress',
  'meta',
];

/**
 * Mescla as tabelas lidas (da fonte mais antiga para a mais nova) numa única transação.
 * - notes: fica a versão com updated_at mais recente (nunca sobrescreve uma nota mais nova);
 * - learning_progress: idem; flashcards: mantém o cartão revisado mais recentemente (due maior);
 * - preferências: na primeira migração substituem as atuais; em "migrar novamente", só completam as ausentes;
 * - demais tabelas: inserem ou substituem; histórico de leitura é unido sem duplicatas, em ordem cronológica.
 */
export async function mergeLegacyTables(
  sources: Record<string, SqlRow[]>[],
  options: { overwritePrefs: boolean; meta?: Omit<MigrationMeta, 'counts'> },
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const bump = (key: string, n = 1) => {
    counts[key] = (counts[key] ?? 0) + n;
  };
  for (const table of [...MIGRATED_TABLES, 'attachments_skipped']) counts[table] = 0;
  const prefRows: { key: string; value: unknown }[] = [];

  await write(MIGRATION_STORES, async (tx) => {
    const store = (name: StoreName) => tx.objectStore(name);
    const [notes, cards, progress, history, prefKeys] = await Promise.all([
      requestValue(store('notes').getAll()) as Promise<Note[]>,
      requestValue(store('flashcards').getAll()) as Promise<Flashcard[]>,
      requestValue(store('learning_progress').getAll()) as Promise<{ id: string; updated_at: number }[]>,
      requestValue(store('reading_history').getAll()) as Promise<HistoryRow[]>,
      requestValue(store('prefs').getAllKeys()) as Promise<IDBValidKey[]>,
    ]);
    const notesById = new Map(notes.map((n) => [n.id, n]));
    const cardsById = new Map(cards.map((c) => [c.id, c]));
    const progressById = new Map(progress.map((p) => [p.id, p]));
    const existingPrefs = new Set(prefKeys.map(String));
    const touchedNotes = new Map<string, Note>();
    const historyRows: HistoryRow[] = history.map((h) => ({ reference: h.reference, translation: h.translation, created_at: Number(h.created_at) || 0 }));
    const historyKeys = new Set(historyRows.map((h) => `${h.reference}|${h.translation}|${h.created_at}`));
    let historyAdded = 0;

    for (const tables of sources) {
      for (const table of MIGRATED_TABLES) {
        if (table === 'note_links') continue; // recriados a partir dos corpos das notas
        for (const raw of tables[table] ?? []) {
          const row = toStoreRow(table as BackupTable, raw);
          if (!row) continue;
          switch (table) {
            case 'preferences': {
              const key = row.key as string;
              if (INTERNAL_PREF.test(key)) continue;
              if (!options.overwritePrefs && existingPrefs.has(key)) continue;
              store('prefs').put(row);
              prefRows.push(row as { key: string; value: unknown });
              bump(table);
              break;
            }
            case 'notes': {
              const note = row as unknown as Note;
              const current = notesById.get(note.id);
              if (current && Number(current.updated_at) >= Number(note.updated_at)) continue;
              notesById.set(note.id, note);
              touchedNotes.set(note.id, note);
              store('notes').put(note);
              break;
            }
            case 'flashcards': {
              const card = row as unknown as Flashcard;
              const current = cardsById.get(card.id);
              if (current && Number(current.due) > Number(card.due)) continue;
              cardsById.set(card.id, card);
              store('flashcards').put(card);
              bump(table);
              break;
            }
            case 'learning_progress': {
              const current = progressById.get(row.id as string);
              if (current && Number(current.updated_at) > Number(row.updated_at)) continue;
              progressById.set(row.id as string, row as { id: string; updated_at: number });
              store('learning_progress').put(row);
              bump(table);
              break;
            }
            case 'reading_history': {
              const h = { reference: row.reference as string, translation: row.translation as string, created_at: Number(row.created_at) || 0 };
              const key = `${h.reference}|${h.translation}|${h.created_at}`;
              if (historyKeys.has(key)) continue;
              historyKeys.add(key);
              historyRows.push(h);
              historyAdded++;
              break;
            }
            default:
              store(table as StoreName).put(row);
              bump(table);
          }
        }
      }
      bump('attachments_skipped', (tables.attachments ?? []).length);
    }

    counts.notes = touchedNotes.size;
    if (touchedNotes.size) {
      const links = store('note_links');
      for (const id of touchedNotes.keys()) {
        const old = (await requestValue(links.index('source_id').getAllKeys(id))) as IDBValidKey[];
        for (const key of old) links.delete(key);
      }
      for (const link of linksFor([...touchedNotes.values()])) {
        links.put(link);
        bump('note_links');
      }
    }

    if (historyAdded) {
      // Reescreve em ordem cronológica: a lista "recentes" usa a ordem das chaves.
      const target = store('reading_history');
      target.clear();
      historyRows.sort((a, b) => a.created_at - b.created_at);
      for (const h of historyRows) target.add(h);
      counts.reading_history = historyAdded;
    }

    if (options.meta) store('meta').put({ ...options.meta, counts } satisfies MigrationMeta);
    store('meta').delete('migration_error');
  });

  invalidateNotes();
  await loadPrefs();
  await loadProgress();
  mirrorBootPrefs(prefRows);
  emit();
  return counts;
}

let running: Promise<MigrationResult> | null = null;

/**
 * Migra uma única vez (ou quando forçado). Barata quando não há dados antigos:
 * apenas indexedDB.databases() — o sql.js só é baixado se houver um personal.sqlite.
 */
export function runMigrationIfNeeded(options: MigrationOptions = {}): Promise<MigrationResult> {
  if (running) return running;
  running = migrate(options).finally(() => {
    running = null;
  });
  return running;
}

async function migrate(options: MigrationOptions): Promise<MigrationResult> {
  let status: Awaited<ReturnType<typeof migrationStatus>>;
  try {
    status = await migrationStatus();
  } catch (error) {
    return { migrated: false, error: textOf(error) };
  }
  if (!options.force) {
    if (status.meta) return { migrated: false, from: status.meta.from, counts: status.meta.counts };
    if (status.failure && status.failure.attempts >= MAX_AUTOMATIC_ATTEMPTS) return { migrated: false, error: status.failure.error };
  }
  const factory = legacyFactory(options.factory);
  if (!factory) return { migrated: false };
  try {
    const sources = await detectLegacySources({ factory });
    if (!sources.length) return { migrated: false };
    const warnings: string[] = [];
    const contents: { source: LegacySource; bytes: Uint8Array }[] = [];
    for (const source of sources) {
      const bytes = await withLegacyDb(factory, source.dbName, null, (db) => readLegacyFile(db, source.file));
      if (!bytes) continue;
      contents.push({ source, bytes });
      if (source.journal > 0 || source.wal > 0) {
        warnings.push(
          tr(
            `${source.dbName}: a versão antiga foi fechada no meio de uma gravação; as últimas alterações feitas antes disso podem não ter sido incluídas.`,
            `${source.dbName}: the old version was closed in the middle of a write; the very last changes may be missing.`,
            `${source.dbName}: la versión anterior se cerró durante una escritura; los últimos cambios pueden faltar.`,
          ),
        );
      }
    }
    if (!contents.length) return { migrated: false };
    const SQL = await (options.sql ?? defaultSql)();
    const tables: Record<string, SqlRow[]>[] = [];
    // Da fonte mais antiga para a mais nova: a mais recente prevalece nos conflitos.
    for (const { source, bytes } of [...contents].reverse()) {
      try {
        tables.push(readPersonalDatabase(SQL, bytes));
      } catch (error) {
        warnings.push(`${source.dbName}: ${textOf(error)}`);
      }
    }
    if (!tables.length) throw new Error(warnings.join(' '));
    const skipped = tables.reduce((sum, t) => sum + (t.attachments?.length ?? 0), 0);
    if (skipped) {
      warnings.push(
        tr(
          `${skipped} anexo(s) não puderam ser migrados: a versão Web antiga não guardava os arquivos dos anexos.`,
          `${skipped} attachment(s) could not be migrated: the old web version did not keep attachment files.`,
          `${skipped} adjunto(s) no se pudieron migrar: la versión web anterior no guardaba los archivos.`,
        ),
      );
    }
    const from = contents[0].source.dbName;
    const counts = await mergeLegacyTables(tables, {
      overwritePrefs: !status.meta,
      meta: { key: 'migration', from, sources: contents.map((c) => c.source.dbName), at: Date.now(), warnings },
    });
    return { migrated: true, counts, from, warnings };
  } catch (error) {
    const message = textOf(error);
    try {
      await put('meta', {
        key: 'migration_error',
        at: Date.now(),
        error: message,
        attempts: (status.failure?.attempts ?? 0) + 1,
      } satisfies MigrationFailure);
    } catch {
      /* armazenamento indisponível */
    }
    return { migrated: false, error: message };
  }
}

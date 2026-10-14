// Migração do personal.sqlite da versão Flutter Web (IndexedDbFileSystem do sqlite3.dart).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Blob as NodeBlob } from 'node:buffer';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getAll, openDb, put, resetDbConnection } from '../../src/lib/db';
import {
  LEGACY_CORE_DB,
  LEGACY_OLD_DB,
  deleteLegacy,
  detectLegacy,
  detectLegacySources,
  legacyDatabases,
  legacySize,
  migrationStatus,
  runMigrationIfNeeded,
} from '../../src/lib/migration';
import { loadPrefs, note, pref } from '../../src/lib/store';

const require = createRequire(import.meta.url);
const wasmBinary = readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
let SQL: SqlJsStatic;
const sql = async () => SQL;

const OriginalBlob = globalThis.Blob;
beforeAll(async () => {
  (globalThis as { Blob: unknown }).Blob = NodeBlob;
  SQL = await initSqlJs({ wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength) as ArrayBuffer });
});
afterAll(() => {
  (globalThis as { Blob: unknown }).Blob = OriginalBlob;
});

const deleteDb = (name: string) =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

beforeEach(async () => {
  const db = await openDb();
  db.close();
  resetDbConnection();
  for (const name of ['km-bible', LEGACY_CORE_DB, LEGACY_OLD_DB]) await deleteDb(name);
  await openDb();
  await loadPrefs();
});

/** personal.sqlite com o esquema de Store.initPersonal() (lib/store.dart). */
function buildPersonal(fill: (db: InstanceType<SqlJsStatic['Database']>) => void, wal = false): Uint8Array {
  const db = new SQL.Database();
  db.exec(`CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY,value TEXT);
CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,title TEXT,body TEXT,reference TEXT,notebook TEXT,tags TEXT,updated_at INTEGER);
CREATE TABLE IF NOT EXISTS note_links(source_id TEXT,target_id TEXT,kind TEXT,PRIMARY KEY(source_id,target_id));
CREATE TABLE IF NOT EXISTS highlights(reference TEXT,translation TEXT,color INTEGER,PRIMARY KEY(reference,translation));
CREATE TABLE IF NOT EXISTS bookmarks(id TEXT PRIMARY KEY,reference TEXT,translation TEXT,title TEXT);
CREATE TABLE IF NOT EXISTS study_tabs(id TEXT PRIMARY KEY,reference TEXT,translation TEXT,title TEXT);
CREATE TABLE IF NOT EXISTS reading_history(id INTEGER PRIMARY KEY AUTOINCREMENT,reference TEXT,translation TEXT,created_at INTEGER);
CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,note_id TEXT,filename TEXT,path TEXT,sha256 TEXT);
CREATE TABLE IF NOT EXISTS flashcards(id TEXT PRIMARY KEY,reference TEXT,translation TEXT,text TEXT,topic TEXT,mode TEXT,repetitions INTEGER,interval INTEGER,ease REAL,due INTEGER);
CREATE TABLE IF NOT EXISTS review_history(id TEXT PRIMARY KEY,card_id TEXT,grade INTEGER,reviewed_at INTEGER);
CREATE TABLE IF NOT EXISTS learning_progress(id TEXT PRIMARY KEY,completed INTEGER,updated_at INTEGER);`);
  fill(db);
  const bytes = db.export();
  db.close();
  if (wal) {
    bytes[18] = 2;
    bytes[19] = 2;
  }
  return bytes;
}

interface FakeFile {
  name: string;
  bytes: Uint8Array;
  /** Comprimento registrado (pode ser menor que os blocos: o resto é lixo). */
  length?: number;
}

/** Banco IndexedDB idêntico ao do IndexedDbFileSystem do sqlite3.dart. */
async function writeLegacyDb(dbName: string, files: FakeFile[]) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const files = request.result.createObjectStore('files', { autoIncrement: true });
      files.createIndex('fileName', 'name', { unique: true });
      request.result.createObjectStore('blocks');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  for (const file of files) {
    const length = file.length ?? file.bytes.length;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['files', 'blocks'], 'readwrite');
      const add = tx.objectStore('files').add({ name: file.name, length });
      add.onsuccess = () => {
        const id = add.result as number;
        let index = 0;
        for (let offset = 0; offset < file.bytes.length; offset += 4096) {
          // Blocos de 4096 bytes; o último é completado com lixo (deve ser cortado por length).
          const block = new Uint8Array(4096).fill(0xee);
          block.set(file.bytes.subarray(offset, offset + 4096));
          // Os dois formatos usados pelas versões do sqlite3.dart: Blob e ArrayBuffer.
          const value = index++ % 2 === 0 ? new Blob([block]) : block.buffer;
          tx.objectStore('blocks').put(value, [id, offset]);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  db.close();
}

async function databaseNames() {
  return (await indexedDB.databases()).map((d) => d.name);
}

/** Fábrica sem indexedDB.databases() (Firefox antigo): detecção por abertura sem criar. */
const withoutDatabases = (): IDBFactory =>
  ({
    open: (name: string, version?: number) => indexedDB.open(name, version),
    deleteDatabase: (name: string) => indexedDB.deleteDatabase(name),
    cmp: (a: unknown, b: unknown) => indexedDB.cmp(a, b),
  }) as unknown as IDBFactory;

function legacyPersonal() {
  return buildPersonal((db) => {
    const prefs: [string, string][] = [
      ['theme', '"forest"'],
      ['font_size', '28.0'],
      ['dedication_seen', 'true'],
      ['onboarding_done', 'true'],
      ['translation', '"ARA"'],
      ['browser_asset_sha256_catalogue', '"abc"'],
      ['last_reference', '"45:8:1"'],
    ];
    for (const p of prefs) db.run('INSERT INTO preferences VALUES(?,?)', p);
    db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?)', ['n1', 'Graça', 'Ver [[Efésios 2:8]] e [[note:n2]]', '49:2:8', 'Estudos', 'graça', 1_700_000_000_000]);
    db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?)', ['n2', 'Fé', 'Corpo antigo', '', 'Estudos', '', 1_600_000_000_000]);
    db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?)', ['n3', 'Esperança', 'Legado mais novo', '', 'Sermões', '', 1_800_000_000_000]);
    db.run('INSERT INTO note_links VALUES(?,?,?)', ['n1', 'n2', 'personal']);
    db.run('INSERT INTO highlights VALUES(?,?,?)', ['49:2:8', 'ARA', 1]);
    db.run('INSERT INTO highlights VALUES(?,?,?)', ['1:1:1', 'BLN4', 4]);
    db.run('INSERT INTO bookmarks VALUES(?,?,?,?)', ['b1', '19:23:1', 'ARA', 'Salmo 23']);
    db.run('INSERT INTO study_tabs VALUES(?,?,?,?)', ['t1', '45:8:1', 'ARA', 'Romanos 8']);
    db.run('INSERT INTO reading_history(reference,translation,created_at) VALUES(?,?,?)', ['1:1:1', 'ARA', 1_000]);
    db.run('INSERT INTO reading_history(reference,translation,created_at) VALUES(?,?,?)', ['45:8:1', 'ARA', 3_000]);
    db.run('INSERT INTO attachments VALUES(?,?,?,?,?)', ['a1', 'n1', 'foto.png', '/x/a1.png', 'abc']);
    db.run('INSERT INTO flashcards VALUES(?,?,?,?,?,?,?,?,?,?)', ['c1', '43:3:16', 'ARA', 'Porque Deus amou', '', 'reference_to_text', 3, 12, 2.7, 1_700_000_000_000]);
    db.run('INSERT INTO review_history VALUES(?,?,?,?)', ['r1', 'c1', 5, 1_700_000_000_000]);
    db.run('INSERT INTO learning_progress VALUES(?,?,?)', ['arena:s1:1', 1, 1_700_000_000_000]);
    // Dados grandes o bastante para ocupar vários blocos de 4096 bytes.
    db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?)', ['n-longa', 'Longa', 'x'.repeat(20_000), '', 'Estudos', '', 1_700_000_000_000]);
  });
}

describe('detecção', () => {
  it('nada a migrar quando não há bancos antigos (sem criar bancos)', async () => {
    expect(await detectLegacy()).toBeNull();
    expect(await detectLegacy({ factory: withoutDatabases() })).toBeNull();
    const names = await databaseNames();
    expect(names).not.toContain(LEGACY_CORE_DB);
    expect(names).not.toContain(LEGACY_OLD_DB);
    expect(await runMigrationIfNeeded({ sql })).toEqual({ migrated: false });
    expect(await legacySize()).toBe(0);
  });

  it('encontra o personal.sqlite e ignora outros arquivos', async () => {
    const personal = legacyPersonal();
    await writeLegacyDb(LEGACY_CORE_DB, [
      { name: '/catalogue.sqlite', bytes: new Uint8Array(10_000).fill(7) },
      { name: '/personal.sqlite', bytes: personal },
      { name: '/personal.sqlite-journal', bytes: new Uint8Array(0) },
    ]);
    for (const options of [{}, { factory: withoutDatabases() }]) {
      const found = await detectLegacy(options);
      expect(found?.dbName).toBe(LEGACY_CORE_DB);
      expect(found?.file.name).toBe('/personal.sqlite');
      expect(found?.file.length).toBe(personal.length);
      expect(found?.journal).toBe(0);
    }
    expect(await legacySize()).toBe(10_000 + personal.length);
  });
});

describe('migração', () => {
  it('migra notas, preferências, destaques e o restante sem sobrescrever o que é mais novo', async () => {
    const personal = legacyPersonal();
    await writeLegacyDb(LEGACY_CORE_DB, [
      { name: '/catalogue.sqlite', bytes: new Uint8Array(5_000).fill(1) },
      { name: '/personal.sqlite', bytes: personal },
    ]);
    // Na PWA: n2 já editada depois (mais nova) e n3 mais antiga que a do legado.
    await put('notes', { id: 'n2', title: 'Fé (PWA)', body: 'Corpo novo', reference: '', notebook: 'Estudos', tags: '', updated_at: 1_750_000_000_000 });
    await put('notes', { id: 'n3', title: 'Esperança (velha)', body: 'velha', reference: '', notebook: 'Estudos', tags: '', updated_at: 1_500_000_000_000 });
    await put('reading_history', { reference: '43:3:16', translation: 'ARA', created_at: 2_000 });

    const result = await runMigrationIfNeeded({ sql });
    expect(result.error).toBeUndefined();
    expect(result.migrated).toBe(true);
    expect(result.from).toBe(LEGACY_CORE_DB);
    expect(result.counts?.notes).toBe(3); // n1, n3 e n-longa
    expect(result.counts?.attachments_skipped).toBe(1);
    expect(result.warnings?.join(' ')).toContain('anexo');

    expect((await note('n1'))?.title).toBe('Graça');
    expect((await note('n2'))?.title).toBe('Fé (PWA)');
    expect((await note('n3'))?.title).toBe('Esperança');
    expect((await note('n-longa'))?.body).toHaveLength(20_000);

    expect(pref('theme', 'sepia')).toBe('forest');
    expect(pref('font_size', 23)).toBe(28);
    expect(pref('dedication_seen', false)).toBe(true);
    expect(pref('onboarding_done', false)).toBe(true);
    expect(pref('last_reference', '')).toBe('45:8:1');
    expect(pref<string | null>('browser_asset_sha256_catalogue', null)).toBeNull();
    expect(localStorage.getItem('km-pref:theme')).toBe('"forest"');

    const highlights = await getAll<{ reference: string; translation: string; color: number; book: number }>('highlights');
    expect(highlights).toEqual(
      expect.arrayContaining([
        { reference: '49:2:8', translation: 'ARA', color: 1, book: 49 },
        { reference: '1:1:1', translation: 'BLN4', color: 4, book: 1 },
      ]),
    );
    expect(await getAll('bookmarks')).toEqual([{ id: 'b1', reference: '19:23:1', translation: 'ARA', title: 'Salmo 23' }]);
    expect(await getAll('study_tabs')).toHaveLength(1);
    const history = await getAll<{ id: number; reference: string; created_at: number }>('reading_history');
    expect(history.map((h) => h.reference)).toEqual(['1:1:1', '43:3:16', '45:8:1']); // cronológica
    expect(history.map((h) => h.id)).toEqual([...history.map((h) => h.id)].sort((a, b) => a - b));
    const [card] = await getAll<{ id: string; ease: number; repetitions: number }>('flashcards');
    expect(card).toMatchObject({ id: 'c1', ease: 2.7, repetitions: 3 });
    expect(await getAll('review_history')).toHaveLength(1);
    expect(await getAll('learning_progress')).toEqual([{ id: 'arena:s1:1', completed: 1, updated_at: 1_700_000_000_000 }]);
    expect(await getAll('attachments')).toHaveLength(0);
    const links = await getAll<{ source_id: string; target_id: string; kind: string }>('note_links');
    expect(links).toEqual(
      expect.arrayContaining([
        { source_id: 'n1', target_id: '49:2:8', kind: 'biblical' },
        { source_id: 'n1', target_id: 'n2', kind: 'personal' },
      ]),
    );

    const status = await migrationStatus();
    expect(status.meta?.from).toBe(LEGACY_CORE_DB);
    expect(status.meta?.counts.notes).toBe(3);

    // Uma única vez: a segunda chamada não migra de novo.
    expect((await runMigrationIfNeeded({ sql })).migrated).toBe(false);
    // Os bancos antigos NUNCA são apagados automaticamente.
    expect(await databaseNames()).toContain(LEGACY_CORE_DB);
  });

  it('"migrar novamente" mantém preferências alteradas na PWA', async () => {
    await writeLegacyDb(LEGACY_CORE_DB, [{ name: '/personal.sqlite', bytes: legacyPersonal() }]);
    expect((await runMigrationIfNeeded({ sql })).migrated).toBe(true);
    const { setPref } = await import('../../src/lib/store');
    await setPref('theme', 'oled');
    const again = await runMigrationIfNeeded({ sql, force: true });
    expect(again.migrated).toBe(true);
    expect(again.counts?.notes).toBe(0); // nada mais novo
    expect(pref('theme', 'sepia')).toBe('oled');
  });

  it('usa o banco antigo (biblia_reformada_web), lê cabeçalho WAL e avisa sobre journal pendente', async () => {
    const personal = buildPersonal((db) => {
      db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?)', ['velha', 'Da versão antiga', 'texto', '', 'Estudos', '', 1_000]);
      db.run('INSERT INTO preferences VALUES(?,?)', ['theme', '"wine"']);
    }, true);
    await writeLegacyDb(LEGACY_OLD_DB, [
      { name: '/personal.sqlite', bytes: personal },
      { name: '/personal.sqlite-journal', bytes: new Uint8Array(512).fill(3) },
    ]);
    const sources = await detectLegacySources();
    expect(sources.map((s) => s.dbName)).toEqual([LEGACY_OLD_DB]);
    expect(sources[0].journal).toBe(512);
    const result = await runMigrationIfNeeded({ sql });
    expect(result.migrated).toBe(true);
    expect(result.from).toBe(LEGACY_OLD_DB);
    expect(result.warnings?.some((w) => w.includes('gravação'))).toBe(true);
    expect((await note('velha'))?.title).toBe('Da versão antiga');
    expect(pref('theme', 'sepia')).toBe('wine');
  });

  it('une as duas fontes: a mais recente (v2_core) prevalece', async () => {
    await writeLegacyDb(LEGACY_OLD_DB, [
      {
        name: '/personal.sqlite',
        bytes: buildPersonal((db) => {
          db.run('INSERT INTO preferences VALUES(?,?)', ['theme', '"wine"']);
          db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?)', ['so-antiga', 'Só na antiga', '', '', 'Estudos', '', 1_000]);
        }),
      },
    ]);
    await writeLegacyDb(LEGACY_CORE_DB, [{ name: '/personal.sqlite', bytes: legacyPersonal() }]);
    const result = await runMigrationIfNeeded({ sql });
    expect(result.from).toBe(LEGACY_CORE_DB);
    expect(pref('theme', 'sepia')).toBe('forest');
    expect((await note('so-antiga'))?.title).toBe('Só na antiga');
    expect((await note('n1'))?.title).toBe('Graça');
  });

  it('registra falhas sem marcar como migrado e tenta de novo depois', async () => {
    await writeLegacyDb(LEGACY_CORE_DB, [{ name: '/personal.sqlite', bytes: new Uint8Array(8192).fill(9) }]);
    const result = await runMigrationIfNeeded({ sql });
    expect(result.migrated).toBe(false);
    expect(result.error).toBeTruthy();
    const status = await migrationStatus();
    expect(status.meta).toBeNull();
    expect(status.failure?.attempts).toBe(1);
  });

  it('libera o espaço da versão antiga somente quando pedido', async () => {
    await writeLegacyDb(LEGACY_CORE_DB, [{ name: '/personal.sqlite', bytes: legacyPersonal() }]);
    await writeLegacyDb('biblia_reformada_web_v2_lexicon', [{ name: '/lexicon.sqlite', bytes: new Uint8Array(9000).fill(2) }]);
    const before = await legacyDatabases();
    expect(before.map((d) => d.name).sort()).toEqual([LEGACY_CORE_DB, 'biblia_reformada_web_v2_lexicon'].sort());
    const result = await deleteLegacy();
    expect(result.deleted.sort()).toEqual([LEGACY_CORE_DB, 'biblia_reformada_web_v2_lexicon'].sort());
    expect(result.blocked).toEqual([]);
    expect(await detectLegacy()).toBeNull();
    expect(await legacySize()).toBe(0);
  });
});

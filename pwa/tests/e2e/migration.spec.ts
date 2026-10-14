// Migração real no navegador: um personal.sqlite (criado com sql.js) gravado no
// IndexedDB com o mesmo layout do Flutter Web (sqlite3.dart IndexedDbFileSystem)
// é importado pela PWA na primeira abertura, sem apagar o banco antigo.
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { startSwitchServer, type SwitchServer } from './server';

const DIST = fileURLToPath(new URL('../../dist', import.meta.url));
let server: SwitchServer;

async function legacyPersonalSqlite(): Promise<number[]> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(`CREATE TABLE preferences(key TEXT PRIMARY KEY,value TEXT);
CREATE TABLE notes(id TEXT PRIMARY KEY,title TEXT,body TEXT,reference TEXT,notebook TEXT,tags TEXT,updated_at INTEGER);
CREATE TABLE note_links(source_id TEXT,target_id TEXT,kind TEXT,PRIMARY KEY(source_id,target_id));
CREATE TABLE highlights(reference TEXT,translation TEXT,color INTEGER,PRIMARY KEY(reference,translation));
CREATE TABLE bookmarks(id TEXT PRIMARY KEY,reference TEXT,translation TEXT,title TEXT);
CREATE TABLE study_tabs(id TEXT PRIMARY KEY,reference TEXT,translation TEXT,title TEXT);
CREATE TABLE reading_history(id INTEGER PRIMARY KEY AUTOINCREMENT,reference TEXT,translation TEXT,created_at INTEGER);
CREATE TABLE attachments(id TEXT PRIMARY KEY,note_id TEXT,filename TEXT,path TEXT,sha256 TEXT);
CREATE TABLE flashcards(id TEXT PRIMARY KEY,reference TEXT,translation TEXT,text TEXT,topic TEXT,mode TEXT,repetitions INTEGER,interval INTEGER,ease REAL,due INTEGER);
CREATE TABLE review_history(id TEXT PRIMARY KEY,card_id TEXT,grade INTEGER,reviewed_at INTEGER);
CREATE TABLE learning_progress(id TEXT PRIMARY KEY,completed INTEGER,updated_at INTEGER);`);
  db.run('INSERT INTO preferences VALUES(?,?)', ['dedication_seen', 'true']);
  db.run('INSERT INTO preferences VALUES(?,?)', ['onboarding_done', 'true']);
  db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?)', ['n1', 'Graça', 'Ver [[Efésios 2:8]]', '49:2:8', 'Estudos', '', 1_700_000_000_000]);
  db.run('INSERT INTO highlights VALUES(?,?,?)', ['43:3:16', 'ARA', 1]);
  db.run('INSERT INTO bookmarks VALUES(?,?,?,?)', ['b1', '19:23:1', 'ARA', 'Salmo 23']);
  const bytes = db.export();
  db.close();
  return [...bytes];
}

test.beforeAll(async () => {
  server = await startSwitchServer(4181, DIST);
});
test.afterAll(async () => server?.close());

test('importa anotações, marcações e preferências da versão Flutter Web', async ({ page }) => {
  const bytes = await legacyPersonalSqlite();
  // Mesma origem, sem abrir o aplicativo ainda.
  await page.goto(`${server.url}app-version.json`);
  await page.evaluate(async (data) => {
    const file = new Uint8Array(data);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('biblia_reformada_web_v2_core', 1);
      request.onupgradeneeded = () => {
        const files = request.result.createObjectStore('files', { autoIncrement: true });
        files.createIndex('fileName', 'name', { unique: true });
        request.result.createObjectStore('blocks');
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['files', 'blocks'], 'readwrite');
        const add = tx.objectStore('files').add({ name: '/personal.sqlite', length: file.length });
        add.onsuccess = () => {
          const id = add.result as number;
          for (let offset = 0; offset < file.length; offset += 4096) {
            const block = new Uint8Array(4096);
            block.set(file.subarray(offset, offset + 4096));
            tx.objectStore('blocks').put(new Blob([block]), [id, offset]);
          }
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, bytes);

  await page.goto(server.url);
  // Preferências migradas: a introdução não se repete para quem já usava o app.
  await expect(page.locator('[data-ref]').first()).toBeVisible({ timeout: 30_000 });
  const migrated = await page.evaluate(
    () =>
      new Promise<{ note: string | null; highlight: boolean; bookmark: boolean; legacyKept: boolean }>((resolve, reject) => {
        const request = indexedDB.open('km-bible');
        request.onerror = () => reject(request.error);
        request.onsuccess = async () => {
          const db = request.result;
          const get = (store: string, key: IDBValidKey) =>
            new Promise<unknown>((ok) => {
              const r = db.transaction(store).objectStore(store).get(key);
              r.onsuccess = () => ok(r.result);
              r.onerror = () => ok(undefined);
            });
          const note = (await get('notes', 'n1')) as { title?: string } | undefined;
          const highlight = await get('highlights', ['ARA', '43:3:16']);
          const bookmark = await get('bookmarks', 'b1');
          db.close();
          const names = (await indexedDB.databases()).map((d) => d.name);
          resolve({
            note: note?.title ?? null,
            highlight: !!highlight,
            bookmark: !!bookmark,
            legacyKept: names.includes('biblia_reformada_web_v2_core'),
          });
        };
      }),
  );
  expect(migrated).toEqual({ note: 'Graça', highlight: true, bookmark: true, legacyKept: true });
});

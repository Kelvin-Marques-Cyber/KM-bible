// Atualização obrigatória e substituição da versão Flutter antiga, com service worker
// real, num servidor que imita o GitHub Pages e troca a publicação no meio do teste.
import { expect, test, type Page } from '@playwright/test';
import { cp, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startSwitchServer, type SwitchServer } from './server';

const DIST = fileURLToPath(new URL('../../dist', import.meta.url));
const LEGACY = fileURLToPath(new URL('./fixtures/legacy', import.meta.url));

let server: SwitchServer;
let buildA: string;
let buildB: string;
let distB: string;

/** Cria a "publicação B": mesmos arquivos, outro identificador de build. */
async function makeBuildB(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'km-dist-b-'));
  await cp(DIST, dir, { recursive: true, filter: (src) => !src.startsWith(join(DIST, 'data')) });
  await symlink(join(DIST, 'data'), join(dir, 'data'), 'dir');
  const replaceIn = async (folder: string) => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await replaceIn(path);
      else if (/\.(js|html|json)$/.test(entry.name)) {
        const text = await readFile(path, 'utf8');
        if (text.includes(buildA)) await writeFile(path, text.split(buildA).join(buildB));
      }
    }
  };
  await replaceIn(dir);
  return dir;
}

async function swBuild(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const controller = navigator.serviceWorker?.controller;
        if (!controller) return resolve(null);
        const channel = new MessageChannel();
        const timer = setTimeout(() => resolve(null), 2000);
        channel.port1.onmessage = (event) => {
          clearTimeout(timer);
          resolve((event.data as { build?: string })?.build ?? null);
        };
        controller.postMessage({ type: 'GET_BUILD' }, [channel.port2]);
      }),
  );
}

const pageBuild = (page: Page) => page.evaluate(() => document.documentElement.dataset.build ?? null).catch(() => null);
const cacheNames = (page: Page) => page.evaluate(() => caches.keys());

test.beforeAll(async () => {
  const info = JSON.parse(await readFile(join(DIST, 'app-version.json'), 'utf8')) as { build: string };
  buildA = info.build;
  buildB = `${buildA}-b`;
  await stat(join(DIST, 'sw.js'));
  distB = await makeBuildB();
  server = await startSwitchServer(4180, DIST);
});

test.afterAll(async () => {
  await server?.close();
  if (distB) await rm(distB, { recursive: true, force: true });
});

test('substitui a versão Flutter antiga sem limpar cache e sem perder o IndexedDB', async ({ page }) => {
  server.setRoot(LEGACY);
  await page.goto(server.url);
  await expect(page.locator('#legacy')).toBeVisible();
  // Service worker antigo (cache-first para tudo) controlando a página.
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await cacheNames(page)).some((k) => k.startsWith('biblia-flutter-web-'))).toBe(true);
  // Banco do Flutter Web com o mesmo layout do sqlite3.dart (sem arquivos).
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('biblia_reformada_web_v2_core', 1);
        request.onupgradeneeded = () => {
          const files = request.result.createObjectStore('files', { autoIncrement: true });
          files.createIndex('fileName', 'name', { unique: true });
          request.result.createObjectStore('blocks');
        };
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
        request.onerror = () => reject(request.error);
      }),
  );

  // Publicação nova no mesmo endereço; o usuário apenas abre o app de novo.
  server.setRoot(DIST);
  await page.reload();
  // O service worker novo assume, apaga os caches antigos e recarrega a página sozinho.
  await expect.poll(() => pageBuild(page), { timeout: 60_000 }).toBe(buildA);
  await expect(page.locator('#legacy')).toHaveCount(0);
  await expect.poll(() => swBuild(page), { timeout: 30_000 }).toBe(buildA);
  const names = await cacheNames(page);
  expect(names.filter((k) => k.startsWith('biblia-flutter-web-') || k.startsWith('flutter-'))).toEqual([]);
  expect(names).toContain(`km-app-${buildA}`);
  const databases = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect(databases).toContain('biblia_reformada_web_v2_core');
});

test('nova publicação é aplicada automaticamente durante o uso (atualização obrigatória)', async ({ page }) => {
  server.setRoot(DIST);
  await page.goto(server.url);
  await expect.poll(() => pageBuild(page)).toBe(buildA);
  await expect.poll(() => swBuild(page), { timeout: 60_000 }).toBe(buildA);
  await page.evaluate(() => ((window as unknown as { __kmMarker: number }).__kmMarker = 1));

  server.setRoot(distB);
  // Reconexão dispara a verificação de versão (o mesmo ocorre ao voltar ao app e a cada 30 min).
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => swBuild(page), { timeout: 60_000 }).toBe(buildB);
  await expect.poll(() => pageBuild(page), { timeout: 30_000 }).toBe(buildB);
  // A página foi recarregada pelo próprio app (o marcador some).
  expect(await page.evaluate(() => (window as unknown as { __kmMarker?: number }).__kmMarker ?? null)).toBeNull();
  const names = await cacheNames(page);
  expect(names).toContain(`km-app-${buildB}`);
  expect(names).not.toContain(`km-app-${buildA}`);
});

test('abre sem internet depois da primeira visita, com os dados já lidos', async ({ page, context }) => {
  server.setRoot(DIST);
  await page.goto(server.url);
  await expect.poll(() => swBuild(page), { timeout: 60_000 }).toBe(buildA);
  const catalog = JSON.parse(await readFile(join(DIST, 'data/v1/catalog.json'), 'utf8')) as {
    bibles: Record<string, { path: string; hash: string }>;
  };
  const bible = catalog.bibles.ARA ?? Object.values(catalog.bibles)[0];
  const dataUrl = `data/v1/${bible.path}/43.json?v=${bible.hash}`;
  expect(await page.evaluate(async (url) => (await fetch(url)).status, dataUrl)).toBe(200);

  await context.setOffline(true);
  await page.reload();
  await expect.poll(() => pageBuild(page)).toBe(buildA);
  await expect(page.locator('#root')).not.toBeEmpty();
  const offline = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const json = (await response.json()) as { b?: number };
    return { status: response.status, book: json.b };
  }, dataUrl);
  expect(offline).toEqual({ status: 200, book: 43 });
  // Arquivo nunca lido: resposta 503 controlada, sem quebrar o app.
  const missing = await page.evaluate(async (url) => (await fetch(url)).status, `data/v1/${bible.path}/44.json?v=${bible.hash}`);
  expect(missing).toBe(503);
  await context.setOffline(false);
});

test('manifesto válido e ícones com os tamanhos declarados', async ({ request }) => {
  server.setRoot(DIST);
  const response = await request.get(`${server.url}manifest.webmanifest`);
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    id: string;
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(manifest.name).toBe('Bíblia Reformada');
  expect(manifest.display).toBe('standalone');
  // Mesmo id da versão Flutter instalada (/KM-bible/): o Android atualiza o ícone existente.
  expect(new URL(manifest.id, new URL(manifest.start_url, server.url)).pathname).toBe('/KM-bible/');
  expect(new URL(manifest.scope, server.url).pathname).toBe('/KM-bible/');
  const purposes = new Set(manifest.icons.map((i) => i.purpose ?? 'any'));
  expect(purposes.has('any') && purposes.has('maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const png = await request.get(new URL(icon.src, `${server.url}manifest.webmanifest`).href);
    expect(png.ok(), icon.src).toBe(true);
    const bytes = await png.body();
    const [w, h] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
  }
  for (const file of ['app-version.json', 'sw.js', 'flutter_service_worker.js', 'icons/apple-touch-icon.png']) {
    expect((await request.get(server.url + file)).ok(), file).toBe(true);
  }
});

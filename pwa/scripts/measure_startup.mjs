// Mede a abertura em um "celular modesto" simulado: CPU 4x mais lenta e 4G lento
// (1,6 Mbps, 150 ms de latência). Compara a PWA (dist/) com qualquer URL (ex.: versão Flutter).
//
//   node scripts/measure_startup.mjs                       # PWA local (dist/)
//   node scripts/measure_startup.mjs https://.../KM-bible/ flutter
//
// Resultado: tempo até a interface aparecer e bytes baixados, na 1ª visita e na 2ª (cache).
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const [, , target, kind = target ? 'flutter' : 'pwa'] = process.argv;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };

async function serveDist() {
  const server = createServer(async (req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/^\/KM-bible\//, ''));
    if (!rel || rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(DIST, rel));
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'max-age=600' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(4199, '127.0.0.1', r));
  return server;
}

const READY = {
  // PWA: tela de boas-vindas ou leitor desenhado (o splash #boot é removido).
  pwa: () => !document.getElementById('boot') && !!document.querySelector('#root > *'),
  // Flutter: primeiro quadro do motor (flutter-view/flt-glass-pane) presente.
  flutter: () => !!document.querySelector('flutter-view, flt-glass-pane'),
};

async function visit(context, url, label) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
  });
  let bytes = 0;
  cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
  const started = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(READY[kind], null, { timeout: 600_000, polling: 100 });
  const ms = Date.now() - started;
  console.log(`${label.padEnd(16)} ${(ms / 1000).toFixed(2).padStart(6)} s   ${(bytes / 1024 / 1024).toFixed(2).padStart(6)} MB`);
  await page.waitForTimeout(kind === 'pwa' ? 4000 : 1000); // deixa o service worker terminar
  await page.close();
}

const server = target ? null : await serveDist();
const url = target ?? 'http://127.0.0.1:4199/KM-bible/';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
console.log(`${kind.toUpperCase()} ${url}  (CPU 4x, 1,6 Mbps, 150 ms)`);
await visit(context, url, '1ª visita');
await visit(context, url, '2ª visita');
await browser.close();
server?.close();

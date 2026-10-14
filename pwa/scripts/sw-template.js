/* Service worker da Bíblia Reformada (gerado por scripts/finalize_build.mjs).
 *
 * - App shell (HTML/JS/CSS/ícones) pré-armazenado por versão: abre instantaneamente e offline.
 * - Dados (data/v1/**) com cache permanente "cache-first": tudo que foi lido fica offline.
 *   As URLs carregam ?v=<hash do pacote>; versões antigas são removidas ao ativar.
 * - ATUALIZAÇÃO FORÇADA: ao substituir a versão Flutter antiga (ou quando a publicação
 *   é marcada como obrigatória), assume o controle na hora e recarrega as páginas abertas,
 *   sem o usuário precisar limpar cache. IndexedDB/localStorage nunca são apagados.
 */
'use strict';

const BUILD = '__BUILD_ID__';
const FORCE = __FORCE__;
const PRECACHE = __PRECACHE__;
const PACKS = __PACKS__;
const APP_CACHE = 'km-app-' + BUILD;
const DATA_CACHE = 'km-data-v1';
const RUNTIME_CACHE = 'km-runtime-v1';

const LEGACY_CACHE = (name) =>
  name.startsWith('biblia-flutter-web-') ||
  name.startsWith('biblia-reformada-offline-') ||
  name === 'flutter-app-cache' ||
  name === 'flutter-temp-cache' ||
  name === 'flutter-app-manifest';

// Arquivos da versão clássica (Flutter) e páginas auxiliares: sempre da rede.
const CLASSIC_FILES = new Set([
  'main.dart.js', 'flutter.js', 'flutter_bootstrap.js', 'sqlite3.wasm', 'version.json', 'classico.html',
  'instalar.html', 'atualizar.html', 'modulos.html', 'diagnostico.html', 'agostinho.html', 'favicon.png',
  'manifest.json', '.last_build_id',
]);
const isClassic = (path) =>
  CLASSIC_FILES.has(path) || path.startsWith('assets/') || path.startsWith('canvaskit/') || path.startsWith('icons/Icon-');

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      // Tudo ou nada: se faltar um arquivo, a versão antiga continua funcionando.
      await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
      const keys = await caches.keys();
      const firstVersion = !keys.some((k) => k.startsWith('km-app-') && k !== APP_CACHE);
      if (FORCE || firstVersion || keys.some(LEGACY_CACHE)) await self.skipWaiting();
    })(),
  );
});

async function pruneData() {
  const cache = await caches.open(DATA_CACHE);
  const scope = new URL(self.registration.scope);
  const base = scope.pathname + 'data/v1/';
  const packs = Object.keys(PACKS).sort((a, b) => b.length - a.length);
  for (const request of await cache.keys()) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(base)) continue;
    const rest = decodeURIComponent(url.pathname.slice(base.length));
    const pack = packs.find((p) => (p === '' ? !rest.includes('/') : rest.startsWith(p + '/')));
    const version = url.searchParams.get('v');
    if (pack === undefined || (version && PACKS[pack] !== version)) await cache.delete(request);
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Havia a versão Flutter antiga (sem botão de atualizar): ela será recarregada.
      const legacy = keys.some(LEGACY_CACHE);
      for (const key of keys) {
        if ((key.startsWith('km-app-') && key !== APP_CACHE) || LEGACY_CACHE(key)) await caches.delete(key);
      }
      try {
        await pruneData();
      } catch (error) {
        console.warn('Limpeza de dados antigos adiada:', error);
      }
      await self.clients.claim();
      // Páginas desta PWA recarregam sozinhas no evento controllerchange (lib/pwa.ts).
      // A versão Flutter antiga não sabe fazer isso: o service worker a recarrega.
      if (legacy) {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) {
          const path = new URL(client.url).pathname.split('/').pop() || '';
          if (path === 'classico.html') continue;
          try {
            client.postMessage({ type: 'KM_UPDATED', build: BUILD });
            await client.navigate(client.url);
          } catch (error) {
            console.warn('Recarregamento não permitido para', client.url, error);
          }
        }
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_BUILD' && event.ports && event.ports[0]) event.ports[0].postMessage({ build: BUILD });
});

async function fromAppCache(request) {
  const cached = await caches.match(request, { cacheName: APP_CACHE, ignoreSearch: false });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

async function fromDataCache(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200 && response.type === 'basic') {
      cache.put(request, response.clone()).catch(() => undefined); // cota cheia: segue sem cache
    }
    return response;
  } catch (error) {
    return new Response(JSON.stringify({ offline: true }), {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'application/json', 'X-KM-Offline': '1' },
    });
  }
}

async function navigation(request, path) {
  if (path === '' || path === 'index.html') {
    const shell = await caches.match('index.html', { cacheName: APP_CACHE });
    if (shell) return shell;
  }
  try {
    return await fetch(request);
  } catch (error) {
    return (
      (await caches.match(request)) ||
      (await caches.match('index.html', { cacheName: APP_CACHE })) ||
      new Response('<h1>Sem conexão</h1><p>Abra a Bíblia Reformada novamente quando estiver online.</p>', {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;
  const path = decodeURIComponent(url.pathname.slice(scope.pathname.length));
  if (path === 'app-version.json' || path === 'sw.js' || path === 'flutter_service_worker.js') return;
  if (request.mode === 'navigate') {
    if (isClassic(path)) return;
    event.respondWith(navigation(request, path));
    return;
  }
  if (isClassic(path)) return;
  if (path.startsWith('data/v1/')) {
    event.respondWith(fromDataCache(request));
    return;
  }
  event.respondWith(fromAppCache(request));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const target = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : './', self.registration.scope).href;
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

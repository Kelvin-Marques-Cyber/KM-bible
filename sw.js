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

const BUILD = '1.0.0-c6996f3-20261014205220';
const FORCE = true;
const PRECACHE = ["index.html","app/Atlas-C4UaPUjC.js","app/Augustine-RQbVJNHc.js","app/Commentaries-CDW8UgQy.js","app/Comparison-PPd2wO4w.js","app/CrossReferences-CvcIkhaO.js","app/Devotionals-C9anjE3O.js","app/Documents-7BdQlZL2.js","app/Explore-DkqWCdKk.js","app/Graph-CcBZHTSo.js","app/Library-kfc-L728.js","app/Markdown-BO_FQeXl.js","app/Memory-BbzydAxK.js","app/Models-ClFWXfVg.js","app/Notes-DZd2lpAE.js","app/Onboarding-B4DmYY9M.js","app/Original-d1AUvpFF.js","app/Passage--d_9YEJ6.js","app/SavedPlaces-D0ZXV-kg.js","app/Search-Cq2ApztN.js","app/Settings-cLcggMhP.js","app/Studies-BIPnHVGo.js","app/Topics-BYTVQXXP.js","app/VerseStudy-CN8y1Qhc.js","app/arrow-left-CNgaM76n.js","app/arrow-left-right-bDmMLH7t.js","app/backup-CqQmw_vJ.js","app/book-open-text-EiDZuKvr.js","app/browser-B1j6ghx4.js","app/chevron-down-BBHuXmS1.js","app/commentaries-logic-CQQYpd2l.js","app/explore-logic-CIVpMEON.js","app/external-link-BsfNKlXy.js","app/file-text-DLa-UIMC.js","app/index-BSm2EvSp.js","app/index-CTfA-qi0.css","app/index-D-ElQMzr.js","app/link-DI3cFecU.js","app/markdown-fNCmOoSr.js","app/messages-square-CxBfjGtA.js","app/migration-CPR9Htnj.js","app/minus-By0nWs1q.js","app/notes-virtual-u83E-B8d.js","app/original-index-CIP8WK8u.js","app/packages.worker-DSy4B1oG.js","app/plus-DjKmShUK.js","app/react-C8w-UNLI.js","app/rotate-ccw-Ct4qHOJx.js","app/rotate-cw-p-W4hsJ7.js","app/settings-rows-CC1zfzht.js","app/shield-check-CFfkumx6.js","app/sql-wasm-browser-DVS82ly9.js","app/sql-wasm-ecmoRXcv.js","app/studycontext-text-BEaYFB_1.js","app/studycontext-ui-YtKnbLZ4.js","app/table-2-Dao5kCPC.js","app/tag-1qGFg0HL.js","app/triangle-alert-D-GWXENw.js","icons/apple-touch-icon.png","icons/favicon-32.png","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","fonts/EBGaramond.woff2"];
const PACKS = {"bible/ASV":"3785678971","bible/BLN4":"43396e0f59","bible/BLTR":"8b99e32ca6","bible/OSHB":"a413d0a2f6","bible/SpaRV":"273ae4dca3","bible/TR":"497545f74b","bible/ARA":"c185b0fa39","bible/Darby":"66abc67a58","bible/YLT":"f8c5c95e78","bible/Webster":"be94b0778b","bible/FreBDM1744":"d3a81cb438","bible/porblt2022eb":"76d22bf3b8","comm/Barnes":"70f9f01382","comm/MHCC":"9df300cbe3","comm/CalvinCommentaries":"5bbb29646c","comm/EXP2-CALV-PT":"8b33263f4f","comm/EXP2-CH-1189":"5b673f9256","comm/HDL-GUIA-FONTES":"c799cf574d","comm/JOSEMAR-GUIA-FONTES":"21d8c7f228","xref":"d132a48dd4","words":"7647331b42","lexicon":"73fd061f81","topics":"87ec6d99bd","docs":"9fd11b48c1","misc":"8dd5119af9","apologetica":"0215030abb","agostinho":"e78a7c69bd","search/general":"7337f191b8","search/comm":"a9345ca1cf","licenses":"3c45fde28f","3d":"711921c6b3","":"60aad72565"};
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
      // A versão Flutter antiga não sabe fazer isso: o service worker a recarrega,
      // mas só DEPOIS de ativado (navegar durante a ativação trava: a navegação
      // espera este service worker, que esperaria a navegação).
      if (legacy) setTimeout(reloadLegacyPages, 0);
    })(),
  );
});

async function reloadLegacyPages() {
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

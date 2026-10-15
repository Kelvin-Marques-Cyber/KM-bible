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

const BUILD = '1.0.0-1edbdb3-20261015081221';
const FORCE = true;
const PRECACHE = ["index.html","app/Atlas-CtL49PXT.js","app/Augustine-CvGDiYJQ.js","app/CampaignChronicles-B-3qpsLh.js","app/CampaignChronicles-DBq0TVuG.css","app/Chronicles-DTXyeKEj.js","app/Commentaries-BZYb7xvu.js","app/Comparison-C76Q0V6u.js","app/CrossReferences-Bw7Sikwo.js","app/Devotionals-Csdodktt.js","app/Documents-lugBE-Eq.js","app/Explore-Dt0_4B8C.js","app/Graph-vrulmXv_.js","app/Library-CVugl11k.js","app/Markdown-Dih9mLUI.js","app/Memory-C8V7vtYf.js","app/Mezuzah-B38BA82h.js","app/MezuzahClassic-CtZBAs9v.js","app/MezuzahClassicOnline-VP1yjqam.js","app/Models-wXMDtx9E.js","app/Notes-BW7MxcBa.js","app/Onboarding-D2wrMqn0.js","app/Original-C_A87nyr.js","app/Passage-CGt9dLxk.js","app/ReadingProgress-Cv64yUkJ.js","app/SavedPlaces-BZ2ZMbac.js","app/Search-BFgbF6uT.js","app/Settings-D1gpmQAN.js","app/Studies-kKC1925v.js","app/ToolsAndGames-C0qORFxZ.js","app/Topics-wTj1bQFI.js","app/VerseStudy-CRrJjne-.js","app/arrow-left-BUbKNojS.js","app/arrow-left-right-C5QhziZ6.js","app/arrow-right-BMGalEzK.js","app/backup-7E76yu-P.js","app/book-open-text-tndiFo8n.js","app/browser-B1j6ghx4.js","app/chevron-down-CEQT21Fl.js","app/commentaries-logic-BiwxEf6C.js","app/explore-logic-gX2uYcaE.js","app/external-link-9XZkWy-k.js","app/file-text-lCLkzjKZ.js","app/hard-drive-BcpjZDaL.js","app/index-BSm2EvSp.js","app/index-CAKrMAwz.js","app/index-RBk8doo0.css","app/info-DVewDxpg.js","app/link-J2_iUh6v.js","app/map-DW2VgtHV.js","app/map-pin-xbY68Atj.js","app/markdown-fNCmOoSr.js","app/messages-square-CFhxw3no.js","app/migration-gqAtsj-y.js","app/minus-Dh-Cbxhb.js","app/notes-virtual-TrRzPXcV.js","app/original-index-CIP8WK8u.js","app/packages.worker-18WQOrhw.js","app/plus-DN7Jk4JJ.js","app/react-C8w-UNLI.js","app/rotate-ccw-jrQmS3rz.js","app/rotate-cw-Bb-WoxlT.js","app/search.worker-Cp5gHlAY.js","app/settings-rows-CO8GfzXh.js","app/shield-check-DAhtscLy.js","app/sql-wasm-browser-DVS82ly9.js","app/sql-wasm-ecmoRXcv.js","app/studies-data-C95A9szn.js","app/studies-ui-C2xJSddG.js","app/studycontext-text-DAvU0P1n.js","app/studycontext-ui-BlS1wdci.js","app/sunrise-n-Docgd8.js","app/table-2-lvefLj0n.js","app/tag-zoXFDow1.js","app/triangle-alert-D_eQDNZf.js","icons/apple-touch-icon.png","icons/favicon-32.png","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest"];
const PACKS = {"bible/ASV":"3785678971","bible/BLN4":"43396e0f59","bible/BLTR":"8b99e32ca6","bible/OSHB":"a413d0a2f6","bible/SpaRV":"273ae4dca3","bible/TR":"497545f74b","bible/ARA":"c185b0fa39","bible/Darby":"66abc67a58","bible/YLT":"f8c5c95e78","bible/Webster":"be94b0778b","bible/FreBDM1744":"d3a81cb438","bible/porblt2022eb":"76d22bf3b8","comm/Barnes":"70f9f01382","comm/MHCC":"9df300cbe3","comm/CalvinCommentaries":"7ac56e4130","comm/EXP2-CALV-PT":"8b33263f4f","comm/EXP2-CH-1189":"5b673f9256","comm/HDL-GUIA-FONTES":"1e4f4fa065","comm/JOSEMAR-GUIA-FONTES":"7106ee5715","xref":"d132a48dd4","words":"7647331b42","lexicon":"cedbe29ab7","topics":"87ec6d99bd","docs":"9fd11b48c1","misc":"8dd5119af9","apologetica":"a1b0421722","agostinho":"e78a7c69bd","search/general":"8c5e53b73a","search/comm":"0c0115967b","licenses":"3c45fde28f","3d":"711921c6b3","":"5d53be63ca"};
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

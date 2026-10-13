'use strict';
const VERSION='0.5.3-web.2';
const OFFLINE='biblia-reformada-offline-'+VERSION;
const CORE=['./','index.html','app.js','styles.css','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(OFFLINE).then(async cache=>{for(const path of CORE){try{await cache.add(path)}catch(e){console.warn('Falha no pré-cache',path,e)}}}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys()){if(key.startsWith('biblia-reformada-offline-')&&key!==OFFLINE)await caches.delete(key)}await self.clients.claim()})())});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;let url=new URL(req.url);if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{const cache=await caches.open(OFFLINE);const cached=await cache.match(req);if(cached)return cached;try{const response=await fetch(req);if(response.ok&&(url.pathname.endsWith('.json')||url.pathname.endsWith('.glb')||url.pathname.endsWith('.css')||url.pathname.endsWith('.js')||url.pathname.endsWith('.png')||url.pathname.endsWith('.html'))){cache.put(req,response.clone()).catch(()=>{})}return response}catch(e){if(req.mode==='navigate')return await cache.match('./')||new Response('Abra a Bíblia depois de concluir a preparação offline.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});return new Response('Sem conexão e arquivo ainda não baixado.',{status:503})}})())});

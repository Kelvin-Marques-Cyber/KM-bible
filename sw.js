'use strict';
const VERSION='biblia-flutter-web-20261013-favicon-app-1';
const CORE=['./','./index.html','./flutter_bootstrap.js','./main.dart.js','./sqlite3.wasm','./manifest.json'];
self.addEventListener('install', event=>{
  event.waitUntil(caches.open(VERSION)
    .then(async cache => { for(const path of CORE) {
      try { await cache.add(path); } catch(error) { console.warn('cache:',path,error); }
    } })
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(async keys=>{
   for(const key of keys){
     if((key.startsWith('biblia-reformada-offline-')||key.startsWith('biblia-flutter-web-'))&&key!==VERSION){
       await caches.delete(key);
     }
   }
   await self.clients.claim();
 }));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 event.respondWith((async()=>{
   const cache=await caches.open(VERSION);
   const cached=await cache.match(request);
   if(cached)return cached;
   try{
     const response=await fetch(request);
     // Evita duplicar centenas de MB dos bancos SQLite ja persistidos no IndexedDB.
     if(response.ok && /\.(js|css|html|png|webp|svg|woff2?|otf|ttf|wasm|json|glb)$/.test(url.pathname)){
       cache.put(request,response.clone()).catch(()=>{});
     }
     return response;
   }catch(error){
     if(request.mode==='navigate')return await cache.match('./index.html')||Response.error();
     return Response.error();
   }
 })());
});

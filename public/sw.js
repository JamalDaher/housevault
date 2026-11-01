/* global self, caches, URL, fetch, Response */
/* HouseVault: cache only public application shell and static assets, never user inventory. */
const CACHE="housevault-shell-v2";
const ROOT="/housevault/";
const SHELL=[ROOT,ROOT+"index.html",ROOT+"icon.svg",ROOT+"manifest.webmanifest"];
self.addEventListener("install",event=>{
 event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(SHELL);const html=await (await cache.match(ROOT)).text();const assetPaths=[...html.matchAll(/(?:src|href)="(\/housevault\/assets\/[^"]+)"/g)].map(match=>match[1]);await cache.addAll(assetPaths);})());
 self.skipWaiting();
});
self.addEventListener("activate",event=>{
 event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("housevault-shell-")&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()]));
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET"||new URL(request.url).origin!==self.location.origin)return;
 const url=new URL(request.url);
 if(!url.pathname.startsWith(ROOT)||url.pathname.includes("/api/"))return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(ROOT,copy));}return response;}).catch(async()=>await caches.match(ROOT)||Response.error()));
  return;
 }
 if(!(/\.(?:js|css|svg|png|webp|woff2?|webmanifest)$/.test(url.pathname)))return;
 event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;}).catch(async()=>await caches.match(request)||Response.error()));
});

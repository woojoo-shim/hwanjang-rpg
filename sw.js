/* 포톤 RPG Service Worker */
var CACHE='hwanjang-v1';
var ASSETS=['/','/index.html','/css/style.css'];

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS).catch(function(){});}));
  self.skipWaiting();
});

self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }));
  self.clients.claim();
});

self.addEventListener('fetch',function(e){
  /* 네트워크 우선, 실패 시 캐시 */
  if(e.request.method!=='GET')return;
  e.respondWith(
    fetch(e.request).then(function(r){
      var copy=r.clone();
      caches.open(CACHE).then(function(c){try{c.put(e.request,copy);}catch(x){}});
      return r;
    }).catch(function(){return caches.match(e.request);})
  );
});

const CACHE='dom-v8';
const SHELL=['./','index.html','manifest.webmanifest','i2-192.png','i2-512.png','i2-apple-touch.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return; // API и шрифты — напрямую
  if(e.request.mode==='navigate'||u.pathname.endsWith('index.html')){
    e.respondWith(fetch(u.href,{cache:'no-cache'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(u.pathname.endsWith('widget.html')?u.pathname:'index.html',c));return r}).catch(()=>caches.match('index.html')));return;
  }
  if(new URL(e.request.url).pathname.includes('/bg/')){e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(x=>{if(x.ok)c.put(e.request,x.clone());return x}))));return;}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});

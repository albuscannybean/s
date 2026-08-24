const CACHE='lmn-v3-20260825-1';
const ASSETS=[
  './','./index.html','./styles.css','./search.css','./app.js','./db.js','./manifest.webmanifest',
  '../../packages/domain/core.js',
  '../../packages/ui/workspace-controller.js','../../packages/ui/structure-renderer.js',
  '../../packages/structure-engine/templates.js','../../packages/structure-engine/model.js',
  '../../packages/structure-engine/evaluator.js','../../packages/structure-engine/migration.js','../../packages/structure-engine/bundle.js',
  '../../packages/search-engine/search.js'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response})));
});

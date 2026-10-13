// v8 — réseau uniquement : toujours la dernière version. Le SW sert seulement à rendre l'appli installable.
const V='budget-couple-v9';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request,{cache:'no-cache'}).catch(()=>e.request.mode!=='navigate'?Response.error():new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="background:#0b0e14;color:#e8ebf3;font-family:system-ui;padding:40px;text-align:center"><h2>Pas de connexion</h2><p>Budget Couple a besoin d’internet. Reconnectez-vous puis rechargez.</p></body>',{headers:{'Content-Type':'text/html; charset=utf-8'}})))});

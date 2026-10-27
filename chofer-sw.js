/* Service Worker SOLO para la página del chofer (chofer.html)
   Permite abrir el despacho y registrar inicio / entrega SIN SEÑAL,
   siempre que el link se haya abierto antes una vez con señal.
   Alcance: ./chofer.html (no toca la app central ni su sw.js). */
const CACHE = 'sps-chofer-v1';
const SDK = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
];
const PAGE = './chofer.html';

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all([PAGE, './icon-192.png'].concat(SDK).map(function(u){
      return c.add(u).catch(function(err){ console.warn('[SW chofer] no se pudo guardar', u, err); });
    }));
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(names){
    return Promise.all(names.filter(function(n){ return n.indexOf('sps-chofer-') === 0 && n !== CACHE; })
      .map(function(n){ return caches.delete(n); }));
  }).then(function(){ return self.clients.claim(); }));
});

function timeout(ms){ return new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('timeout')); }, ms); }); }

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);

  // La página: red primero (máx. 5 s con poca señal) y si no, la copia guardada
  if(url.origin === location.origin && /\/chofer\.html$/.test(url.pathname)){
    e.respondWith(
      Promise.race([fetch(req), timeout(5000)]).then(function(res){
        if(res && res.ok){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(PAGE, copy); }); }
        return res;
      }).catch(function(){
        return caches.match(PAGE).then(function(r){ return r || fetch(req); });
      })
    );
    return;
  }
  // Código de Firebase e ícono: copia guardada primero (no cambian)
  if((url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0)
      || (url.origin === location.origin && /icon-192\.png$/.test(url.pathname))){
    e.respondWith(caches.match(req).then(function(hit){
      return hit || fetch(req).then(function(res){
        if(res && res.ok){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); }); }
        return res;
      });
    }));
  }
  // Todo lo demás (Firestore) va directo: Firebase guarda lo pendiente en el teléfono
});

/* Service Worker para "Despacho de Bandejas SPS Chile"
   ===================================================
   Permite que la app se instale como PWA y funcione sin conexión
   una vez cargada. NO cachea peticiones a Firebase (esas deben ir
   siempre a la red para datos en tiempo real).
*/

const CACHE_NAME = 'sps-despachos-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './icon-192.png',
  './icon-512.png',
  './manifest.json'
];

// Instalación: pre-cachear archivos core
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(CORE_ASSETS).catch(function(err){
        console.warn('[SW] Algunos assets no se pudieron cachear:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activación: limpiar cachés viejos
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(names.filter(function(n){
        return n !== CACHE_NAME;
      }).map(function(n){
        return caches.delete(n);
      }));
    })
  );
  self.clients.claim();
});

// Interceptar fetch: red-first para HTML, caché-first para assets
self.addEventListener('fetch', function(event){
  const req = event.request;

  // Solo GET
  if(req.method !== 'GET') return;

  const url = new URL(req.url);

  // NUNCA cachear Firebase / Firestore / Google APIs
  if(url.hostname.indexOf('firebaseio.com') >= 0
      || url.hostname.indexOf('firestore.googleapis.com') >= 0
      || url.hostname.indexOf('googleapis.com') >= 0
      || url.hostname.indexOf('firebase') >= 0
      || url.hostname.indexOf('gstatic.com') >= 0){
    return;  // deja pasar sin cachear (red directa)
  }

  // ExcelJS CDN: caché-first (es grande y estático)
  if(url.hostname.indexOf('jsdelivr.net') >= 0 || url.hostname.indexOf('cdnjs') >= 0){
    event.respondWith(
      caches.match(req).then(function(cached){
        return cached || fetch(req).then(function(res){
          if(res && res.status === 200){
            const copy = res.clone();
            caches.open(CACHE_NAME).then(function(c){ c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  // Mismo origen (HTML, JS, CSS, imágenes): red primero, caché de respaldo
  if(url.origin === location.origin){
    event.respondWith(
      fetch(req).then(function(res){
        if(res && res.status === 200){
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        return caches.match(req);
      })
    );
    return;
  }
});

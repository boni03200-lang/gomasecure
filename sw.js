
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Basic pass-through fetch. 
  // For a full offline experience, caching logic would go here.
  e.respondWith(
    fetch(e.request).catch(() => {
      return new Response('Vous êtes hors ligne. Vérifiez votre connexion.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    })
  );
});

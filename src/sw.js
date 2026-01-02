import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  
  let title = 'Nueva oferta';
  let options = {
    body: 'Tienes una nueva oferta de trabajo.',
    icon: '/icon.svg', // Icono SVG
    tag: 'job-alert',
    renotify: true
  };

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title; // Título limpio
      options.body = data.body;
      options.data = { url: data.url || '/' };
    } catch (e) {
      console.error('Error parsing push data', e);
      options.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click received.');
  
  event.notification.close();

  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
      const urlToOpen = new URL(event.notification.data ? event.notification.data.url : '/', self.location.origin).href;
      
      // Si ya hay una ventana abierta, enfocarla y navegar a la URL
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && 'focus' in client) {
          client.focus();
          return client.navigate(urlToOpen);
        }
      }
      // Si no, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
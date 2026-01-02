self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  
  let data = { title: 'Nueva oferta', body: 'Revisa la app para más detalles.', url: '/' };
  
  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body,
    icon: '/icon-dark.png',
    badge: '/icon-dark.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    // Importante para iOS y Chrome
    tag: 'job-alert-' + Date.now(), 
    renotify: true,
    requireInteraction: true 
  };

  event.waitUntil(
    self.registration.showNotification(`PUSH: ${data.title}`, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
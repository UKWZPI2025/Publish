//(Service Worker)
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (err) {}
  const title = data.title || 'Powiadomienie';
  const options = {
    body: data.body || '',
    icon: '/style/icon-192.png',   // opcjonalnie
    badge: '/style/badge-72.png',  // opcjonalnie
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url)) return w.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCs1NAMdvtuiWzbYMohY0aZa2AiS9z8uNw",
  authDomain: "downey-cleaning.firebaseapp.com",
  projectId: "downey-cleaning",
  storageBucket: "downey-cleaning.firebasestorage.app",
  messagingSenderId: "1001041748354",
  appId: "1:1001041748354:web:6f6ea1b637b8be84e2ef9b"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Downey Cleaning Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || '',
    icon: '/assets/downey-logo.png',
    badge: '/assets/downey-logo.png',
    vibrate: [300, 100, 300, 100, 300],
    tag: payload.data?.id || 'downey-fcm-alert-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Standard Push Event fallback for custom Web Push / FCM payloads
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.notification?.title || data.data?.title || data.title || 'Downey Cleaning Notification';
      const body = data.notification?.body || data.data?.message || data.message || '';
      
      const options = {
        body,
        icon: '/assets/downey-logo.png',
        badge: '/assets/downey-logo.png',
        vibrate: [300, 100, 300, 100, 300],
        tag: 'downey-push-' + Date.now(),
        renotify: true,
        requireInteraction: true,
        data: data.data || data
      };

      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.warn('[firebase-messaging-sw.js] Push event parsing error:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/notifications');
    })
  );
});


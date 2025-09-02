// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBHB6KLrPOUQ04ACC_5LdxfJjDuVEQzyTk",
  authDomain: "clean-beats-640e0.firebaseapp.com",
  projectId: "clean-beats-640e0", 
  storageBucket: "clean-beats-640e0.firebasestorage.app",
  messagingSenderId: "853381074677",
  appId: "1:853381074677:web:db13bc050ef51d1d89ffbc"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || 'Clean Beats';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'clean-beats-notification',
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open App'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  // Handle notification click action
  const action = event.action;
  const data = event.notification.data;
  
  if (action === 'open' || !action) {
    // Open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no window/tab is open, open a new one
        if (clients.openWindow) {
          let targetUrl = '/';
          
          // Navigate based on notification data
          if (data?.type === 'cleaning_reminder' && data?.equipmentId) {
            targetUrl = '/equipment';
          } else if (data?.type === 'comment' && data?.postId) {
            targetUrl = '/community';
          } else if (data?.type === 'event_reminder' && data?.eventId) {
            targetUrl = '/calendar';
          }
          
          return clients.openWindow(targetUrl);
        }
      })
    );
  }
});
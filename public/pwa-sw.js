// Enhanced PWA Service Worker with offline caching, background sync, and push notifications
const CACHE_NAME = 'clean-beats-pwa-v1.2';
const STATIC_CACHE = 'clean-beats-static-v1.2';
const DYNAMIC_CACHE = 'clean-beats-dynamic-v1.2';
const NOTIFICATION_DB = 'clean-beats-notifications';

// App Shell - Critical resources for offline functionality
const APP_SHELL = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/App.css',
  '/src/index.css',
  '/favicon.ico',
  '/manifest.json',
  // Add critical CSS and JS files
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Runtime caching strategies
const RUNTIME_CACHE = [
  '/equipment',
  '/calendar',
  '/community',
  '/profile',
  '/settings',
  '/notifications'
];

// Install event - Cache app shell
self.addEventListener('install', (event) => {
  console.log('[PWA SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[PWA SW] Caching app shell');
        return cache.addAll(APP_SHELL);
      }),
      // Skip waiting to activate immediately for auto-updates
      self.skipWaiting()
    ])
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[PWA SW] Activating service worker...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[PWA SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - Implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  event.respondWith(
    handleFetch(request)
  );
});

async function handleFetch(request) {
  const url = new URL(request.url);
  
  try {
    // App Shell - Cache First Strategy
    if (APP_SHELL.includes(url.pathname) || url.pathname === '/') {
      return await cacheFirst(request, STATIC_CACHE);
    }
    
    // Runtime pages - Network First Strategy
    if (RUNTIME_CACHE.includes(url.pathname)) {
      return await networkFirst(request, DYNAMIC_CACHE);
    }
    
    // API calls - Network First with background sync
    if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) {
      return await networkFirstWithSync(request);
    }
    
    // Images and assets - Cache First Strategy
    if (request.destination === 'image' || url.pathname.includes('/assets/')) {
      return await cacheFirst(request, DYNAMIC_CACHE);
    }
    
    // External resources - Stale While Revalidate
    if (url.origin !== self.location.origin) {
      return await staleWhileRevalidate(request, DYNAMIC_CACHE);
    }
    
    // Default - Network First
    return await networkFirst(request, DYNAMIC_CACHE);
    
  } catch (error) {
    console.error('[PWA SW] Fetch error:', error);
    
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(STATIC_CACHE);
      return await cache.match('/') || new Response('Offline', { status: 503 });
    }
    
    return new Response('Network error', { status: 503 });
  }
}

// Cache First Strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  const response = await fetch(request);
  if (response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

// Network First Strategy
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[PWA SW] Network failed, trying cache');
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Network First with Background Sync
async function networkFirstWithSync(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Store failed request for background sync
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
      await storeFailedRequest(request);
      await self.registration.sync.register('background-sync');
    }
    throw error;
  }
}

// Stale While Revalidate Strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  
  return cached || fetchPromise;
}

// Background Sync
self.addEventListener('sync', (event) => {
  console.log('[PWA SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(syncFailedRequests());
  }
});

async function syncFailedRequests() {
  try {
    const requests = await getFailedRequests();
    
    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          await removeFailedRequest(requestData.id);
          console.log('[PWA SW] Synced failed request:', requestData.url);
        }
      } catch (error) {
        console.error('[PWA SW] Failed to sync request:', error);
      }
    }
  } catch (error) {
    console.error('[PWA SW] Background sync error:', error);
  }
}

// Push Notification Handling
self.addEventListener('push', (event) => {
  console.log('[PWA SW] Push notification received');
  
  let notificationData = {};
  
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (error) {
      notificationData = {
        title: 'Clean Beats',
        body: event.data.text() || 'You have a new notification'
      };
    }
  }
  
  const options = {
    title: notificationData.title || 'Clean Beats',
    body: notificationData.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: notificationData.tag || 'default',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: {
      url: notificationData.url || '/',
      ...notificationData.data
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Notification Click Handling with Deep Linking
self.addEventListener('notificationclick', (event) => {
  console.log('[PWA SW] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window/tab is already open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification Close Handling
self.addEventListener('notificationclose', (event) => {
  console.log('[PWA SW] Notification closed:', event.notification.tag);
  
  // Track notification dismissal
  event.waitUntil(
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'NOTIFICATION_CLOSED',
          tag: event.notification.tag
        });
      });
    })
  );
});

// IndexedDB helpers for storing failed requests
async function storeFailedRequest(request) {
  const requestData = {
    id: Date.now().toString(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: request.method !== 'GET' ? await request.text() : null,
    timestamp: Date.now()
  };
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('failed-requests', 1);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['requests'], 'readwrite');
      const store = transaction.objectStore('requests');
      store.add(requestData);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function getFailedRequests() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('failed-requests', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['requests'], 'readonly');
      const store = transaction.objectStore('requests');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function removeFailedRequest(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('failed-requests', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['requests'], 'readwrite');
      const store = transaction.objectStore('requests');
      store.delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
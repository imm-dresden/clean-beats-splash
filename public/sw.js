// Service Worker for persistent web notifications
const CACHE_NAME = 'clean-beats-v1';
const NOTIFICATION_DB = 'notifications';

// Handle notification scheduling from main thread
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { id, title, body, scheduleTime, equipmentId } = event.data;
    
    // Store notification data
    await storeNotification(id, {
      title,
      body,
      scheduleTime,
      equipmentId,
      scheduled: true
    });
    
    // Calculate delay
    const delay = new Date(scheduleTime).getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `cleaning-${equipmentId}`,
          requireInteraction: true,
          actions: [
            {
              action: 'mark-done',
              title: 'Mark as Done'
            },
            {
              action: 'snooze',
              title: 'Snooze 1h'
            }
          ],
          data: { equipmentId, type: 'cleaning-reminder' }
        });
      }, delay);
    }
  }
  
  if (event.data && event.data.type === 'CANCEL_NOTIFICATION') {
    const { equipmentId } = event.data;
    await removeNotification(`cleaning-${equipmentId}`);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const { equipmentId, type } = event.notification.data;
  
  if (event.action === 'mark-done') {
    // Send message to main thread to mark equipment as cleaned
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'MARK_EQUIPMENT_CLEANED',
          equipmentId
        });
      });
    });
  } else if (event.action === 'snooze') {
    // Reschedule notification for 1 hour later
    const newScheduleTime = new Date(Date.now() + 60 * 60 * 1000);
    self.postMessage({
      type: 'RESCHEDULE_NOTIFICATION',
      equipmentId,
      scheduleTime: newScheduleTime.toISOString()
    });
  } else {
    // Default action - open the app
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/equipment');
        }
      })
    );
  }
});

// Simple IndexedDB wrapper for storing notification data
async function storeNotification(id, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NOTIFICATION_DB, 1);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('notifications')) {
        db.createObjectStore('notifications', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');
      store.put({ id, ...data });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function removeNotification(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NOTIFICATION_DB, 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');
      store.delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Background sync for when the app comes back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-equipment-status') {
    event.waitUntil(syncEquipmentStatus());
  }
});

async function syncEquipmentStatus() {
  // This would sync any pending equipment status changes
  // when the app comes back online
  console.log('Syncing equipment status...');
}
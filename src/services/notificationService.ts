import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

interface NotificationData {
  equipmentId: string;
  equipmentName: string;
  nextCleaningDue: string;
}

class NotificationService {
  private isNative = Capacitor.isNativePlatform();
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

  async initializeServiceWorker() {
    if (!this.isNative && 'serviceWorker' in navigator) {
      try {
        console.log('Attempting to register service worker...');
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered successfully:', this.serviceWorkerRegistration);
        
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        console.log('Service Worker is ready');
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log('Message from service worker:', event.data);
          if (event.data.type === 'MARK_EQUIPMENT_CLEANED') {
            // Handle equipment marking logic here
            this.handleEquipmentCleaned(event.data.equipmentId);
          }
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        // Continue without service worker
      }
    } else {
      console.log('Service worker not supported or running on native platform');
    }
  }

  private async handleEquipmentCleaned(equipmentId: string) {
    // This would integrate with your equipment management system
    console.log(`Equipment ${equipmentId} marked as cleaned from notification`);
  }

  async requestPermissions(): Promise<boolean> {
    console.log('Requesting notification permissions...');
    
    if (this.isNative) {
      try {
        // Request both local and push notification permissions
        const localPermission = await LocalNotifications.requestPermissions();
        const pushPermission = await PushNotifications.requestPermissions();
        const granted = localPermission.display === 'granted' && pushPermission.receive === 'granted';
        console.log('Native notification permissions granted:', granted);
        return granted;
      } catch (error) {
        console.error('Error requesting native permissions:', error);
        return false;
      }
    } else {
      // Web notifications
      if ('Notification' in window) {
        try {
          console.log('Current notification permission:', Notification.permission);
          
          if (Notification.permission === 'granted') {
            console.log('Notification permissions already granted');
            return true;
          }
          
          if (Notification.permission === 'denied') {
            console.log('Notification permissions denied by user');
            return false;
          }
          
          // Request permission
          console.log('Requesting notification permission...');
          const permission = await Notification.requestPermission();
          console.log('Notification permission result:', permission);
          return permission === 'granted';
        } catch (error) {
          console.error('Error requesting web notification permissions:', error);
          return false;
        }
      } else {
        console.log('Notifications not supported in this browser');
        return false;
      }
    }
  }

  async initializePushNotifications() {
    if (!this.isNative) return;

    try {
      // Register for push notifications
      await PushNotifications.register();

      // Listen for push notification registration
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token: ' + token.value);
        // You can store this token in your backend for sending targeted notifications
      });

      // Listen for push notification registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error: ', error);
      });

      // Listen for incoming push notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ', notification);
      });

      // Listen for push notification actions
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action performed: ', notification);
      });
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  async sendTestNotification(): Promise<boolean> {
    console.log('Sending test notification...');
    console.log('Is native platform:', this.isNative);
    
    if (this.isNative) {
      try {
        console.log('Attempting to schedule native notification...');
        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'Clean Beats Test',
              body: 'This is a test notification from Clean Beats! 🎵',
              id: 999999,
              schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
              sound: 'default',
              attachments: undefined,
              actionTypeId: '',
              extra: {}
            }
          ]
        });
        console.log('Native notification scheduled successfully');
        return true;
      } catch (error) {
        console.error('Error sending native test notification:', error);
        return false;
      }
    } else {
      // Web test notification
      console.log('Attempting web notification...');
      console.log('Notification permission:', Notification.permission);
      
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            console.log('Creating web notification...');
            const notification = new Notification('Clean Beats Test', {
              body: 'This is a test notification from Clean Beats! 🎵',
              icon: '/favicon.ico',
              tag: 'test-notification',
              requireInteraction: false,
              silent: false
            });
            
            notification.onclick = () => {
              console.log('Test notification clicked');
              window.focus();
              notification.close();
            };
            
            notification.onerror = (error) => {
              console.error('Notification error:', error);
            };
            
            notification.onshow = () => {
              console.log('Notification shown successfully');
            };
            
            // Auto close after 5 seconds
            setTimeout(() => {
              notification.close();
            }, 5000);
            
            console.log('Web notification created successfully');
            return true;
          } catch (error) {
            console.error('Error creating notification:', error);
            return false;
          }
        } else {
          console.log('Notification permission not granted. Current status:', Notification.permission);
          return false;
        }
      } else {
        console.log('Notifications not supported in this browser');
        return false;
      }
    }
  }

  async scheduleCleaningNotification(data: NotificationData) {
    const { equipmentId, equipmentName, nextCleaningDue } = data;
    const dueDate = new Date(nextCleaningDue);
    const notificationTime = new Date(dueDate.getTime() - (60 * 60 * 1000)); // 1 hour before

    // Don't schedule if the time has already passed
    if (notificationTime <= new Date()) {
      return;
    }

    if (this.isNative) {
      await this.scheduleLocalNotification(equipmentId, equipmentName, notificationTime);
    } else {
      await this.scheduleWebNotification(equipmentId, equipmentName, notificationTime);
    }
  }

  private async scheduleLocalNotification(equipmentId: string, equipmentName: string, notificationTime: Date) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Clean Beats Reminder',
            body: `Time to clean your ${equipmentName}! Cleaning is due in 1 hour.`,
            id: parseInt(equipmentId.replace(/\D/g, '').slice(0, 8)) || Math.floor(Math.random() * 100000),
            schedule: { at: notificationTime },
            sound: 'default',
            attachments: undefined,
            actionTypeId: '',
            extra: { equipmentId }
          }
        ]
      });
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  }

  private async scheduleWebNotification(equipmentId: string, equipmentName: string, notificationTime: Date) {
    if (this.serviceWorkerRegistration) {
      // Use service worker for persistent notifications
      const notificationId = `cleaning-${equipmentId}`;
      
      // Send notification data to service worker
      this.serviceWorkerRegistration.active?.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        id: notificationId,
        title: 'Clean Beats Reminder',
        body: `Time to clean your ${equipmentName}! Cleaning is due in 1 hour.`,
        scheduleTime: notificationTime.toISOString(),
        equipmentId
      });
    } else {
      // Fallback to setTimeout for browsers without service worker support
      const timeUntilNotification = notificationTime.getTime() - Date.now();
      
      if (timeUntilNotification > 0) {
        setTimeout(async () => {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Clean Beats Reminder', {
              body: `Time to clean your ${equipmentName}! Cleaning is due in 1 hour.`,
              icon: '/favicon.ico',
              tag: `cleaning-${equipmentId}`,
              requireInteraction: true
            });
          }
          await this.sendEmailNotification(equipmentName);
        }, timeUntilNotification);
      }
    }
  }

  private async sendEmailNotification(equipmentName: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      await supabase.functions.invoke('send-cleaning-reminder', {
        body: {
          email: user.email,
          equipmentName
        }
      });
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  async cancelNotification(equipmentId: string) {
    if (this.isNative) {
      try {
        const notificationId = parseInt(equipmentId.replace(/\D/g, '').slice(0, 8)) || Math.floor(Math.random() * 100000);
        await LocalNotifications.cancel({
          notifications: [{ id: notificationId }]
        });
      } catch (error) {
        console.error('Error canceling notification:', error);
      }
    } else if (this.serviceWorkerRegistration) {
      // Cancel web notification via service worker
      this.serviceWorkerRegistration.active?.postMessage({
        type: 'CANCEL_NOTIFICATION',
        equipmentId
      });
    }
  }

  async cancelAllNotifications() {
    if (this.isNative) {
      try {
        await LocalNotifications.removeAllDeliveredNotifications();
      } catch (error) {
        console.error('Error canceling all notifications:', error);
      }
    }
  }
}

export const notificationService = new NotificationService();
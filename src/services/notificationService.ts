import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { fcmService } from './fcmService';

interface NotificationData {
  equipmentId: string;
  equipmentName: string;
  nextCleaningDue: string;
}

class NotificationService {
  private isNative = Capacitor.isNativePlatform();
  private platform = Capacitor.getPlatform();
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    console.log('NotificationService: Platform detection:', {
      isNative: this.isNative,
      platform: this.platform,
      capacitorPlatform: Capacitor.getPlatform()
    });
  }

  async initializeServiceWorker(): Promise<void> {
    if (!this.isNative && 'serviceWorker' in navigator) {
      try {
        console.log('📋 Registering service worker...');
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service worker registered successfully');
        
        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready;
        console.log('✅ Service worker ready');
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log('Message from service worker:', event.data);
          if (event.data.type === 'MARK_EQUIPMENT_CLEANED') {
            this.handleEquipmentCleaned(event.data.equipmentId);
          }
        });
      } catch (error) {
        console.error('❌ Service worker registration failed:', error);
        throw error;
      }
    } else {
      console.warn('⚠️ Service workers not supported');
    }
  }

  async initializePushNotifications(): Promise<void> {
    try {
      console.log('📱 Initializing push notifications for platform:', this.platform, 'Native:', this.isNative);
      
      if (this.isNative) {
        // Native platform - use Capacitor Push Notifications
        console.log('🔧 Using Capacitor Push Notifications for native platform');
        
        // Request permissions first
        const permissionStatus = await PushNotifications.requestPermissions();
        console.log('📱 Native push permission status:', permissionStatus);
        
        if (permissionStatus.receive === 'granted') {
          await PushNotifications.register();
          
          PushNotifications.addListener('registration', async (token) => {
            console.log('📱 Native push registration success, token:', token.value);
            
            // Save token to database
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await this.saveNativeTokenToDatabase(token.value, user.id);
              }
            } catch (error) {
              console.error('❌ Error saving native token:', error);
            }
          });
          
          PushNotifications.addListener('registrationError', (error) => {
            console.error('📱 Native push registration error:', error);
          });
          
          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('📱 Native push received:', notification);
            // Handle foreground notification
            this.handleNativePushReceived(notification);
          });
          
          PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('📱 Native push action performed:', notification);
            // Handle notification tap
            this.handleNativePushAction(notification);
          });
        }
      } else {
        // Web platform - use FCM
        console.log('🌐 Using FCM for web platform');
        await fcmService.initialize();
      }
      
      console.log('✅ Push notifications initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error);
      throw error;
    }
  }

  async hasPermission(): Promise<boolean> {
    if (this.isNative) {
      try {
        const localPerm = await LocalNotifications.checkPermissions();
        const pushPerm = await PushNotifications.checkPermissions();
        return localPerm.display === 'granted' && pushPerm.receive === 'granted';
      } catch {
        return false;
      }
    } else {
      if (!('Notification' in window)) {
        return false;
      }
      return Notification.permission === 'granted';
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      console.log('🔔 Requesting permissions for platform:', this.platform, 'Native:', this.isNative);
      
      if (this.isNative) {
        // Native permissions - use Capacitor
        console.log('📱 Requesting native permissions...');
        
        const pushPermission = await PushNotifications.requestPermissions();
        console.log('📱 Push permission result:', pushPermission);
        
        const localPermission = await LocalNotifications.requestPermissions();
        console.log('📱 Local permission result:', localPermission);
        
        const granted = pushPermission.receive === 'granted' && localPermission.display === 'granted';
        console.log('📱 Native notification permissions granted:', granted);
        
        if (granted) {
          // Initialize native push notifications
          await this.initializePushNotifications();
        }
        
        return granted;
      } else {
        // Web permissions
        if (!('Notification' in window)) {
          console.warn('⚠️ Notifications not supported in this browser');
          return false;
        }

        let permission = Notification.permission;
        console.log('🌐 Current web notification permission:', permission);
        
        if (permission === 'default') {
          console.log('🔔 Requesting web notification permission...');
          permission = await Notification.requestPermission();
        }

        const granted = permission === 'granted';
        console.log('🔔 Web notification permission result:', permission, 'Granted:', granted);

        if (granted) {
          // Initialize FCM and register token
          await this.initializePushNotifications();
          await fcmService.getRegistrationToken();
        }

        return granted;
      }
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

  // Listen for incoming notifications and send push notifications
  async setupNotificationListeners(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('👂 Setting up notification listeners for user:', user.id);

      // Listen for new notifications in real-time
      const channel = supabase
        .channel('notifications-channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          async (payload) => {
            console.log('📥 New notification received:', payload.new);
            
            const notification = payload.new as any;
            
            // Send push notification for certain types
            const pushNotificationTypes = [
              'like',
              'comment', 
              'comment_reply',
              'follow',
              'event_like',
              'event_comment',
              'cleaning_reminder',
              'event_reminder'
            ];

            if (pushNotificationTypes.includes(notification.type)) {
              try {
                await supabase.functions.invoke('send-push-notification', {
                  body: {
                    user_id: user.id,
                    title: notification.title,
                    body: notification.message,
                    notification_type: notification.type,
                    data: {
                      notification_id: notification.id,
                      type: notification.type,
                      ...notification.data
                    }
                  }
                });
                console.log('🚀 Push notification sent for:', notification.type);
              } catch (error) {
                console.error('❌ Error sending push notification:', error);
              }
            }
          }
        )
        .subscribe();

      // Store the channel reference for cleanup
      (window as any).__notificationChannel = channel;

    } catch (error) {
      console.error('❌ Error setting up notification listeners:', error);
    }
  }

  // Clean up notification listeners
  cleanupListeners(): void {
    const channel = (window as any).__notificationChannel;
    if (channel) {
      supabase.removeChannel(channel);
      delete (window as any).__notificationChannel;
    }
  }

  private async handleEquipmentCleaned(equipmentId: string) {
    console.log(`Equipment ${equipmentId} marked as cleaned from notification`);
  }

  async sendTestNotification(): Promise<boolean> {
    console.log('Sending test notification...');
    
    // First, create an in-app notification in the database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('Creating in-app notification for user:', user.id);
        const { error: dbError } = await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type: 'test',
            title: 'Test Notification',
            message: 'This is a test notification from Clean Beats! 🎵 Your notifications are working correctly.',
            data: {
              test: true,
              timestamp: new Date().toISOString()
            }
          });
        
        if (dbError) {
          console.error('Error creating in-app notification:', dbError);
        } else {
          console.log('In-app notification created successfully');
        }
      }
    } catch (error) {
      console.error('Error creating in-app notification:', error);
    }
    
    if (this.isNative) {
      try {
        console.log('Attempting to schedule native notification...');
        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'Clean Beats Test',
              body: 'This is a test notification from Clean Beats! 🎵',
              id: 999999,
              schedule: { at: new Date(Date.now() + 1000) },
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
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
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
          
          setTimeout(() => {
            notification.close();
          }, 5000);
          
          return true;
        } catch (error) {
          console.error('Error creating notification:', error);
          return false;
        }
      }
    }
    
    return true;
  }

  async scheduleCleaningNotification(data: NotificationData) {
    const { equipmentId, equipmentName, nextCleaningDue } = data;
    const dueDate = new Date(nextCleaningDue);
    const notificationTime = new Date(dueDate.getTime() - (60 * 60 * 1000)); // 1 hour before

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
      const notificationId = `cleaning-${equipmentId}`;
      
      this.serviceWorkerRegistration.active?.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        id: notificationId,
        title: 'Clean Beats Reminder',
        body: `Time to clean your ${equipmentName}! Cleaning is due in 1 hour.`,
        scheduleTime: notificationTime.toISOString(),
        equipmentId
      });
    } else {
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

  private async saveNativeTokenToDatabase(token: string, userId: string): Promise<boolean> {
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: this.platform,
        timestamp: new Date().toISOString()
      };

      // Save native token to fcm_tokens table for consistency
      const { error } = await supabase
        .from('fcm_tokens')
        .upsert({
          user_id: userId,
          token,
          platform: this.platform,
          device_info: deviceInfo,
          is_active: true,
          last_used_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,platform,token'
        });

      if (error) {
        console.error('Error saving native token:', error);
        return false;
      }

      console.log('Native token saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving native token to database:', error);
      return false;
    }
  }

  private handleNativePushReceived(notification: any): void {
    console.log('Native push notification received in foreground:', notification);
    
    // Handle foreground notifications on native platforms
    // The notification is already displayed by the system, 
    // but we can handle any additional logic here
  }

  private handleNativePushAction(notification: any): void {
    console.log('Native push notification action performed:', notification);
    
    // Handle notification tap/action
    if (notification.notification?.data) {
      const data = notification.notification.data;
      this.handleNotificationNavigation(data);
    }
  }

  private handleNotificationNavigation(data: any): void {
    // Handle notification click navigation
    if (data.type === 'cleaning_reminder' && data.equipmentId) {
      window.location.href = '/equipment';
    } else if (data.type === 'comment' && data.postId) {
      window.location.href = '/community';
    } else if (data.type === 'event_reminder' && data.eventId) {
      window.location.href = '/calendar';
    }
  }
}

export const notificationService = new NotificationService();
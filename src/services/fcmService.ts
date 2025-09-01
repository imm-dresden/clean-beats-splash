import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { initializeMessaging } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FCMNotificationData {
  equipmentId?: string;
  equipmentName?: string;
  nextCleaningDue?: string;
  postId?: string;
  eventId?: string;
  userId?: string;
}

class FCMService {
  private messaging: any = null;
  private isInitialized = false;
  private currentToken: string | null = null;
  private platform: 'web' | 'ios' | 'android' = 'web';

  constructor() {
    this.platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 
                   Capacitor.getPlatform() === 'android' ? 'android' : 'web';
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      if (this.platform === 'web') {
        await this.initializeWeb();
      } else {
        await this.initializeNative();
      }
      
      this.isInitialized = true;
      console.log(`FCM Service initialized for platform: ${this.platform}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize FCM Service:', error);
      return false;
    }
  }

  private async initializeWeb(): Promise<void> {
    this.messaging = await initializeMessaging();
    if (!this.messaging) {
      throw new Error('Firebase Messaging not supported in this browser');
    }

    // Set up foreground message listener
    onMessage(this.messaging, (payload) => {
      console.log('Foreground message received:', payload);
      this.handleForegroundMessage(payload);
    });
  }

  private async initializeNative(): Promise<void> {
    // Check permissions
    const permissions = await FirebaseMessaging.checkPermissions();
    console.log('Current FCM permissions:', permissions);

    // Request permissions if needed
    if (permissions.receive !== 'granted') {
      const result = await FirebaseMessaging.requestPermissions();
      if (result.receive !== 'granted') {
        throw new Error('FCM permissions not granted');
      }
    }

    // Add listeners for native platforms
    await FirebaseMessaging.addListener('tokenReceived', (event) => {
      console.log('FCM token received:', event.token);
      this.handleTokenReceived(event.token);
    });

    await FirebaseMessaging.addListener('notificationReceived', (event) => {
      console.log('FCM notification received:', event);
      this.handleNotificationReceived(event);
    });

    await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      console.log('FCM notification action performed:', event);
      this.handleNotificationAction(event);
    });
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (this.platform === 'web') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } else {
        const result = await FirebaseMessaging.requestPermissions();
        return result.receive === 'granted';
      }
    } catch (error) {
      console.error('Error requesting FCM permissions:', error);
      return false;
    }
  }

  async getRegistrationToken(): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (this.platform === 'web') {
        if (!this.messaging) return null;
        
        const token = await getToken(this.messaging, {
          vapidKey: 'BOjW8VN8JYNBq_YNdoWN8JYNBq_YNdoWN8JYNBq_YNdoWN8JYNBq_YNdoWN8JYNBq_YNdoWN8JYNBq_YNdoWN8JYNBq_YNdoWN8JYNBq_YNdoWN8' // Placeholder VAPID key
        });
        return token;
      } else {
        const result = await FirebaseMessaging.getToken();
        return result.token;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  async saveTokenToDatabase(token: string, userId: string): Promise<boolean> {
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: this.platform,
        timestamp: new Date().toISOString()
      };

      // First, deactivate any existing tokens for this user/platform combination
      await supabase
        .from('fcm_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('platform', this.platform);

      // Insert the new token
      const { error } = await supabase
        .from('fcm_tokens')
        .insert({
          user_id: userId,
          token,
          platform: this.platform,
          device_info: deviceInfo,
          is_active: true
        });

      if (error) {
        console.error('Error saving FCM token:', error);
        return false;
      }

      this.currentToken = token;
      console.log('FCM token saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving FCM token to database:', error);
      return false;
    }
  }

  async subscribeToTopic(topic: string): Promise<boolean> {
    try {
      if (this.platform !== 'web') {
        await FirebaseMessaging.subscribeToTopic({ topic });
        console.log(`Subscribed to topic: ${topic}`);
        return true;
      }
      // Web platform topic subscription is handled server-side
      return true;
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
      return false;
    }
  }

  async unsubscribeFromTopic(topic: string): Promise<boolean> {
    try {
      if (this.platform !== 'web') {
        await FirebaseMessaging.unsubscribeFromTopic({ topic });
        console.log(`Unsubscribed from topic: ${topic}`);
        return true;
      }
      return true;
    } catch (error) {
      console.error(`Error unsubscribing from topic ${topic}:`, error);
      return false;
    }
  }

  async sendTestNotification(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('send-fcm-notification', {
        body: {
          userId,
          title: 'Test Notification',
          body: 'This is a test notification from Clean Beats!',
          data: {
            type: 'test',
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) {
        console.error('Error sending test notification:', error);
        toast.error('Failed to send test notification');
        return false;
      }

      toast.success('Test notification sent!');
      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
      return false;
    }
  }

  private handleTokenReceived(token: string): void {
    console.log('New FCM token received:', token);
    // Token will be saved when user logs in
  }

  private handleNotificationReceived(notification: any): void {
    console.log('FCM notification received in foreground:', notification);
    
    // Show toast for foreground notifications
    toast(notification.title || 'New Notification', {
      description: notification.body,
      action: notification.data ? {
        label: 'View',
        onClick: () => this.handleNotificationClick(notification.data)
      } : undefined
    });
  }

  private handleNotificationAction(event: any): void {
    console.log('FCM notification action performed:', event);
    
    if (event.notification?.data) {
      this.handleNotificationClick(event.notification.data);
    }
  }

  private handleForegroundMessage(payload: any): void {
    console.log('Foreground FCM message:', payload);
    
    // Show toast for web foreground messages
    toast(payload.notification?.title || 'New Notification', {
      description: payload.notification?.body,
      action: payload.data ? {
        label: 'View',
        onClick: () => this.handleNotificationClick(payload.data)
      } : undefined
    });
  }

  private handleNotificationClick(data: any): void {
    // Handle notification click navigation
    if (data.type === 'cleaning_reminder' && data.equipmentId) {
      window.location.href = '/equipment';
    } else if (data.type === 'comment' && data.postId) {
      window.location.href = '/community';
    } else if (data.type === 'event_reminder' && data.eventId) {
      window.location.href = '/calendar';
    }
  }

  async trackNotificationDelivery(
    userId: string, 
    notificationType: string, 
    status: 'sent' | 'delivered' | 'failed' | 'clicked',
    fcmMessageId?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      await supabase
        .from('notification_deliveries')
        .insert({
          user_id: userId,
          notification_type: notificationType,
          fcm_message_id: fcmMessageId,
          platform: this.platform,
          status,
          error_message: errorMessage,
          metadata: {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }
        });
    } catch (error) {
      console.error('Error tracking notification delivery:', error);
    }
  }

  getCurrentToken(): string | null {
    return this.currentToken;
  }

  getPlatform(): string {
    return this.platform;
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

export const fcmService = new FCMService();
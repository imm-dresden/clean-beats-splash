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
    this.detectPlatform();
  }

  private detectPlatform() {
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    
    // Android-specific detection improvements
    const isAndroidPlatform = platform === 'android';
    const isIOSPlatform = platform === 'ios';
    const hasAndroidUserAgent = /Android/i.test(navigator.userAgent);
    
    // Enhanced native detection - check for multiple indicators
    const hasFirebasePlugin = Capacitor.isPluginAvailable('FirebaseMessaging');
    const hasPushPlugin = Capacitor.isPluginAvailable('PushNotifications');
    const hasDevicePlugin = Capacitor.isPluginAvailable('Device');
    
    // More aggressive Android detection for FCM
    const actuallyAndroid = isAndroidPlatform || (hasAndroidUserAgent && (hasFirebasePlugin || hasPushPlugin));
    const actuallyIOS = isIOSPlatform && (hasFirebasePlugin || hasPushPlugin);
    const actuallyNative = isNative || actuallyAndroid || actuallyIOS;
    
    console.log('FCM: Enhanced Android Platform Detection:', {
      'Platform': platform,
      'isNativePlatform()': isNative,
      'isAndroidPlatform': isAndroidPlatform,
      'hasAndroidUserAgent': hasAndroidUserAgent,
      'Firebase Plugin': hasFirebasePlugin,
      'Push Notifications Plugin': hasPushPlugin,
      'Device Plugin': hasDevicePlugin,
      'actuallyAndroid': actuallyAndroid,
      'actuallyIOS': actuallyIOS,
      'Actually Native': actuallyNative
    });
    
    // Set platform based on detected environment with Android priority
    if (actuallyAndroid) {
      this.platform = 'android';
    } else if (actuallyIOS) {
      this.platform = 'ios';
    } else {
      this.platform = 'web';
    }
    
    console.log('FCM: Final platform determination:', this.platform);
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
    console.log('FCM: Initializing web platform...');
    
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      throw new Error('This browser does not support service workers');
    }

    console.log('FCM: Browser supports notifications and service workers');
    
    this.messaging = await initializeMessaging();
    if (!this.messaging) {
      throw new Error('Firebase Messaging not supported in this browser');
    }

    console.log('FCM: Firebase messaging initialized successfully');

    // Set up foreground message listener
    onMessage(this.messaging, (payload) => {
      console.log('FCM: Foreground message received:', payload);
      this.handleForegroundMessage(payload);
    });
  }

  private async initializeNative(): Promise<void> {
    console.log('FCM: Initializing native platform (Android/iOS)...');
    
    try {
      // Check permissions first
      const permissions = await FirebaseMessaging.checkPermissions();
      console.log('FCM: Current permissions:', permissions);

      // Request permissions if needed
      if (permissions.receive !== 'granted') {
        console.log('FCM: Requesting permissions...');
        const result = await FirebaseMessaging.requestPermissions();
        console.log('FCM: Permission request result:', result);
        if (result.receive !== 'granted') {
          throw new Error('FCM permissions not granted');
        }
      }

      // Clear any existing listeners to prevent duplicates
      await FirebaseMessaging.removeAllListeners();

      // Add listeners for native platforms with enhanced error handling
      await FirebaseMessaging.addListener('tokenReceived', (event) => {
        console.log('FCM: Token received event:', event);
        if (event.token) {
          this.currentToken = event.token;
          this.handleTokenReceived(event.token);
        }
      });

      await FirebaseMessaging.addListener('notificationReceived', (event) => {
        console.log('FCM: Notification received event:', event);
        this.handleNotificationReceived(event);
      });

      await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        console.log('FCM: Notification action performed event:', event);
        this.handleNotificationAction(event);
      });

      // For Android, ensure we get the token immediately after setup
      if (this.platform === 'android') {
        try {
          const tokenResult = await FirebaseMessaging.getToken();
          if (tokenResult?.token) {
            console.log('FCM: Initial Android token retrieved:', tokenResult.token);
            this.currentToken = tokenResult.token;
          }
        } catch (tokenError) {
          console.error('FCM: Error getting initial Android token:', tokenError);
        }
      }

      console.log('FCM: Native platform initialization complete');
    } catch (error) {
      console.error('FCM: Error initializing native platform:', error);
      throw error;
    }
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
    console.log('FCM: Getting registration token...');
    console.log('FCM: Platform:', this.platform);
    console.log('FCM: Service initialized:', this.isInitialized);
    
    if (!this.isInitialized) {
      console.log('FCM: Service not initialized, initializing now...');
      const initResult = await this.initialize();
      console.log('FCM: Initialization result:', initResult);
      if (!initResult) {
        console.error('FCM: Failed to initialize service');
        return null;
      }
    }

    try {
      if (this.platform === 'web') {
        if (!this.messaging) {
          console.error('FCM: Messaging service not available');
          return null;
        }
        
        console.log('FCM: Requesting token for web platform...');
        
        // Check if notifications are supported
        if (!('Notification' in window)) {
          console.error('FCM: Notifications not supported in this browser');
          return null;
        }

        // Check current permission status
        const permission = Notification.permission;
        console.log('FCM: Current notification permission:', permission);
        
        if (permission === 'denied') {
          console.warn('FCM: Notification permissions previously denied, asking user to re-enable');
          // For denied permissions, we can't automatically request again
          // User needs to manually enable in browser settings
          throw new Error('Notification permissions are denied. Please enable notifications in your browser settings and try again.');
        }

        if (permission !== 'granted') {
          console.log('FCM: Requesting notification permissions...');
          const newPermission = await Notification.requestPermission();
          console.log('FCM: New permission status:', newPermission);
          
          if (newPermission !== 'granted') {
            console.error('FCM: Permissions not granted');
            throw new Error('Notification permissions are required for push notifications. Please allow notifications and try again.');
          }
        }

        // Try to get token without VAPID key first for testing
        console.log('FCM: Attempting to get token without VAPID key...');
        try {
          const token = await getToken(this.messaging);
          console.log('FCM: Token received successfully:', token ? 'YES' : 'NO');
          return token;
        } catch (vapidError) {
          console.warn('FCM: Failed without VAPID key, trying with VAPID key...', vapidError);
          
          // If that fails, try with VAPID key
          const token = await getToken(this.messaging, {
            vapidKey: 'BAsIKhZnbZ1wfr_LYQpsCrx7putqHnniiLTuy9jOLLmy2768wWOJk_DRrBXTI9v9rkv1V1qUcpxCHwAR9fLtfWY'
          });
          console.log('FCM: Token with VAPID key received:', token ? 'YES' : 'NO');
          return token;
        }
      } else {
        console.log('FCM: Getting token for native platform...');
        
        // Import FirebaseMessaging for native calls
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        
        // Make sure we have permissions before getting token
        const permissions = await FirebaseMessaging.checkPermissions();
        if (permissions.receive !== 'granted') {
          console.log('FCM: Requesting permissions before getting token...');
          const permResult = await FirebaseMessaging.requestPermissions();
          if (permResult.receive !== 'granted') {
            throw new Error('FCM permissions required for token retrieval');
          }
        }
        
        const result = await FirebaseMessaging.getToken();
        console.log('FCM: Native token received:', result?.token ? 'YES' : 'NO');
        this.currentToken = result.token;
        return result.token;
      }
    } catch (error) {
      console.error('FCM: Error getting registration token:', error);
      console.error('FCM: Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
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

      // Use upsert to either insert new token or update existing one
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
    console.log('FCM: Handling notification click with data:', data);
    
    // Handle notification click navigation based on type
    try {
      if (data.type === 'cleaning_reminder' && data.equipmentId) {
        console.log('FCM: Navigating to equipment page for cleaning reminder');
        window.location.href = '/equipment';
      } else if (data.type === 'comment' && data.postId) {
        console.log('FCM: Navigating to community page for comment');
        window.location.href = '/community';
      } else if (data.type === 'event_reminder' && data.eventId) {
        console.log('FCM: Navigating to calendar page for event reminder');
        window.location.href = '/calendar';
      } else if (data.type === 'like' && data.postId) {
        console.log('FCM: Navigating to community page for like notification');
        window.location.href = '/community';
      } else if (data.type === 'follow') {
        console.log('FCM: Navigating to profile page for follow notification');
        window.location.href = '/profile';
      } else if (data.type === 'streak_milestone') {
        console.log('FCM: Navigating to equipment page for streak milestone');
        window.location.href = '/equipment';
      } else {
        console.log('FCM: Default navigation to home for unknown notification type');
        window.location.href = '/';
      }
    } catch (error) {
      console.error('FCM: Error handling notification click:', error);
      // Fallback to home page
      window.location.href = '/';
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
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// OneSignal types
declare global {
  interface Window {
    OneSignal?: {
      init: (config: { appId: string; allowLocalhostAsSecureOrigin?: boolean }) => Promise<void>;
      on: (event: string, callback: (data: any) => void) => void;
      requestPermission: () => Promise<boolean>;
      isPushNotificationsEnabled: () => Promise<boolean>;
      getPlayerId: () => Promise<string | null>;
      setExternalUserId: (userId: string) => Promise<void>;
    };
    OneSignalDeferred?: any[];
  }
}

export interface OneSignalNotificationData {
  equipmentId?: string;
  equipmentName?: string;
  nextCleaningDue?: string;
  postId?: string;
  eventId?: string;
  userId?: string;
  type?: string;
}

class OneSignalService {
  private isInitialized = false;
  private currentPlayerId: string | null = null;
  private platform: 'web' | 'ios' | 'android' = 'web';
  private appId = 'cb8bf8b6-8599-4258-9e1b-56333c230041';

  constructor() {
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    
    // Enhanced native detection
    const hasNativePlugins = Capacitor.isPluginAvailable('PushNotifications') || 
                            Capacitor.isPluginAvailable('Device') || 
                            Capacitor.isPluginAvailable('StatusBar');
    
    const actuallyNative = isNative || hasNativePlugins;
    
    console.log('OneSignal: Enhanced Platform Detection:', {
      'Platform': platform,
      'isNativePlatform()': isNative, 
      'Push Notifications Plugin': Capacitor.isPluginAvailable('PushNotifications'),
      'Device Plugin': Capacitor.isPluginAvailable('Device'),
      'StatusBar Plugin': Capacitor.isPluginAvailable('StatusBar'),
      'Actually Native': actuallyNative
    });
    
    this.platform = actuallyNative ? 
      (platform === 'ios' ? 'ios' : 'android') : 'web';
    
    console.log('OneSignal: Final platform determination:', this.platform);
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
      console.log(`OneSignal Service initialized for platform: ${this.platform}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize OneSignal Service:', error);
      return false;
    }
  }

  private async initializeWeb(): Promise<void> {
    console.log('OneSignal: Initializing web platform...');
    
    // Check if OneSignal is available
    if (typeof window === 'undefined' || !window.OneSignal) {
      throw new Error('OneSignal SDK not loaded');
    }

    // Wait for OneSignal to be ready
    await window.OneSignal.init({
      appId: this.appId,
      allowLocalhostAsSecureOrigin: true,
    });

    // Set up event listeners
    window.OneSignal.on('subscriptionChange', (isSubscribed: boolean) => {
      console.log('OneSignal subscription changed:', isSubscribed);
      this.handleSubscriptionChange(isSubscribed);
    });

    window.OneSignal.on('notificationPermissionChange', (permissionChange: any) => {
      console.log('OneSignal permission changed:', permissionChange);
    });

    console.log('OneSignal: Web initialization complete');
  }

  private async initializeNative(): Promise<void> {
    console.log('OneSignal: Initializing native platform...');
    
    // For native platforms, OneSignal should be initialized via the native SDKs
    // This is typically done in the native app configuration
    // Here we just mark as initialized for native platforms
    
    console.log('OneSignal: Native initialization complete');
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (this.platform === 'web') {
        if (!window.OneSignal) {
          console.error('OneSignal not available');
          return false;
        }

        // Request notification permission
        const permission = await window.OneSignal.requestPermission();
        console.log('OneSignal permission result:', permission);
        return permission;
      } else {
        // For native platforms, permissions are handled by the native OneSignal SDK
        return true;
      }
    } catch (error) {
      console.error('Error requesting OneSignal permissions:', error);
      return false;
    }
  }

  async getPlayerId(): Promise<string | null> {
    console.log('OneSignal: Getting player ID...');
    console.log('OneSignal: Platform:', this.platform);
    console.log('OneSignal: Service initialized:', this.isInitialized);
    
    if (!this.isInitialized) {
      console.log('OneSignal: Service not initialized, initializing now...');
      const initResult = await this.initialize();
      console.log('OneSignal: Initialization result:', initResult);
      if (!initResult) {
        console.error('OneSignal: Failed to initialize service');
        return null;
      }
    }

    try {
      if (this.platform === 'web') {
        if (!window.OneSignal) {
          console.error('OneSignal: OneSignal not available');
          return null;
        }
        
        console.log('OneSignal: Getting player ID for web platform...');
        
        // Check if user is subscribed first
        const isSubscribed = await window.OneSignal.isPushNotificationsEnabled();
        console.log('OneSignal: Is subscribed:', isSubscribed);
        
        if (!isSubscribed) {
          console.log('OneSignal: User not subscribed, cannot get player ID');
          return null;
        }

        // Get the player ID
        const playerId = await window.OneSignal.getPlayerId();
        console.log('OneSignal: Player ID received:', playerId ? 'YES' : 'NO');
        
        this.currentPlayerId = playerId;
        return playerId;
      } else {
        console.log('OneSignal: Getting player ID for native platform...');
        // For native platforms, we need to implement OneSignal native SDK integration
        // This would require Capacitor OneSignal plugin
        return 'native-platform';
      }
    } catch (error) {
      console.error('OneSignal: Error getting player ID:', error);
      return null;
    }
  }

  async savePlayerIdToDatabase(playerId: string, userId: string): Promise<boolean> {
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: this.platform,
        timestamp: new Date().toISOString()
      };

      // Use upsert to either insert new player ID or update existing one
      const { error } = await supabase
        .from('onesignal_subscriptions')
        .upsert({
          user_id: userId,
          player_id: playerId,
          platform: this.platform,
          device_info: deviceInfo,
          is_active: true,
          last_used_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,player_id,platform'
        });

      if (error) {
        console.error('Error saving OneSignal player ID:', error);
        return false;
      }

      this.currentPlayerId = playerId;
      console.log('OneSignal player ID saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving OneSignal player ID to database:', error);
      return false;
    }
  }

  async setExternalUserId(userId: string): Promise<boolean> {
    try {
      if (this.platform === 'web' && window.OneSignal) {
        await window.OneSignal.setExternalUserId(userId);
        console.log('OneSignal external user ID set:', userId);
        return true;
      }
      // For native platforms, implement native SDK call
      return true;
    } catch (error) {
      console.error('Error setting OneSignal external user ID:', error);
      return false;
    }
  }

  async sendTestNotification(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('send-onesignal-notification', {
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

  private handleSubscriptionChange(isSubscribed: boolean): void {
    console.log('OneSignal subscription changed:', isSubscribed);
    
    if (isSubscribed) {
      // User subscribed, get and save player ID
      this.getPlayerId().then(async (playerId) => {
        if (playerId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await this.savePlayerIdToDatabase(playerId, user.id);
            await this.setExternalUserId(user.id);
          }
        }
      });
    } else {
      // User unsubscribed, mark as inactive in database
      this.handleUnsubscription();
    }
  }

  private async handleUnsubscription(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && this.currentPlayerId) {
        await supabase
          .from('onesignal_subscriptions')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('player_id', this.currentPlayerId);
      }
    } catch (error) {
      console.error('Error handling OneSignal unsubscription:', error);
    }
  }

  async trackNotificationDelivery(
    userId: string, 
    notificationType: string, 
    status: 'sent' | 'delivered' | 'failed' | 'clicked',
    oneSignalMessageId?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      await supabase
        .from('notification_deliveries')
        .insert({
          user_id: userId,
          notification_type: notificationType,
          onesignal_message_id: oneSignalMessageId,
          onesignal_player_id: this.currentPlayerId,
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

  getCurrentPlayerId(): string | null {
    return this.currentPlayerId;
  }

  getPlatform(): string {
    return this.platform;
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  getAppId(): string {
    return this.appId;
  }
}

export const oneSignalService = new OneSignalService();
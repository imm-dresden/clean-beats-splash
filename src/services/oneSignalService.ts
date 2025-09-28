import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// OneSignal types (loose to support v16 API changes)
declare global {
  interface Window {
    OneSignal?: any; // Use any to gracefully handle different SDK versions
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

    // Wait for OneSignal to be ready (v16 API)
    try {
      // OneSignal v16 doesn't use .on() method anymore
      // Just wait for it to be ready
      await new Promise((resolve) => {
        if (window.OneSignalDeferred) {
          window.OneSignalDeferred.push(() => resolve(true));
        } else {
          resolve(true);
        }
      });

      console.log('OneSignal: SDK ready, setting up listeners...');
      
      // For v16, we don't set up listeners here - they're handled differently
      // The SDK will handle subscription changes internally
      
    } catch (error) {
      console.warn('OneSignal setup warning:', error);
    }

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
      const os = window.OneSignal;
      if (this.platform === 'web' && os) {
        console.log('OneSignal: Requesting permissions...');
        
        // For OneSignal v16, use the Notifications API
        if (os.Notifications?.requestPermission) {
          try {
            const permission = await os.Notifications.requestPermission();
            console.log('OneSignal v16 permission result:', permission);
            return permission === 'granted';
          } catch (error) {
            console.warn('OneSignal v16 permission failed, trying fallback...', error);
          }
        }
        
        // Fallback to browser API
        if ('Notification' in window) {
          const browserPermission = await Notification.requestPermission();
          console.log('Browser permission result:', browserPermission);
          return browserPermission === 'granted';
        }
        
        return false;
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
    
    if (!this.isInitialized) {
      const initResult = await this.initialize();
      if (!initResult) {
        console.error('OneSignal: Failed to initialize service');
        return null;
      }
    }

    try {
      if (this.platform === 'web') {
        const os = window.OneSignal;
        if (!os) {
          console.error('OneSignal: OneSignal not available');
          return null;
        }
        
        console.log('OneSignal: Getting subscription ID for web platform...');
        
        // For OneSignal v16, use the new API
        if (os.Notifications?.getPushSubscriptionId) {
          try {
            const subscriptionId = await os.Notifications.getPushSubscriptionId();
            console.log('OneSignal v16: Got subscription ID:', !!subscriptionId);
            if (subscriptionId) {
              this.currentPlayerId = subscriptionId;
              return subscriptionId;
            }
          } catch (error) {
            console.warn('OneSignal v16 getPushSubscriptionId failed:', error);
          }
        }

        // Try other possible methods
        if (os.User?.getOnesignalId) {
          try {
            const onesignalId = await os.User.getOnesignalId();
            console.log('OneSignal: Got onesignal ID:', !!onesignalId);
            if (onesignalId) {
              this.currentPlayerId = onesignalId;
              return onesignalId;
            }
          } catch (error) {
            console.warn('OneSignal getOnesignalId failed:', error);
          }
        }

        console.warn('OneSignal: Could not determine player/subscription ID');
        return null;
      } else {
        console.log('OneSignal: Getting player ID for native platform...');
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
      const os = window.OneSignal;
      if (this.platform === 'web' && os) {
        if (typeof os.setExternalUserId === 'function') {
          await os.setExternalUserId(userId);
          console.log('OneSignal external user ID set (legacy):', userId);
          return true;
        }
        if (typeof os.login === 'function') {
          await os.login(userId);
          console.log('OneSignal external user ID set (v16 login):', userId);
          return true;
        }
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
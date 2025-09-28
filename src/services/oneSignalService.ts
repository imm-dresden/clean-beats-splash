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

    // Wait for SDK to be present and ready (max ~6s)
    const waitForSDK = async () => {
      const start = Date.now();
      while (typeof window === 'undefined' || !window.OneSignal) {
        await new Promise((r) => setTimeout(r, 150));
        if (Date.now() - start > 6000) throw new Error('OneSignal SDK not loaded');
      }
    };

    await waitForSDK();

    // Wait for OneSignal to be ready (v16 API)
    try {
      await new Promise((resolve) => {
        if (window.OneSignalDeferred) {
          window.OneSignalDeferred.push(() => resolve(true));
        } else {
          resolve(true);
        }
      });

      console.log('OneSignal: SDK ready, setting up listeners...');

      // Ensure OneSignal service worker is registered and active
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          const hasOSWorker = regs.some(r => r.active?.scriptURL?.includes('OneSignalSDKWorker.js'));
          if (!hasOSWorker) {
            console.log('OneSignal: Registering SDK service worker...');
            await navigator.serviceWorker.register('/OneSignalSDKWorker.js', { scope: '/' });
          } else {
            console.log('OneSignal: SDK service worker already registered');
          }
        }
      } catch (swErr) {
        console.warn('OneSignal: Could not verify/register service worker:', swErr);
      }
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
        
        // Check if notifications are supported
        if (!('Notification' in window)) {
          console.error('OneSignal: Notifications not supported in this browser');
          return false;
        }

        // Check current permission status
        const currentPermission = Notification.permission;
        console.log('OneSignal: Current permission status:', currentPermission);

        if (currentPermission === 'denied') {
          console.warn('OneSignal: Notifications are blocked. User needs to enable them manually.');
          return false;
        }

        if (currentPermission === 'granted') {
          console.log('OneSignal: Permissions already granted');
          return true;
        }

        // Try OneSignal v16 API first
        if (os.Notifications?.requestPermission) {
          try {
            console.log('OneSignal: Using v16 requestPermission...');
            const permission = await os.Notifications.requestPermission();
            console.log('OneSignal v16 permission result:', permission);
            return permission === 'granted';
          } catch (error) {
            console.warn('OneSignal v16 permission failed:', error);
            // Fall through to browser API
          }
        }
        
        // Fallback to browser API
        console.log('OneSignal: Using browser requestPermission...');
        const browserPermission = await Notification.requestPermission();
        console.log('Browser permission result:', browserPermission);
        return browserPermission === 'granted';
      } else {
        // For native platforms, permissions are handled by the native OneSignal SDK
        return true;
      }
    } catch (error) {
      console.error('Error requesting OneSignal permissions:', error);
      
      // Provide user-friendly error message
      if (error.message?.includes('Registration failed')) {
        console.error('OneSignal domain authorization required. Please configure your domain in OneSignal dashboard.');
      }
      
      return false;
    }
  }

  async ensureSubscription(): Promise<boolean> {
    try {
      const os = window.OneSignal;
      if (this.platform === 'web' && os) {
        console.log('OneSignal: Ensuring subscription...');
        
        // First check if we already have a subscription ID
        if (os.Notifications?.getPushSubscriptionId) {
          try {
            const existingId = await os.Notifications.getPushSubscriptionId();
            if (existingId) {
              console.log('OneSignal: Already subscribed with ID:', !!existingId);
              this.currentPlayerId = existingId;
              return true;
            }
          } catch (error) {
            console.warn('OneSignal: Error checking existing subscription:', error);
          }
        }
        
        // No subscription ID found, try to subscribe
        console.log('OneSignal: No subscription found, attempting to subscribe...');
        
        if (os.Notifications?.subscribe) {
          try {
            await os.Notifications.subscribe();
            console.log('OneSignal: Subscribe call completed');
            
            // Poll for subscription ID for up to 5 seconds
            if (os.Notifications.getPushSubscriptionId) {
              for (let i = 0; i < 10; i++) {
                const newId = await os.Notifications.getPushSubscriptionId();
                if (newId) {
                  console.log('OneSignal: Got subscription ID after subscribe:', !!newId);
                  this.currentPlayerId = newId;
                  return true;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          } catch (error) {
            console.warn('OneSignal: Subscribe failed:', error);
          }
        }
        
        // Fall back to other methods
        if (os.User?.getOnesignalId) {
          try {
            const onesignalId = await os.User.getOnesignalId();
            if (onesignalId) {
              console.log('OneSignal: Got onesignal ID as fallback:', !!onesignalId);
              this.currentPlayerId = onesignalId;
              return true;
            }
          } catch (error) {
            console.warn('OneSignal: getOnesignalId fallback failed:', error);
          }
        }
        
        console.warn('OneSignal: Could not establish subscription');
        return false;
      } else {
        // For native platforms, assume subscription is handled natively
        return true;
      }
    } catch (error) {
      console.error('OneSignal: Error ensuring subscription:', error);
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
        
        // First ensure we have a subscription
        const hasSubscription = await this.ensureSubscription();
        if (!hasSubscription) {
          console.warn('OneSignal: Could not establish subscription');
          return null;
        }
        
        // Return the player ID we got during ensureSubscription
        return this.currentPlayerId;
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
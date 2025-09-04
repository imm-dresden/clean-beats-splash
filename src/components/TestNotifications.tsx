import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fcmService } from '@/services/fcmService';
import { notificationService } from '@/services/notificationService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bell, Smartphone, Monitor, Tablet } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useViewport } from '@/hooks/useViewport';

export const TestNotifications = () => {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [platformInfo, setPlatformInfo] = useState({
    platform: 'unknown',
    isNative: false,
    serviceType: 'unknown'
  });
  
  const { isNative, platform } = useViewport();

  useEffect(() => {
    const detectPlatform = () => {
      const capacitorPlatform = Capacitor.getPlatform();
      const isCapacitorNative = Capacitor.isNativePlatform();
      const hasNativePlugins = Capacitor.isPluginAvailable('PushNotifications') || 
                              Capacitor.isPluginAvailable('Device') || 
                              Capacitor.isPluginAvailable('StatusBar');
      
      const actuallyNative = isCapacitorNative || hasNativePlugins;
      
      setPlatformInfo({
        platform: actuallyNative ? capacitorPlatform : 'web',
        isNative: actuallyNative,
        serviceType: actuallyNative ? 'Capacitor Push Notifications' : 'Firebase Cloud Messaging'
      });
      
      console.log('🔍 TestNotifications Platform Detection:', {
        'Capacitor Platform': capacitorPlatform,
        'isNativePlatform()': isCapacitorNative,
        'Push Plugin Available': Capacitor.isPluginAvailable('PushNotifications'),
        'Device Plugin Available': Capacitor.isPluginAvailable('Device'),
        'StatusBar Plugin Available': Capacitor.isPluginAvailable('StatusBar'),
        'Actually Native': actuallyNative,
        'Final Platform': actuallyNative ? capacitorPlatform : 'web',
        'Viewport Detection': { isNative, platform }
      });
    };

    detectPlatform();
  }, [isNative, platform]);

  const checkAuthAndToken = async () => {
    console.log('TestNotifications: Checking auth and token...');
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      console.error('TestNotifications: No authenticated user');
      toast.error('Please sign in to test notifications');
      return null;
    }
    console.log('TestNotifications: User authenticated:', currentUser.id);
    setUser(currentUser);

    if (platformInfo.isNative) {
      // For native platforms, we don't need FCM tokens
      console.log('TestNotifications: Using native platform, no FCM token needed');
      return { user: currentUser, token: 'native-platform' };
    } else {
      // For web platforms, get FCM token
      console.log('TestNotifications: Getting FCM token for web platform...');
      const fcmToken = await fcmService.getRegistrationToken();
      if (!fcmToken) {
        console.error('TestNotifications: Failed to get FCM token');
        toast.error('Failed to get FCM token. Check console for details.');
        return null;
      }
      console.log('TestNotifications: FCM token obtained successfully');
      setToken(fcmToken);
      return { user: currentUser, token: fcmToken };
    }
  };

  const initializeNotifications = async () => {
    setLoading(true);
    try {
      console.log('Initializing notifications for platform:', platformInfo.platform);
      
      if (platformInfo.isNative) {
        // Use Capacitor for native platforms
        console.log('Using Capacitor Push Notifications for native platform');
        
        // Request permissions using notification service
        const hasPermissions = await notificationService.requestPermissions();
        if (!hasPermissions) {
          toast.error('Notification permissions denied');
          return;
        }

        // Get user for token saving
        const { user: currentUser } = await checkAuthAndToken() || {};
        if (!currentUser) return;

        toast.success('Native push notifications initialized successfully!');
        setToken('native-platform-ready');
      } else {
        // Use FCM for web platform
        console.log('Using FCM for web platform');
        
        // Initialize FCM service
        const initialized = await fcmService.initialize();
        if (!initialized) {
          toast.error('Failed to initialize FCM service');
          return;
        }

        // Request permissions
        const hasPermissions = await fcmService.requestPermissions();
        if (!hasPermissions) {
          toast.error('Notification permissions denied');
          return;
        }

        // Get token and save to database
        const { user: currentUser, token: fcmToken } = await checkAuthAndToken() || {};
        if (!currentUser || !fcmToken) return;

        const saved = await fcmService.saveTokenToDatabase(fcmToken, currentUser.id);
        if (saved) {
          toast.success('FCM initialized successfully!');
        } else {
          toast.error('Failed to save FCM token');
        }
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
      toast.error('Failed to initialize notifications');
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setLoading(true);
    try {
      const { user: currentUser } = await checkAuthAndToken() || {};
      if (!currentUser) return;

      const { error } = await supabase.functions.invoke('send-fcm-notification', {
        body: {
          userId: currentUser.id,
          title: 'Test Notification 🧽',
          body: 'This is a test notification from Clean Beats!',
          data: {
            type: 'test',
            timestamp: new Date().toISOString(),
            action: 'open_app'
          },
          priority: 'high'
        }
      });

      if (error) {
        console.error('Error sending test notification:', error);
        toast.error(`Failed to send test notification: ${error.message}`);
        return;
      }

      toast.success('Test notification sent successfully!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    } finally {
      setLoading(false);
    }
  };

  const sendTopicNotification = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-fcm-notification', {
        body: {
          topic: 'all_users',
          title: 'Community Update 🎉',
          body: 'Check out the latest updates in Clean Beats!',
          data: {
            type: 'community_update',
            timestamp: new Date().toISOString()
          },
          imageUrl: 'https://via.placeholder.com/512x256.png?text=Clean+Beats',
          actionUrl: '/community'
        }
      });

      if (error) {
        console.error('Error sending topic notification:', error);
        toast.error(`Failed to send topic notification: ${error.message}`);
        return;
      }

      toast.success('Topic notification sent successfully!');
    } catch (error) {
      console.error('Error sending topic notification:', error);
      toast.error('Failed to send topic notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notification Testing
          </CardTitle>
          <CardDescription>
            Test Firebase Cloud Messaging across different platforms
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Platform Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {platformInfo.platform === 'web' && <Monitor className="h-4 w-4" />}
            {platformInfo.platform === 'ios' && <Smartphone className="h-4 w-4" />}
            {platformInfo.platform === 'android' && <Tablet className="h-4 w-4" />}
            Platform: {platformInfo.platform}
          </div>

          {/* Service Type */}
          <div className="text-sm text-muted-foreground">
            Service: {platformInfo.serviceType}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Service Status:</span>{' '}
              <span className={
                (platformInfo.isNative || fcmService.isServiceInitialized()) 
                  ? 'text-green-600' : 'text-red-600'
              }>
                {platformInfo.isNative 
                  ? 'Native Platform Ready' 
                  : (fcmService.isServiceInitialized() ? 'FCM Initialized' : 'Not Initialized')
                }
              </span>
            </div>
            {token && (
              <div className="text-sm">
                <span className="font-medium">Token:</span>{' '}
                <code className="text-xs bg-muted p-1 rounded">
                  {token.substring(0, 20)}...
                </code>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={initializeNotifications} 
              disabled={loading}
              className="w-full"
              variant={
                (platformInfo.isNative || fcmService.isServiceInitialized()) 
                  ? "outline" : "default"
              }
            >
              {loading 
                ? 'Initializing...' 
                : platformInfo.isNative 
                  ? 'Initialize Native Notifications & Request Permissions'
                  : 'Initialize FCM & Request Permissions'
              }
            </Button>

            <Button 
              onClick={sendTestNotification} 
              disabled={
                loading || 
                (!platformInfo.isNative && !fcmService.isServiceInitialized())
              }
              className="w-full"
              variant="secondary"
            >
              {loading ? 'Sending...' : 'Send Test Notification (Personal)'}
            </Button>

            <Button 
              onClick={sendTopicNotification} 
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              {loading ? 'Sending...' : 'Send Topic Notification (Broadcast)'}
            </Button>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-muted rounded-lg space-y-2">
            <h4 className="font-medium">Testing Instructions:</h4>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Click "Initialize" to set up notifications for your platform</li>
              <li>Allow permissions when prompted</li>
              <li>Send a test notification to see it in action</li>
              <li>Check console for detailed logs</li>
              {platformInfo.isNative ? (
                <li>Native platform detected - using Capacitor Push Notifications</li>
              ) : (
                <li>Web platform detected - using Firebase Cloud Messaging</li>
              )}
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
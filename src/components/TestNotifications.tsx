import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { oneSignalService } from '@/services/oneSignalService';
import { notificationService } from '@/services/notificationService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bell, Smartphone, Monitor, Tablet } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useViewport } from '@/hooks/useViewport';

export const TestNotifications = () => {
  const [loading, setLoading] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
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
      
      const newPlatformInfo = {
        platform: actuallyNative ? capacitorPlatform : 'web',
        isNative: actuallyNative,
        serviceType: actuallyNative ? 'Capacitor Push Notifications' : 'OneSignal Web Push'
      };
      
      // Only update if the platform info has actually changed
      setPlatformInfo(prevInfo => {
        if (prevInfo.platform !== newPlatformInfo.platform || 
            prevInfo.isNative !== newPlatformInfo.isNative ||
            prevInfo.serviceType !== newPlatformInfo.serviceType) {
          console.log('🔍 TestNotifications Platform Detection Updated:', {
            'Previous': prevInfo,
            'New': newPlatformInfo,
            'Capacitor Platform': capacitorPlatform,
            'isNativePlatform()': isCapacitorNative,
            'Actually Native': actuallyNative,
            'Viewport Detection': { isNative, platform }
          });
          return newPlatformInfo;
        }
        return prevInfo;
      });
    };

    detectPlatform();
  }, []); // Empty dependency array - only run once on mount

  const checkAuthAndPlayerId = useCallback(async () => {
    console.log('TestNotifications: Checking auth and player ID...');
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      console.error('TestNotifications: No authenticated user');
      toast.error('Please sign in to test notifications');
      return null;
    }
    console.log('TestNotifications: User authenticated:', currentUser.id);
    setUser(currentUser);

    if (platformInfo.isNative) {
      // For native platforms, we don't need OneSignal player IDs
      console.log('TestNotifications: Using native platform, no OneSignal player ID needed');
      return { user: currentUser, playerId: 'native-platform' };
    } else {
      // For web platforms, get OneSignal player ID
      console.log('TestNotifications: Getting OneSignal player ID for web platform...');
      const oneSignalPlayerId = await oneSignalService.getPlayerId();
      if (!oneSignalPlayerId) {
        console.error('TestNotifications: Failed to get OneSignal player ID');
        toast.error('Failed to get OneSignal player ID. Check console for details.');
        return null;
      }
      console.log('TestNotifications: OneSignal player ID obtained successfully');
      setPlayerId(oneSignalPlayerId);
      return { user: currentUser, playerId: oneSignalPlayerId };
    }
  }, [platformInfo.isNative]);

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
        const { user: currentUser } = await checkAuthAndPlayerId() || {};
        if (!currentUser) return;

        toast.success('Native push notifications initialized successfully!');
        setPlayerId('native-platform-ready');
      } else {
        // Use OneSignal for web platform
        console.log('Using OneSignal for web platform');
        
        // Initialize OneSignal service
        const initialized = await oneSignalService.initialize();
        if (!initialized) {
          toast.error('Failed to initialize OneSignal service');
          return;
        }

        // Request permissions
        const hasPermissions = await oneSignalService.requestPermissions();
        if (!hasPermissions) {
          toast.error('Notification permissions denied');
          return;
        }

        // Get player ID and save to database
        const { user: currentUser, playerId: oneSignalPlayerId } = await checkAuthAndPlayerId() || {};
        if (!currentUser || !oneSignalPlayerId) return;

        const saved = await oneSignalService.savePlayerIdToDatabase(oneSignalPlayerId, currentUser.id);
        if (saved) {
          // Set external user ID for targeting
          await oneSignalService.setExternalUserId(currentUser.id);
          toast.success('OneSignal initialized successfully!');
        } else {
          toast.error('Failed to save OneSignal player ID');
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
      const { user: currentUser } = await checkAuthAndPlayerId() || {};
      if (!currentUser) return;

      const { error } = await supabase.functions.invoke('send-onesignal-notification', {
        body: {
          userId: currentUser.id,
          title: 'Test Notification 🧽',
          body: 'This is a test notification from Clean Beats!',
          data: {
            type: 'test',
            timestamp: new Date().toISOString(),
            action: 'open_app'
          }
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
      const { error } = await supabase.functions.invoke('send-onesignal-notification', {
        body: {
          filters: [{"field": "tag", "key": "app", "relation": "=", "value": "clean-beats"}],
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
            Test OneSignal Push Notifications across different platforms
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
                (platformInfo.isNative || oneSignalService.isServiceInitialized()) 
                  ? 'text-green-600' : 'text-red-600'
              }>
                {platformInfo.isNative 
                  ? 'Native Platform Ready' 
                  : (oneSignalService.isServiceInitialized() ? 'OneSignal Initialized' : 'Not Initialized')
                }
              </span>
            </div>
            {playerId && (
              <div className="text-sm">
                <span className="font-medium">Player ID:</span>{' '}
                <code className="text-xs bg-muted p-1 rounded">
                  {playerId.length > 20 ? `${playerId.substring(0, 20)}...` : playerId}
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
                (platformInfo.isNative || oneSignalService.isServiceInitialized()) 
                  ? "outline" : "default"
              }
            >
              {loading 
                ? 'Initializing...' 
                : platformInfo.isNative 
                  ? 'Initialize Native Notifications & Request Permissions'
                  : 'Initialize OneSignal & Request Permissions'
              }
            </Button>

            <Button 
              onClick={sendTestNotification} 
              disabled={
                loading || 
                (!platformInfo.isNative && !oneSignalService.isServiceInitialized())
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
                <li>Web platform detected - using OneSignal Web Push</li>
              )}
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
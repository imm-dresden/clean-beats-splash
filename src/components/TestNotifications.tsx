import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fcmService } from '@/services/fcmService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bell, Smartphone, Monitor, Tablet } from 'lucide-react';

export const TestNotifications = () => {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const checkAuthAndToken = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      toast.error('Please sign in to test notifications');
      return null;
    }
    setUser(currentUser);

    const fcmToken = await fcmService.getRegistrationToken();
    if (!fcmToken) {
      toast.error('Failed to get FCM token. Please check permissions.');
      return null;
    }
    setToken(fcmToken);
    return { user: currentUser, token: fcmToken };
  };

  const initializeFCM = async () => {
    setLoading(true);
    try {
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

      // Get token
      const { user: currentUser, token: fcmToken } = await checkAuthAndToken() || {};
      if (!currentUser || !fcmToken) return;

      // Save token to database
      const saved = await fcmService.saveTokenToDatabase(fcmToken, currentUser.id);
      if (saved) {
        toast.success('FCM initialized successfully!');
      } else {
        toast.error('Failed to save FCM token');
      }
    } catch (error) {
      console.error('Error initializing FCM:', error);
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
            {fcmService.getPlatform() === 'web' && <Monitor className="h-4 w-4" />}
            {fcmService.getPlatform() === 'ios' && <Smartphone className="h-4 w-4" />}
            {fcmService.getPlatform() === 'android' && <Tablet className="h-4 w-4" />}
            Platform: {fcmService.getPlatform()}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">FCM Service:</span>{' '}
              <span className={fcmService.isServiceInitialized() ? 'text-green-600' : 'text-red-600'}>
                {fcmService.isServiceInitialized() ? 'Initialized' : 'Not Initialized'}
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
              onClick={initializeFCM} 
              disabled={loading}
              className="w-full"
              variant={fcmService.isServiceInitialized() ? "outline" : "default"}
            >
              {loading ? 'Initializing...' : 'Initialize FCM & Request Permissions'}
            </Button>

            <Button 
              onClick={sendTestNotification} 
              disabled={loading || !fcmService.isServiceInitialized()}
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
              <li>Click "Initialize FCM" to set up notifications</li>
              <li>Allow permissions when prompted</li>
              <li>Send a test notification to see it in action</li>
              <li>Check browser console for detailed logs</li>
              <li>For mobile testing, use Capacitor with physical devices</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
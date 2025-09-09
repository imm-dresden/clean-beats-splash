import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Smartphone, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { useEffect, useState } from 'react';

export const CapacitorNotificationTest = () => {
  const { toast } = useToast();
  const [isNative, setIsNative] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    const checkNativeStatus = () => {
      const native = Capacitor.isNativePlatform();
      setIsNative(native);
      
      if (native) {
        initializeCapacitorNotifications();
      }
    };

    checkNativeStatus();
  }, []);

  const initializeCapacitorNotifications = async () => {
    try {
      // Request permissions for local notifications
      const localPerms = await LocalNotifications.requestPermissions();
      console.log('Local notification permissions:', localPerms);
      
      // Request permissions for push notifications
      const pushPerms = await PushNotifications.requestPermissions();
      console.log('Push notification permissions:', pushPerms);
      
      if (pushPerms.receive === 'granted') {
        setHasPermissions(true);
        
        // Register for push notifications
        await PushNotifications.register();
        
        // Listen for registration token
        PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success, token: ' + token.value);
          setPushToken(token.value);
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Error on registration: ' + JSON.stringify(error));
        });
      }
    } catch (error) {
      console.error('Error initializing Capacitor notifications:', error);
    }
  };

  const sendLocalNotification = async () => {
    if (!isNative) {
      toast({
        title: "Not Available",
        description: "Local notifications are only available on native mobile platforms.",
        variant: "destructive"
      });
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: "Clean Beats Test 🎵",
            body: "This is a local notification test from Capacitor!",
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
            sound: undefined,
            attachments: undefined,
            actionTypeId: "",
            extra: {
              data: 'local_test'
            }
          }
        ]
      });
      
      toast({
        title: "Local Notification Scheduled",
        description: "Check your device notifications in 1 second!",
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
      toast({
        title: "Error",
        description: "Failed to send local notification: " + error,
        variant: "destructive"
      });
    }
  };

  const sendPushNotification = async () => {
    if (!isNative) {
      toast({
        title: "Not Available", 
        description: "Push notifications require native mobile platform.",
        variant: "destructive"
      });
      return;
    }

    if (!pushToken) {
      toast({
        title: "No Push Token",
        description: "Push notification token not available. Make sure permissions are granted.",
        variant: "destructive"
      });
      return;
    }

    try {
      // This would typically send through your backend
      // For now, just show that we have the token
      toast({
        title: "Push Token Available",
        description: `Token: ${pushToken.substring(0, 20)}...`,
      });
    } catch (error) {
      console.error('Error with push notification:', error);
      toast({
        title: "Error",
        description: "Failed to handle push notification: " + error,
        variant: "destructive"
      });
    }
  };

  const testWebNotification = async () => {
    if (isNative) {
      toast({
        title: "Not Available",
        description: "Use the native notification buttons above for mobile testing.",
        variant: "destructive"
      });
      return;
    }

    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
          new Notification('Clean Beats Test 🎵', {
            body: 'This is a web notification test!',
            icon: '/favicon.ico',
            tag: 'test-notification'
          });
          
          toast({
            title: "Web Notification Sent",
            description: "Check your browser notifications!",
          });
        } else {
          toast({
            title: "Permission Denied",
            description: "Web notification permission was denied.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Not Supported",
          description: "Web notifications are not supported in this browser.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error sending web notification:', error);
      toast({
        title: "Error",
        description: "Failed to send web notification: " + error,
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Testing
          <Badge variant={isNative ? "default" : "secondary"}>
            {isNative ? "Native" : "Web"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform Status */}
        <div className="flex items-center gap-2 text-sm">
          {isNative ? (
            <>
              <Smartphone className="w-4 h-4 text-green-500" />
              <span>Running on native mobile platform</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 text-blue-500" />
              <span>Running on web platform</span>
            </>
          )}
        </div>

        {/* Permission Status */}
        {isNative && (
          <div className="flex items-center gap-2 text-sm">
            {hasPermissions ? (
              <>
                <Bell className="w-4 h-4 text-green-500" />
                <span>Notification permissions granted</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span>Notification permissions needed</span>
              </>
            )}
          </div>
        )}

        {/* Push Token Status */}
        {isNative && pushToken && (
          <div className="text-xs text-muted-foreground">
            Push Token: {pushToken.substring(0, 40)}...
          </div>
        )}

        {/* Test Buttons */}
        <div className="space-y-2">
          {isNative ? (
            <>
              <Button
                onClick={sendLocalNotification}
                variant="outline"
                className="w-full"
              >
                <Bell className="w-4 h-4 mr-2" />
                Test Local Notification
              </Button>
              
              <Button
                onClick={sendPushNotification}
                variant="outline"
                className="w-full"
                disabled={!pushToken}
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Test Push Notification
              </Button>
            </>
          ) : (
            <Button
              onClick={testWebNotification}
              variant="outline"
              className="w-full"
            >
              <Bell className="w-4 h-4 mr-2" />
              Test Web Notification
            </Button>
          )}
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground">
          {isNative ? (
            <p>
              Local notifications appear immediately. Push notifications require backend integration.
            </p>
          ) : (
            <p>
              Web notifications appear in your browser. Make sure to allow notification permissions.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
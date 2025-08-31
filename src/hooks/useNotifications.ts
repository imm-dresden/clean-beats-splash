import { useState, useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const useNotifications = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  const { toast } = useToast();

  useEffect(() => {
    checkPermissions();
    detectTimezone();
  }, []);

  const detectTimezone = () => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setUserTimezone(timezone);
      saveUserTimezone(timezone);
    } catch (error) {
      console.error('Error detecting timezone:', error);
      setUserTimezone('UTC');
    }
  };

  const saveUserTimezone = async (timezone: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_timezones')
        .upsert({
          user_id: user.id,
          timezone,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving timezone:', error);
      }
    } catch (error) {
      console.error('Error saving user timezone:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Mobile platform - use Capacitor
        const result = await LocalNotifications.checkPermissions();
        setHasPermission(result.display === 'granted');
      } else {
        // Web platform - use browser API
        if ('Notification' in window) {
          setHasPermission(Notification.permission === 'granted');
        }
      }
    } catch (error) {
      console.error('Error checking notification permissions:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Mobile platform
        const result = await LocalNotifications.requestPermissions();
        const granted = result.display === 'granted';
        setHasPermission(granted);
        
        if (granted) {
          toast({
            title: "Notifications Enabled",
            description: "You'll receive cleaning reminders at 12 PM and 11:30 PM",
          });
        } else {
          toast({
            title: "Notifications Disabled",
            description: "Enable notifications in settings to receive cleaning reminders",
            variant: "destructive",
          });
        }
        
        return granted;
      } else {
        // Web platform
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          const granted = permission === 'granted';
          setHasPermission(granted);
          
          if (granted) {
            toast({
              title: "Notifications Enabled",
              description: "You'll receive cleaning reminders at 12 PM and 11:30 PM in your local time",
            });
          } else {
            toast({
              title: "Notifications Disabled",
              description: "Enable notifications in your browser to receive cleaning reminders",
              variant: "destructive",
            });
          }
          
          return granted;
        }
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      toast({
        title: "Error",
        description: "Failed to request notification permissions",
        variant: "destructive",
      });
      return false;
    }
  };

  const showNotification = async (title: string, body: string, data?: any) => {
    if (!hasPermission) {
      console.log('No notification permission');
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        // Mobile notification
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Date.now(),
              schedule: { at: new Date(Date.now() + 1000) }, // 1 second delay
              extra: data,
            },
          ],
        });
      } else {
        // Web notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
            data,
          });
        }
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  return {
    hasPermission,
    userTimezone,
    requestPermissions,
    showNotification,
    checkPermissions,
  };
};
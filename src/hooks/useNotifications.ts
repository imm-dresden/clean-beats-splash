import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { oneSignalService } from '@/services/oneSignalService';

export const useNotifications = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  const { toast } = useToast();

  useEffect(() => {
    initializeNotifications();
    detectTimezone();
  }, []);

  const initializeNotifications = async () => {
    try {
      // Initialize OneSignal service
      const initialized = await oneSignalService.initialize();
      if (initialized) {
        // Check existing permissions
        const hasPerms = await checkPermissions();
        setHasPermission(hasPerms);

        // Register player ID if user is logged in and has permissions
        if (hasPerms) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const playerId = await oneSignalService.getPlayerId();
            if (playerId) {
              await oneSignalService.savePlayerIdToDatabase(playerId, user.id);
              await oneSignalService.setExternalUserId(user.id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

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
      // Initialize OneSignal service if not already done
      const initialized = await oneSignalService.initialize();
      if (!initialized) {
        setHasPermission(false);
        return false;
      }

      // Check if we can get a player ID (indicates permissions are granted)
      const playerId = await oneSignalService.getPlayerId();
      const hasPerms = !!playerId;
      setHasPermission(hasPerms);
      return hasPerms;
    } catch (error) {
      console.error('Error checking OneSignal permissions:', error);
      setHasPermission(false);
      return false;
    }
  };

  const requestPermissions = async () => {
    try {
      // Initialize OneSignal service first
      const initialized = await oneSignalService.initialize();
      if (!initialized) {
        toast({
          title: "Error",
          description: "Failed to initialize notification service",
          variant: "destructive",
        });
        return false;
      }

      // Request permissions
      const permissionGranted = await oneSignalService.requestPermissions();
      if (!permissionGranted) {
        toast({
          title: "Notifications Disabled",
          description: "Enable notifications in settings to receive cleaning reminders",
          variant: "destructive",
        });
        setHasPermission(false);
        return false;
      }

      // Get player ID
      const playerId = await oneSignalService.getPlayerId();
      if (!playerId) {
        toast({
          title: "Error",
          description: "Failed to get notification player ID",
          variant: "destructive",
        });
        setHasPermission(false);
        return false;
      }

      // Save player ID to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const playerIdSaved = await oneSignalService.savePlayerIdToDatabase(playerId, user.id);
        if (!playerIdSaved) {
          toast({
            title: "Error",
            description: "Failed to register for notifications",
            variant: "destructive",
          });
          return false;
        }

        // Set external user ID for targeting
        await oneSignalService.setExternalUserId(user.id);
      }

      setHasPermission(true);
      toast({
        title: "Notifications Enabled",
        description: "You'll receive cleaning reminders and app updates",
      });
      return true;
    } catch (error) {
      console.error('Error requesting OneSignal permissions:', error);
      toast({
        title: "Error",
        description: "Failed to enable notifications",
        variant: "destructive",
      });
      setHasPermission(false);
      return false;
    }
  };

  const showNotification = async (title: string, body: string, data?: any) => {
    const hasPerms = await checkPermissions();
    if (!hasPerms) {
      console.log('No notification permissions, skipping notification');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('User not logged in, skipping notification');
        return;
      }

      // Send notification via OneSignal edge function
      const { error } = await supabase.functions.invoke('send-onesignal-notification', {
        body: {
          userId: user.id,
          title,
          body,
          data: {
            type: 'test',
            ...data
          }
        }
      });

      if (error) {
        console.error('Error sending notification:', error);
        toast({
          title: "Error",
          description: "Failed to send notification",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error showing notification:', error);
      toast({
        title: "Error",
        description: "Failed to send notification",
        variant: "destructive",
      });
    }
  };

  const sendTestNotification = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "Must be logged in to send test notification",
        variant: "destructive",
      });
      return false;
    }

    return await oneSignalService.sendTestNotification(user.id);
  };

  return {
    hasPermission,
    userTimezone,
    requestPermissions,
    showNotification,
    checkPermissions,
    sendTestNotification,
  };
};
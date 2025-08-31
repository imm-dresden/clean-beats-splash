import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

interface NotificationData {
  equipmentId: string;
  equipmentName: string;
  nextCleaningDue: string;
}

class NotificationService {
  private isNative = Capacitor.isNativePlatform();

  async requestPermissions() {
    if (this.isNative) {
      // Request both local and push notification permissions
      const localPermission = await LocalNotifications.requestPermissions();
      const pushPermission = await PushNotifications.requestPermissions();
      return localPermission.display === 'granted' && pushPermission.receive === 'granted';
    } else {
      // Web notifications
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
    }
    return false;
  }

  async initializePushNotifications() {
    if (!this.isNative) return;

    try {
      // Register for push notifications
      await PushNotifications.register();

      // Listen for push notification registration
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token: ' + token.value);
        // You can store this token in your backend for sending targeted notifications
      });

      // Listen for push notification registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error: ', error);
      });

      // Listen for incoming push notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ', notification);
      });

      // Listen for push notification actions
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action performed: ', notification);
      });
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  async sendTestNotification() {
    if (this.isNative) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'Test Notification',
              body: 'This is a test notification from Clean Beats!',
              id: 999999,
              schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
              sound: 'default',
              attachments: undefined,
              actionTypeId: '',
              extra: {}
            }
          ]
        });
        return true;
      } catch (error) {
        console.error('Error sending test notification:', error);
        return false;
      }
    } else {
      // Web test notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Test Notification', {
          body: 'This is a test notification from Clean Beats!',
          icon: '/favicon.ico'
        });
        return true;
      }
      return false;
    }
  }

  async scheduleCleaningNotification(data: NotificationData) {
    const { equipmentId, equipmentName, nextCleaningDue } = data;
    const dueDate = new Date(nextCleaningDue);
    const notificationTime = new Date(dueDate.getTime() - (60 * 60 * 1000)); // 1 hour before

    // Don't schedule if the time has already passed
    if (notificationTime <= new Date()) {
      return;
    }

    if (this.isNative) {
      await this.scheduleLocalNotification(equipmentId, equipmentName, notificationTime);
    } else {
      await this.scheduleWebNotification(equipmentId, equipmentName, notificationTime);
    }
  }

  private async scheduleLocalNotification(equipmentId: string, equipmentName: string, notificationTime: Date) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Clean Beats Reminder',
            body: `Time to clean your ${equipmentName}! Cleaning is due in 1 hour.`,
            id: parseInt(equipmentId.replace(/\D/g, '').slice(0, 8)) || Math.floor(Math.random() * 100000),
            schedule: { at: notificationTime },
            sound: 'default',
            attachments: undefined,
            actionTypeId: '',
            extra: { equipmentId }
          }
        ]
      });
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  }

  private async scheduleWebNotification(equipmentId: string, equipmentName: string, notificationTime: Date) {
    // For web, we'll use Resend to send email notifications
    const timeUntilNotification = notificationTime.getTime() - Date.now();
    
    if (timeUntilNotification > 0) {
      setTimeout(async () => {
        // Show browser notification if user is active
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Clean Beats Reminder', {
            body: `Time to clean your ${equipmentName}! Cleaning is due in 1 hour.`,
            icon: '/favicon.ico'
          });
        }
        
        // Also send email notification via Resend
        await this.sendEmailNotification(equipmentName);
      }, timeUntilNotification);
    }
  }

  private async sendEmailNotification(equipmentName: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      await supabase.functions.invoke('send-cleaning-reminder', {
        body: {
          email: user.email,
          equipmentName
        }
      });
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  async cancelNotification(equipmentId: string) {
    if (this.isNative) {
      try {
        const notificationId = parseInt(equipmentId.replace(/\D/g, '').slice(0, 8)) || Math.floor(Math.random() * 100000);
        await LocalNotifications.cancel({
          notifications: [{ id: notificationId }]
        });
      } catch (error) {
        console.error('Error canceling notification:', error);
      }
    }
  }

  async cancelAllNotifications() {
    if (this.isNative) {
      try {
        await LocalNotifications.removeAllDeliveredNotifications();
      } catch (error) {
        console.error('Error canceling all notifications:', error);
      }
    }
  }
}

export const notificationService = new NotificationService();
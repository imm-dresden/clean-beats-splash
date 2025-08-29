import { LocalNotifications } from '@capacitor/local-notifications';
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
      const permission = await LocalNotifications.requestPermissions();
      return permission.display === 'granted';
    } else {
      // Web notifications
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
    }
    return false;
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
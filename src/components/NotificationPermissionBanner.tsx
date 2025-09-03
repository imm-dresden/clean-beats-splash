import { useState, useEffect } from "react";
import { X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notificationService } from "@/services/notificationService";
import { useIsMobile } from "@/hooks/use-mobile";

const NotificationPermissionBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const hasPermission = 'Notification' in window && Notification.permission === 'granted';
        const hasAsked = localStorage.getItem('notification-permission-asked');
        
        if (isMobile && !hasPermission && !hasAsked) {
          setShowBanner(true);
        }
      } catch (error) {
        console.error('Error checking notification permission:', error);
      }
    };

    checkPermission();
  }, [isMobile]);

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      const granted = await notificationService.requestPermissions();
      localStorage.setItem('notification-permission-asked', 'true');
      setShowBanner(false);
    } catch (error) {
      console.error('Error requesting permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('notification-permission-asked', 'true');
    setShowBanner(false);
  };

  if (!showBanner || !isMobile) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-primary/95 backdrop-blur-md text-primary-foreground p-4 z-50 border-b border-primary/20">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center space-x-3 flex-1">
          <Bell className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Stay Connected</p>
            <p className="text-xs opacity-90">Get notified about likes, comments, and cleaning reminders</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-3">
          <Button 
            size="sm" 
            variant="secondary"
            onClick={handleRequestPermission}
            disabled={isLoading}
            className="text-xs px-3 py-1 h-auto"
          >
            {isLoading ? 'Enabling...' : 'Enable'}
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={handleDismiss}
            className="text-xs p-1 h-auto hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermissionBanner;
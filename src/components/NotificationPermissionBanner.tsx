import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, X, Clock } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

const NotificationPermissionBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { hasPermission, requestPermissions, userTimezone } = useNotifications();

  useEffect(() => {
    // Check if user has already dismissed the banner
    const dismissed = localStorage.getItem('notificationBannerDismissed');
    if (dismissed || hasPermission) {
      setIsDismissed(true);
      return;
    }

    // Show banner after a short delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasPermission]);

  const handleRequestPermission = async () => {
    const granted = await requestPermissions();
    if (granted) {
      setIsVisible(false);
      setIsDismissed(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('notificationBannerDismissed', 'true');
  };

  if (!isVisible || isDismissed || hasPermission) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5">
      <Card className="glass-card border-accent/50 shadow-2xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-accent" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">
                Enable Notifications
              </h3>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Get cleaning reminders at your local 12:00 PM and 11:30 PM, plus updates on likes and comments
              </p>
              
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Your timezone: {userTimezone}
                </span>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleRequestPermission}
                  className="h-8 px-3 text-xs"
                >
                  <Bell className="w-3 h-3 mr-1" />
                  Enable
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleDismiss}
                  className="h-8 px-3 text-xs"
                >
                  Maybe later
                </Button>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationPermissionBanner;
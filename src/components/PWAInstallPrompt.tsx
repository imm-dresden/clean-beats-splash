import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, X, Smartphone } from "lucide-react";
import { pwaService } from "@/lib/pwaService";
import { toast } from "@/hooks/use-toast";

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Check if app can be installed
    const checkInstallable = () => {
      setCanInstall(pwaService.canInstall());
    };

    // Listen for install prompt
    const handleBeforeInstallPrompt = () => {
      setShowPrompt(true);
      setCanInstall(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setShowPrompt(false);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Initial check
    checkInstallable();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    try {
      const result = await pwaService.promptInstall();
      if (result) {
        toast({
          title: "Installing App...",
          description: "Clean Beats is being installed on your device.",
        });
      }
    } catch (error) {
      console.error('Install error:', error);
      toast({
        title: "Installation Failed",
        description: "There was an error installing the app. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember user dismissed for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already dismissed this session
  if (sessionStorage.getItem('pwa-install-dismissed') === 'true') {
    return null;
  }

  // Don't show if app is already installed
  if (pwaService.isAppInstalled()) {
    return null;
  }

  // Only show if we can install and prompt is available
  if (!showPrompt || !canInstall) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 border-primary/20 bg-gradient-musical shadow-musical animate-scale-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/10 rounded-lg">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">Install Clean Beats</CardTitle>
              <CardDescription className="text-white/80 text-sm">
                Add to your home screen for quick access
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDismiss}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            Later
          </Button>
          <Button
            onClick={handleInstall}
            size="sm"
            className="bg-white text-primary hover:bg-white/90 font-medium"
          >
            <Download className="h-4 w-4 mr-2" />
            Install
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default PWAInstallPrompt;
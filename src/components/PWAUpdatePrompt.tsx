import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, X, Download } from "lucide-react";
import { pwaService } from "@/lib/pwaService";
import { toast } from "@/hooks/use-toast";

export function PWAUpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    // Check if update is available
    const checkUpdate = () => {
      setShowUpdate(pwaService.hasUpdateAvailable());
    };

    // Listen for service worker updates
    const handleServiceWorkerUpdate = () => {
      setShowUpdate(true);
    };

    // Check periodically
    const interval = setInterval(checkUpdate, 30000); // Every 30 seconds

    // Listen for custom update events
    window.addEventListener('sw-update-available', handleServiceWorkerUpdate);

    // Initial check
    checkUpdate();

    return () => {
      clearInterval(interval);
      window.removeEventListener('sw-update-available', handleServiceWorkerUpdate);
    };
  }, []);

  const handleUpdate = async () => {
    try {
      await pwaService.applyUpdate();
      toast({
        title: "Updating App...",
        description: "Clean Beats is being updated to the latest version.",
      });
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: "Update Failed",
        description: "There was an error updating the app. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
    // Remember user dismissed for this session
    sessionStorage.setItem('pwa-update-dismissed', 'true');
  };

  // Don't show if already dismissed this session
  if (sessionStorage.getItem('pwa-update-dismissed') === 'true') {
    return null;
  }

  if (!showUpdate) {
    return null;
  }

  return (
    <Card className="fixed top-4 left-4 right-4 z-50 border-accent/20 bg-gradient-electric shadow-glow animate-scale-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/10 rounded-lg">
              <RefreshCw className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">Update Available</CardTitle>
              <CardDescription className="text-white/80 text-sm">
                A new version of Clean Beats is ready
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
            onClick={handleUpdate}
            size="sm"
            className="bg-white text-accent hover:bg-white/90 font-medium"
          >
            <Download className="h-4 w-4 mr-2" />
            Update
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default PWAUpdatePrompt;
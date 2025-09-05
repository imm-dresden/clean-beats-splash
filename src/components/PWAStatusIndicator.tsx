import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Wifi, WifiOff, Download, RefreshCw } from "lucide-react";
import { pwaService } from "@/lib/pwaService";

export function PWAStatusIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Check installation status
    setIsInstalled(pwaService.isAppInstalled());
    setCanInstall(pwaService.canInstall());
    setUpdateAvailable(pwaService.hasUpdateAvailable());

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for PWA events
    const handleBeforeInstallPrompt = () => setCanInstall(true);
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    await pwaService.promptInstall();
  };

  const handleUpdate = async () => {
    await pwaService.applyUpdate();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          PWA Status
        </CardTitle>
        <CardDescription>
          Progressive Web App installation and connectivity status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">Connection</span>
          </div>
          <Badge variant={isOnline ? "default" : "destructive"}>
            {isOnline ? "Online" : "Offline"}
          </Badge>
        </div>

        {/* Installation Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span className="text-sm">Installation</span>
          </div>
          <div className="flex items-center gap-2">
            {isInstalled ? (
              <Badge variant="default">Installed</Badge>
            ) : canInstall ? (
              <>
                <Badge variant="secondary">Available</Badge>
                <Button size="sm" onClick={handleInstall}>
                  <Download className="h-3 w-3 mr-1" />
                  Install
                </Button>
              </>
            ) : (
              <Badge variant="outline">Not Available</Badge>
            )}
          </div>
        </div>

        {/* Update Status */}
        {updateAvailable && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm">Update</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">Available</Badge>
              <Button size="sm" onClick={handleUpdate}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Update
              </Button>
            </div>
          </div>
        )}

        {/* Features Status */}
        <div className="pt-2 border-t">
          <h4 className="text-sm font-medium mb-2">PWA Features</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span>Service Worker</span>
              <Badge variant="outline" className="text-xs">
                {'serviceWorker' in navigator ? 'Supported' : 'Not Supported'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Push Notifications</span>
              <Badge variant="outline" className="text-xs">
                {'PushManager' in window ? 'Supported' : 'Not Supported'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Background Sync</span>
              <Badge variant="outline" className="text-xs">
                {'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype ? 'Supported' : 'Not Supported'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Share API</span>
              <Badge variant="outline" className="text-xs">
                {navigator.share ? 'Supported' : 'Not Supported'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PWAStatusIndicator;
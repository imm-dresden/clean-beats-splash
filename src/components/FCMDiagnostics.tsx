import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fcmService } from '@/services/fcmService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Smartphone, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Bell,
  Settings
} from 'lucide-react';

interface DiagnosticInfo {
  platform: string;
  isNative: boolean;
  hasFirebasePlugin: boolean;
  hasPushPlugin: boolean;
  hasDevicePlugin: boolean;
  permissions: any;
  token: string | null;
  serviceInitialized: boolean;
  notificationPermission: string;
  serviceWorkerSupported: boolean;
  notificationAPISupported: boolean;
}

export const FCMDiagnostics: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const platform = Capacitor.getPlatform();
      const isNative = Capacitor.isNativePlatform();
      const hasFirebasePlugin = Capacitor.isPluginAvailable('FirebaseMessaging');
      const hasPushPlugin = Capacitor.isPluginAvailable('PushNotifications');
      const hasDevicePlugin = Capacitor.isPluginAvailable('Device');
      
      let permissions = null;
      let notificationPermission = 'unknown';
      let serviceWorkerSupported = false;
      let notificationAPISupported = false;

      // Check web-specific features
      if (typeof window !== 'undefined') {
        serviceWorkerSupported = 'serviceWorker' in navigator;
        notificationAPISupported = 'Notification' in window;
        if (notificationAPISupported) {
          notificationPermission = Notification.permission;
        }
      }

      // Check native permissions
      if (isNative && hasFirebasePlugin) {
        try {
          permissions = await FirebaseMessaging.checkPermissions();
        } catch (error) {
          console.error('Error checking permissions:', error);
        }
      }

      const token = fcmService.getCurrentToken();
      const serviceInitialized = fcmService.isServiceInitialized();

      setDiagnostics({
        platform,
        isNative,
        hasFirebasePlugin,
        hasPushPlugin,
        hasDevicePlugin,
        permissions,
        token,
        serviceInitialized,
        notificationPermission,
        serviceWorkerSupported,
        notificationAPISupported
      });
    } catch (error) {
      console.error('Error running diagnostics:', error);
      toast.error('Error running diagnostics');
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = async () => {
    setRefreshing(true);
    try {
      const token = await fcmService.getRegistrationToken();
      if (token) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await fcmService.saveTokenToDatabase(token, user.id);
          toast.success('Token refreshed successfully');
        }
      }
      await runDiagnostics();
    } catch (error) {
      console.error('Error refreshing token:', error);
      toast.error('Error refreshing token');
    } finally {
      setRefreshing(false);
    }
  };

  const initializeService = async () => {
    setLoading(true);
    try {
      const success = await fcmService.initialize();
      if (success) {
        toast.success('FCM service initialized');
      } else {
        toast.error('Failed to initialize FCM service');
      }
      await runDiagnostics();
    } catch (error) {
      console.error('Error initializing service:', error);
      toast.error('Error initializing service');
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in first');
        return;
      }

      const success = await fcmService.sendTestNotification(user.id);
      if (success) {
        toast.success('Test notification sent!');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Error sending test notification');
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => {
    return (
      <Badge variant={condition ? "default" : "destructive"}>
        {condition ? trueText : falseText}
      </Badge>
    );
  };

  if (loading && !diagnostics) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Running FCM diagnostics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            FCM Diagnostics for Android
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {diagnostics && (
            <>
              {/* Platform Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    Platform Detection
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Platform:</span>
                      <Badge variant="outline">{diagnostics.platform}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Is Native:</span>
                      {getStatusBadge(diagnostics.isNative, "Yes", "No")}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    Plugin Availability
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Firebase Messaging:</span>
                      {getStatusIcon(diagnostics.hasFirebasePlugin)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Push Notifications:</span>
                      {getStatusIcon(diagnostics.hasPushPlugin)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Device Plugin:</span>
                      {getStatusIcon(diagnostics.hasDevicePlugin)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Permissions Status
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {diagnostics.isNative ? (
                    diagnostics.permissions ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Receive:</span>
                          {getStatusBadge(
                            diagnostics.permissions.receive === 'granted',
                            "Granted",
                            diagnostics.permissions.receive || "Unknown"
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-amber-600">Permissions check failed</div>
                    )
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Notification API:</span>
                        {getStatusIcon(diagnostics.notificationAPISupported)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Service Worker:</span>
                        {getStatusIcon(diagnostics.serviceWorkerSupported)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Permission:</span>
                        <Badge variant={
                          diagnostics.notificationPermission === 'granted' ? 'default' :
                          diagnostics.notificationPermission === 'denied' ? 'destructive' : 'secondary'
                        }>
                          {diagnostics.notificationPermission}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Status */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Service Status
                </h4>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>FCM Service Initialized:</span>
                    {getStatusIcon(diagnostics.serviceInitialized)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>FCM Token Available:</span>
                    {getStatusIcon(!!diagnostics.token)}
                  </div>
                  {diagnostics.token && (
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground">Token:</span>
                      <div className="bg-muted p-2 rounded text-xs break-all font-mono">
                        {diagnostics.token.substring(0, 50)}...
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommendations */}
              {(!diagnostics.isNative || !diagnostics.hasFirebasePlugin) && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Android Setup Issues Detected:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      {!diagnostics.isNative && (
                        <li>• App is not running as native Android app</li>
                      )}
                      {!diagnostics.hasFirebasePlugin && (
                        <li>• Firebase Messaging plugin not available</li>
                      )}
                      <li>• Make sure you've run: <code>npx cap sync</code></li>
                      <li>• Verify google-services.json is in android/app/</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={runDiagnostics} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Diagnostics
            </Button>
            
            {!diagnostics?.serviceInitialized && (
              <Button onClick={initializeService} disabled={loading}>
                Initialize FCM
              </Button>
            )}
            
            {diagnostics?.serviceInitialized && (
              <Button onClick={refreshToken} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Token
              </Button>
            )}
            
            {diagnostics?.token && (
              <Button onClick={sendTestNotification} variant="outline">
                Send Test
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
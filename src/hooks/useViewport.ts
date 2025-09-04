import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export const useViewport = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      const nativePlatform = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      
      // Enhanced native detection
      const hasNativePlugins = Capacitor.isPluginAvailable('PushNotifications') || 
                              Capacitor.isPluginAvailable('Device') || 
                              Capacitor.isPluginAvailable('StatusBar');
      
      const actuallyNative = nativePlatform || hasNativePlugins;
      
      console.log('🔍 Enhanced Platform Detection:', {
        'Capacitor.getPlatform()': platform,
        'Capacitor.isNativePlatform()': nativePlatform,
        'Push Notifications Plugin': Capacitor.isPluginAvailable('PushNotifications'),
        'Device Plugin': Capacitor.isPluginAvailable('Device'),
        'StatusBar Plugin': Capacitor.isPluginAvailable('StatusBar'),
        'Actually Native': actuallyNative,
        'User Agent': navigator.userAgent.substring(0, 50) + '...'
      });
      
      setIsNative(actuallyNative);
      // If running natively, consider it mobile regardless of screen size
      setIsMobile(actuallyNative || width < 768);
      setIsTablet(!actuallyNative && width >= 768 && width < 1024);
    };

    // Check on mount
    checkViewport();

    // Add event listener for web
    if (!Capacitor.isNativePlatform()) {
      window.addEventListener('resize', checkViewport);
    }

    // Cleanup
    return () => {
      if (!Capacitor.isNativePlatform()) {
        window.removeEventListener('resize', checkViewport);
      }
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    isNative,
    platform: Capacitor.getPlatform(),
    width: typeof window !== 'undefined' ? window.innerWidth : 0
  };
};
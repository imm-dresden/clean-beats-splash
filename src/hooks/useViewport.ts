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
      
      setIsNative(nativePlatform);
      // If running natively, consider it mobile regardless of screen size
      setIsMobile(nativePlatform || width < 768);
      setIsTablet(!nativePlatform && width >= 768 && width < 1024);
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
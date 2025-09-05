// PWA Update Prompt - Now just shows status, updates happen automatically
import { useEffect } from "react";
import { pwaService } from "@/lib/pwaService";

export function PWAUpdatePrompt() {
  useEffect(() => {
    // Listen for service worker updates and controller changes
    const handleControllerChange = () => {
      console.log('[PWA] Service worker controller changed - app updated');
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
    };
  }, []);

  // This component no longer shows UI since updates are automatic
  return null;
}

export default PWAUpdatePrompt;
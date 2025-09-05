// PWA Service for managing service worker registration and PWA features
import { toast } from "@/hooks/use-toast";

export interface PWAInstallPrompt extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

class PWAService {
  private deferredPrompt: PWAInstallPrompt | null = null;
  private isInstalled = false;
  private updateAvailable = false;
  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Check if app is already installed
    this.checkInstallationStatus();
    
    // Listen for install prompt
    this.setupInstallPrompt();
    
    // Register service worker
    await this.registerServiceWorker();
    
    // Listen for app installed event
    this.setupInstallListener();
    
    // Check for updates periodically
    this.setupUpdateChecker();
  }

  private checkInstallationStatus() {
    // Check if running in standalone mode (installed as PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      console.log('[PWA] App is running in standalone mode');
    }
    
    // Check if running from home screen on mobile
    if ((window.navigator as any).standalone === true) {
      this.isInstalled = true;
      console.log('[PWA] App is running from home screen');
    }
  }

  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] Install prompt available');
      e.preventDefault();
      this.deferredPrompt = e as PWAInstallPrompt;
      this.showInstallBanner();
    });
  }

  private setupInstallListener() {
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App was installed');
      this.isInstalled = true;
      this.deferredPrompt = null;
      toast({
        title: "App Installed!",
        description: "Clean Beats has been installed on your device.",
      });
    });
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        console.log('[PWA] Registering service worker...');
        this.registration = await navigator.serviceWorker.register('/pwa-sw.js', {
          scope: '/',
          updateViaCache: 'none'
        });

        console.log('[PWA] Service worker registered successfully');

        // Listen for updates
        this.registration.addEventListener('updatefound', () => {
          console.log('[PWA] Update found');
          const newWorker = this.registration!.installing;
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Update available');
                this.updateAvailable = true;
                this.showUpdateBanner();
              }
            });
          }
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event.data);
        });

      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
      }
    } else {
      console.warn('[PWA] Service workers not supported');
    }
  }

  private setupUpdateChecker() {
    // Check for updates every 30 minutes
    setInterval(() => {
      if (this.registration) {
        this.registration.update();
      }
    }, 30 * 60 * 1000);
  }

  private handleServiceWorkerMessage(data: any) {
    switch (data.type) {
      case 'NOTIFICATION_CLOSED':
        console.log('[PWA] Notification closed:', data.tag);
        break;
      case 'MARK_EQUIPMENT_CLEANED':
        // Handle equipment cleaning from notification
        this.handleEquipmentCleaned(data.equipmentId);
        break;
      default:
        console.log('[PWA] Unknown message from service worker:', data);
    }
  }

  private handleEquipmentCleaned(equipmentId: string) {
    // Dispatch custom event for equipment cleaning
    window.dispatchEvent(new CustomEvent('equipment-cleaned', {
      detail: { equipmentId }
    }));
    
    toast({
      title: "Equipment Cleaned",
      description: "Equipment has been marked as cleaned from notification.",
    });
  }

  private showInstallBanner() {
    // Create and show install banner
    const banner = document.createElement('div');
    banner.className = 'fixed bottom-4 left-4 right-4 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg z-50 flex items-center justify-between';
    banner.innerHTML = `
      <div>
        <h3 class="font-semibold">Install Clean Beats</h3>
        <p class="text-sm opacity-90">Add to your home screen for quick access</p>
      </div>
      <div class="flex gap-2">
        <button id="pwa-install-later" class="px-3 py-1 bg-white/20 rounded text-sm">Later</button>
        <button id="pwa-install-now" class="px-3 py-1 bg-white text-primary rounded text-sm font-medium">Install</button>
      </div>
    `;

    document.body.appendChild(banner);

    // Handle install actions
    document.getElementById('pwa-install-now')?.addEventListener('click', () => {
      this.promptInstall();
      banner.remove();
    });

    document.getElementById('pwa-install-later')?.addEventListener('click', () => {
      banner.remove();
    });

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (banner.parentNode) {
        banner.remove();
      }
    }, 10000);
  }

  private showUpdateBanner() {
    const banner = document.createElement('div');
    banner.className = 'fixed top-4 left-4 right-4 bg-accent text-accent-foreground p-4 rounded-lg shadow-lg z-50 flex items-center justify-between';
    banner.innerHTML = `
      <div>
        <h3 class="font-semibold">Update Available</h3>
        <p class="text-sm opacity-90">A new version of Clean Beats is ready</p>
      </div>
      <div class="flex gap-2">
        <button id="pwa-update-later" class="px-3 py-1 bg-white/20 rounded text-sm">Later</button>
        <button id="pwa-update-now" class="px-3 py-1 bg-white text-accent rounded text-sm font-medium">Update</button>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('pwa-update-now')?.addEventListener('click', () => {
      this.applyUpdate();
      banner.remove();
    });

    document.getElementById('pwa-update-later')?.addEventListener('click', () => {
      banner.remove();
    });
  }

  // Public methods
  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted install prompt');
        return true;
      } else {
        console.log('[PWA] User dismissed install prompt');
        return false;
      }
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
      return false;
    } finally {
      this.deferredPrompt = null;
    }
  }

  async applyUpdate(): Promise<void> {
    if (!this.registration) {
      console.warn('[PWA] No service worker registration available');
      return;
    }

    if (this.registration.waiting) {
      // Tell the waiting service worker to skip waiting
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload the page to use the new service worker
      window.location.reload();
    }
  }

  isAppInstalled(): boolean {
    return this.isInstalled;
  }

  canInstall(): boolean {
    return this.deferredPrompt !== null;
  }

  hasUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  // Share API support
  async shareContent(shareData: ShareData): Promise<boolean> {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (error) {
        console.error('[PWA] Share failed:', error);
        return false;
      }
    }
    
    // Fallback to clipboard
    if (shareData.url && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareData.url);
        toast({
          title: "Link Copied",
          description: "Link has been copied to clipboard.",
        });
        return true;
      } catch (error) {
        console.error('[PWA] Clipboard write failed:', error);
      }
    }
    
    return false;
  }

  // Badge API support (for unread notifications count)
  async setBadge(count?: number): Promise<void> {
    if ('setAppBadge' in navigator) {
      try {
        if (count === undefined || count === 0) {
          await (navigator as any).clearAppBadge();
        } else {
          await (navigator as any).setAppBadge(count);
        }
      } catch (error) {
        console.error('[PWA] Badge API error:', error);
      }
    }
  }

  // Wake Lock API support (prevent screen from turning off)
  private wakeLock: any = null;

  async requestWakeLock(): Promise<boolean> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('[PWA] Wake lock acquired');
        return true;
      } catch (error) {
        console.error('[PWA] Wake lock request failed:', error);
      }
    }
    return false;
  }

  async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
      console.log('[PWA] Wake lock released');
    }
  }
}

// Create singleton instance
export const pwaService = new PWAService();
export default pwaService;
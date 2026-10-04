import { APP_VERSION } from '../version';

export interface RemoteVersionInfo {
  version: string;
  buildNumber?: number;
  buildTime?: string;
}

export interface CheckUpdateResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
}

/**
 * Checks if the current app is running in standalone PWA / installed mode on PC or Mobile
 */
export function isAppRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  const isStandaloneQuery = 
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches;

  const isIosStandalone = (window.navigator as any).standalone === true;
  const isAndroidTwa = typeof document !== 'undefined' && document.referrer.includes('android-app://');

  return Boolean(isStandaloneQuery || isIosStandalone || isAndroidTwa);
}

/**
 * Checks the server for a newer deployed version of the application
 */
export async function checkRemoteVersion(): Promise<CheckUpdateResult> {
  try {
    const timestamp = Date.now();
    const res = await fetch(`./version.json?_t=${timestamp}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!res.ok) {
      return { hasUpdate: false, currentVersion: APP_VERSION, latestVersion: APP_VERSION };
    }

    const data: RemoteVersionInfo = await res.json();
    if (data && data.version && data.version !== APP_VERSION) {
      console.log(`[VersionCheck] Newer version available: v${data.version} (current: v${APP_VERSION})`);
      return {
        hasUpdate: true,
        currentVersion: APP_VERSION,
        latestVersion: data.version,
      };
    }
  } catch (err) {
    console.debug('[VersionCheck] Failed to check remote version:', err);
  }

  return { hasUpdate: false, currentVersion: APP_VERSION, latestVersion: APP_VERSION };
}

/**
 * Applies the update by refreshing Service Worker caches and reloading the page
 */
export async function applyAppUpdate(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update().catch(() => {});
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key))).catch(() => {});
    }
  } catch (err) {
    console.warn('[VersionCheck] Error during cache invalidation:', err);
  }

  // Force clean reload
  window.location.reload();
}

/**
 * Dispatches an event whenever any download is triggered in the app
 */
export function notifyDownloadTriggered(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:download-triggered'));
  }
}

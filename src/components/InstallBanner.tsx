import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Sparkles } from 'lucide-react';
import { Language } from '../utils/translations';
import { isAppRunningStandalone } from '../utils/versionCheck';

interface InstallBannerProps {
  lang: Language;
  onOpenInstall: () => void;
  canInstallNative?: boolean;
}

export const InstallBanner: React.FC<InstallBannerProps> = ({
  lang,
  onOpenInstall,
  canInstallNative,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed)
    if (isAppRunningStandalone()) {
      return;
    }

    // Check if dismissed previously
    try {
      const dismissedUntil = localStorage.getItem('kiyodo_install_banner_dismissed');
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        return;
      }
    } catch {
      // ignore
    }

    // Only show on mobile or tablet screens
    const isTouchOrMobile = 
      typeof window !== 'undefined' && 
      (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    if (isTouchOrMobile) {
      // Small delay so user sees app load first
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      // Dismiss for 3 days
      localStorage.setItem('kiyodo_install_banner_dismissed', String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    } catch {
      // ignore
    }
  };

  if (!isVisible) return null;

  const isCs = lang === 'cs';

  return (
    <div 
      className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto p-3.5 sm:p-4 rounded-2xl border shadow-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-300"
      style={{
        backgroundColor: 'var(--panel-bg)',
        borderColor: 'var(--accent-primary)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-xs"
          style={{
            backgroundColor: 'var(--panel-surface)',
            borderColor: 'var(--panel-border)',
            color: 'var(--accent-primary)',
          }}
        >
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold leading-tight truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            <span>{isCs ? 'Nainstalovat KiYoDo na plochu' : 'Install KiYoDo to Home Screen'}</span>
            <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
            {isCs ? 'Rychlé 1-klik spuštění bez otevírání webu' : 'Fast 1-click launch as standalone app'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            onOpenInstall();
            setIsVisible(false);
          }}
          className="px-3 py-1.5 text-xs font-bold rounded-lg shadow-md hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-contrast)',
          }}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isCs ? 'Instalovat' : 'Install'}</span>
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 rounded-lg hover:opacity-80 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Zavřít"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

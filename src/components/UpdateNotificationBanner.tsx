import React, { useState } from 'react';
import { Sparkles, RefreshCw, X, ArrowUpCircle } from 'lucide-react';
import { applyAppUpdate } from '../utils/versionCheck';
import { Language } from '../utils/translations';

interface UpdateNotificationBannerProps {
  currentVersion: string;
  latestVersion: string;
  onDismiss: () => void;
  lang: Language;
}

export const UpdateNotificationBanner: React.FC<UpdateNotificationBannerProps> = ({
  currentVersion,
  latestVersion,
  onDismiss,
  lang,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const isCs = lang === 'cs';

  const handleUpdate = async () => {
    setIsUpdating(true);
    await applyAppUpdate();
  };

  return (
    <div 
      className="fixed top-18 left-4 right-4 z-50 max-w-2xl mx-auto p-4 rounded-2xl border shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-300"
      style={{
        backgroundColor: 'var(--panel-bg)',
        borderColor: 'var(--accent-primary)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex items-start sm:items-center gap-3">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-xs"
          style={{
            backgroundColor: 'var(--panel-surface)',
            borderColor: 'var(--panel-border)',
            color: 'var(--accent-primary)',
          }}
        >
          <ArrowUpCircle className="w-5 h-5 animate-bounce" />
        </div>
        <div>
          <div className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span>
              {isCs ? `K dispozici je nová verze KiYoDo (v${latestVersion})` : `New KiYoDo version available (v${latestVersion})`}
            </span>
            <span 
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
              style={{
                backgroundColor: 'var(--panel-surface)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-muted)',
              }}
            >
              {isCs ? `nyní: v${currentVersion}` : `current: v${currentVersion}`}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {isCs 
              ? 'Na serveru byla nasazena novější verze aplikace. Aktualizujte pro nejnovější funkce a opravy.' 
              : 'A newer version has been deployed. Update now for the latest features and fixes.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          type="button"
          onClick={handleUpdate}
          disabled={isUpdating}
          className="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer hover:opacity-90 flex items-center gap-2"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-contrast)',
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
          <span>
            {isUpdating 
              ? (isCs ? 'Aktualizuji...' : 'Updating...') 
              : (isCs ? 'Aktualizovat nyní' : 'Update Now')}
          </span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="p-2 rounded-lg hover:opacity-80 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title={isCs ? 'Zavřít' : 'Dismiss'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

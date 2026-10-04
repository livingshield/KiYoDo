import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Music, 
  Video, 
  Check, 
  RotateCcw, 
  HardDrive, 
  Sparkles,
  Download,
  Image as ImageIcon,
  Smartphone,
  Palette
} from 'lucide-react';
import { 
  UserPreferences, 
  DownloadFormat, 
  AudioQuality, 
  VideoQuality, 
  BackgroundStyle, 
  DEFAULT_USER_PREFERENCES 
} from '../types';
import { Language } from '../utils/translations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onSavePreferences: (prefs: UserPreferences) => void;
  lang: Language;
  onOpenInstall?: () => void;
  isStandalone?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onSavePreferences,
  lang,
  onOpenInstall,
  isStandalone = false,
}) => {
  const [format, setFormat] = useState<DownloadFormat>(preferences.defaultFormat);
  const [audioQuality, setAudioQuality] = useState<AudioQuality>(preferences.defaultAudioQuality);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>(preferences.defaultVideoQuality);
  const [method, setMethod] = useState<'direct' | 'batch_script'>(preferences.defaultMethod);
  const [bgStyle, setBgStyle] = useState<BackgroundStyle>(preferences.backgroundStyle || 'artwork');
  const [savedAlert, setSavedAlert] = useState(false);

  if (!isOpen) return null;

  const isCs = lang === 'cs';

  const audioOptions: { value: AudioQuality; label: string; desc: string; badge?: string }[] = [
    { value: '320', label: '320 kbps', desc: isCs ? 'Studiová kvalita (HQ)' : 'Studio Quality (HQ)', badge: isCs ? 'Doporučeno' : 'Recommended' },
    { value: '256', label: '256 kbps', desc: isCs ? 'Vysoká čistota zvuku' : 'High Clarity' },
    { value: '192', label: '192 kbps', desc: isCs ? 'Standardní kvalita' : 'Standard Quality' },
    { value: '128', label: '128 kbps', desc: isCs ? 'Základní (menší soubor)' : 'Basic (Smaller size)' },
  ];

  const videoOptions: { value: VideoQuality; label: string; desc: string; badge?: string }[] = [
    { value: '1080', label: '1080p', desc: isCs ? 'Full HD (1920x1080)' : 'Full HD (1920x1080)', badge: isCs ? 'Nejostřejší' : 'Sharpest' },
    { value: '720', label: '720p', desc: isCs ? 'HD kvalita (1280x720)' : 'HD Quality (1280x720)' },
    { value: '480', label: '480p', desc: isCs ? 'Standardní DVD rozlišení' : 'Standard DVD size' },
    { value: '360', label: '360p', desc: isCs ? 'Úsporná velikost do mobilu' : 'Data-saver size' },
  ];

  const handleSave = () => {
    const updated: UserPreferences = {
      defaultFormat: format,
      defaultAudioQuality: audioQuality,
      defaultVideoQuality: videoQuality,
      defaultMethod: method,
      backgroundStyle: bgStyle,
    };
    onSavePreferences(updated);
    setSavedAlert(true);
    setTimeout(() => {
      setSavedAlert(false);
      onClose();
    }, 600);
  };

  const handleReset = () => {
    setFormat(DEFAULT_USER_PREFERENCES.defaultFormat);
    setAudioQuality(DEFAULT_USER_PREFERENCES.defaultAudioQuality);
    setVideoQuality(DEFAULT_USER_PREFERENCES.defaultVideoQuality);
    setMethod(DEFAULT_USER_PREFERENCES.defaultMethod);
    setBgStyle(DEFAULT_USER_PREFERENCES.backgroundStyle);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          borderRadius: 'var(--ui-radius-lg)',
          boxShadow: 'var(--panel-shadow)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{
            backgroundColor: 'var(--panel-surface)',
            borderBottomColor: 'var(--panel-border)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-lg border flex items-center justify-center"
              style={{
                backgroundColor: 'var(--panel-bg)',
                borderColor: 'var(--panel-border)',
                color: 'var(--accent-primary)',
              }}
            >
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                {isCs ? 'Uživatelské nastavení kvality' : 'Default Download Preferences'}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isCs 
                  ? 'Ušetřete klikání – tato volba bude automaticky předvybrána' 
                  : 'Save clicks – these choices will be pre-selected for every video'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors cursor-pointer hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Section 1: Default Format */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
              {isCs ? '1. Preferovaný výchozí formát' : '1. Preferred Default Format'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('mp3')}
                className="flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  backgroundColor: format === 'mp3' ? 'var(--panel-surface)' : 'transparent',
                  borderColor: format === 'mp3' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div 
                  className="p-2 rounded-lg"
                  style={{
                    backgroundColor: format === 'mp3' ? 'var(--accent-primary)' : 'var(--panel-surface)',
                    color: format === 'mp3' ? 'var(--accent-contrast)' : 'var(--text-muted)',
                  }}
                >
                  <Music className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm">MP3 (Audio)</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {isCs ? 'Hudba, podcasty, hlas' : 'Music, podcasts, speech'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('mp4')}
                className="flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  backgroundColor: format === 'mp4' ? 'var(--panel-surface)' : 'transparent',
                  borderColor: format === 'mp4' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div 
                  className="p-2 rounded-lg"
                  style={{
                    backgroundColor: format === 'mp4' ? 'var(--accent-primary)' : 'var(--panel-surface)',
                    color: format === 'mp4' ? 'var(--accent-contrast)' : 'var(--text-muted)',
                  }}
                >
                  <Video className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm">MP4 (Video)</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {isCs ? 'Obraz i zvuk ve Full HD' : 'Video & sound in Full HD'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Default Quality for Audio */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Music className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                <span>{isCs ? '2. Výchozí kvalita zvuku (MP3)' : '2. Default Audio Quality (MP3)'}</span>
              </label>
              {format === 'mp3' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)', borderColor: 'var(--panel-border)' }}>
                  {isCs ? 'Aktivní formát' : 'Active Format'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {audioOptions.map((opt) => {
                const isSelected = audioQuality === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAudioQuality(opt.value)}
                    className="relative p-3 rounded-xl border text-left transition-all cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? 'var(--panel-surface)' : 'transparent',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--panel-border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{opt.label}</span>
                      {opt.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold border" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)', borderColor: 'var(--panel-border)' }}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-1 leading-tight" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Default Quality for Video */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Video className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                <span>{isCs ? '3. Výchozí kvalita videa (MP4)' : '3. Default Video Quality (MP4)'}</span>
              </label>
              {format === 'mp4' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)', borderColor: 'var(--panel-border)' }}>
                  {isCs ? 'Aktivní formát' : 'Active Format'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {videoOptions.map((opt) => {
                const isSelected = videoQuality === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVideoQuality(opt.value)}
                    className="relative p-3 rounded-xl border text-left transition-all cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? 'var(--panel-surface)' : 'transparent',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--panel-border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{opt.label}</span>
                      {opt.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold border" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)', borderColor: 'var(--panel-border)' }}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-1 leading-tight" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Default Download Method */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
              {isCs ? '4. Preferovaná výchozí metoda' : '4. Preferred Download Method'}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMethod('direct')}
                className="p-3 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  backgroundColor: method === 'direct' ? 'var(--panel-surface)' : 'transparent',
                  borderColor: method === 'direct' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Download className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <span>{isCs ? 'Integrované stažení' : 'Direct Browser Download'}</span>
                </div>
                <p className="text-[11px] mt-1 leading-tight" style={{ color: 'var(--text-muted)' }}>
                  {isCs ? 'Převede video na serveru a stáhne do prohlížeče' : 'Converts on server and saves to browser'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMethod('batch_script')}
                className="p-3 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  backgroundColor: method === 'batch_script' ? 'var(--panel-surface)' : 'transparent',
                  borderColor: method === 'batch_script' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <HardDrive className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <span>{isCs ? '1-Klik skript (.bat)' : '1-Click Script (.bat)'}</span>
                </div>
                <p className="text-[11px] mt-1 leading-tight" style={{ color: 'var(--text-muted)' }}>
                  {isCs ? 'Spustí stažení z vašeho PC do složky Downloads' : 'Runs natively on PC into Downloads folder'}
                </p>
              </button>
            </div>
          </div>

          {/* Section 5: Visual Background Style */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
              {isCs ? '5. Vizuální styl pozadí' : '5. Visual Background Style'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBgStyle('minimal')}
                className="p-2.5 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  backgroundColor: bgStyle === 'minimal' ? 'var(--panel-surface)' : 'transparent',
                  borderColor: bgStyle === 'minimal' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <span>{isCs ? 'Čistý (Doporučeno)' : 'Clean Minimal (Best)'}</span>
                </div>
                <p className="text-[11px] mt-1 leading-tight" style={{ color: 'var(--text-muted)' }}>
                  {isCs ? 'Maximální kontrast, bez rušivých kreseb' : 'Maximum contrast, distraction-free'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setBgStyle('texture')}
                className="p-2.5 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  backgroundColor: bgStyle === 'texture' ? 'var(--panel-surface)' : 'transparent',
                  borderColor: bgStyle === 'texture' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Palette className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <span>{isCs ? 'Jemná textura' : 'Subtle Grid'}</span>
                </div>
                <p className="text-[11px] mt-1 leading-tight" style={{ color: 'var(--text-muted)' }}>
                  {isCs ? 'Nenápadná mikro-mřížka bodů' : 'Subtle micro-grid dots'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setBgStyle('artwork')}
                className="p-2.5 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  backgroundColor: bgStyle === 'artwork' ? 'var(--panel-surface)' : 'transparent',
                  borderColor: bgStyle === 'artwork' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <ImageIcon className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <span>{isCs ? 'Ilustrace' : 'Artwork'}</span>
                </div>
                <p className="text-[11px] mt-1 leading-tight" style={{ color: 'var(--text-muted)' }}>
                  {isCs ? 'Ztlumená ilustrace na pozadí' : 'Dimmed ambient illustration'}
                </p>
              </button>
            </div>
          </div>

          {/* Section 5: PWA Install to Home Screen / Mobile */}
          {(isStandalone || onOpenInstall) && (
            <div className="pt-2 border-t" style={{ borderColor: 'var(--panel-border)' }}>
              <div 
                className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--panel-border)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: 'var(--panel-bg)',
                      borderColor: 'var(--panel-border)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {isCs ? 'Aplikace na plochu / mobil' : 'Home Screen & Desktop App'}
                    </div>
                    <div className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {isStandalone 
                        ? (isCs ? 'Aplikace je úspěšně nainstalována a spuštěna z plochy.' : 'App is installed and running as a standalone app.')
                        : (isCs ? 'Používejte KiYoDo jako nativní aplikaci bez otevírání prohlížeče' : 'Use KiYoDo like a native app without browser bars')}
                    </div>
                  </div>
                </div>

                {isStandalone ? (
                  <div 
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 shrink-0" 
                    style={{ 
                      borderColor: 'var(--panel-border)', 
                      backgroundColor: 'var(--panel-bg)',
                      color: 'var(--text-primary)' 
                    }}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{isCs ? 'Nainstalováno' : 'Installed'}</span>
                  </div>
                ) : onOpenInstall ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenInstall();
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: 'var(--accent-contrast)',
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isCs ? 'Nainstalovat' : 'Install'}</span>
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div 
          className="px-6 py-4 border-t flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--panel-surface)',
            borderTopColor: 'var(--panel-border)',
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isCs ? 'Obnovit výchozí' : 'Reset to default'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
            >
              {isCs ? 'Zrušit' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer hover:opacity-90"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
                borderRadius: 'var(--ui-radius-sm)',
              }}
            >
              {savedAlert ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isCs ? 'Uloženo!' : 'Saved!'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isCs ? 'Uložit nastavení' : 'Save Preferences'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { 
  X, 
  Smartphone, 
  Monitor, 
  Share2, 
  PlusSquare, 
  MoreVertical, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink,
  Laptop
} from 'lucide-react';
import { Language } from '../utils/translations';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  canInstallNative: boolean;
  onInstallNative?: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  lang,
  canInstallNative,
  onInstallNative,
}) => {
  if (!isOpen) return null;

  const isCs = lang === 'cs';

  // Detect platform
  const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : '';
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(userAgent);
  const isDesktop = !isIos && !isAndroid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg border shadow-2xl overflow-hidden my-8"
        style={{
          backgroundColor: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          borderRadius: 'var(--ui-radius-lg)',
        }}
      >
        {/* Header */}
        <div 
          className="p-5 sm:p-6 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs"
              style={{
                backgroundColor: 'var(--panel-surface)',
                borderColor: 'var(--panel-border)',
                color: 'var(--accent-primary)',
              }}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>
                {isCs ? 'Instalace aplikace KiYoDo' : 'Install KiYoDo App'}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isCs ? 'Rychlý přístup z plochy bez otevírání prohlížeče' : 'Fast home screen access without opening browser'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:opacity-80 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Native 1-Click Install Button if supported & available */}
          {canInstallNative && onInstallNative && (
            <div 
              className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              style={{
                backgroundColor: 'var(--panel-surface)',
                borderColor: 'var(--accent-primary)',
              }}
            >
              <div className="space-y-1">
                <div className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  {isCs ? 'Instalace 1 kliknutím' : '1-Click Fast Install'}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isCs 
                    ? 'Váš prohlížeč podporuje přímou instalaci na plochu.' 
                    : 'Your browser supports direct installation.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onInstallNative();
                  onClose();
                }}
                className="px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer hover:opacity-90 flex items-center justify-center gap-2 shrink-0"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                <Download className="w-4 h-4" />
                {isCs ? 'Nainstalovat ihned' : 'Install Now'}
              </button>
            </div>
          )}

          {/* iOS Safari Instructions */}
          {isIos && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <span>{isCs ? 'Postup pro iPhone a iPad (Safari)' : 'iPhone & iPad Instructions (Safari)'}</span>
              </div>
              <div 
                className="p-4 rounded-xl border space-y-3 text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
                    1
                  </div>
                  <div>
                    {isCs ? (
                      <>Klepněte dole v Safari na tlačítko <strong>Sdílet</strong> (čtvereček se šipkou nahoru <Share2 className="w-3.5 h-3.5 inline align-text-bottom text-blue-500" />).</>
                    ) : (
                      <>Tap the <strong>Share</strong> button at the bottom of Safari (<Share2 className="w-3.5 h-3.5 inline align-text-bottom text-blue-500" />).</>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
                    2
                  </div>
                  <div>
                    {isCs ? (
                      <>V nabídce sjeďte mírně níže a vyberte <strong>"Přidat na plochu"</strong> (<PlusSquare className="w-3.5 h-3.5 inline align-text-bottom text-blue-500" />).</>
                    ) : (
                      <>Scroll down the menu and choose <strong>"Add to Home Screen"</strong> (<PlusSquare className="w-3.5 h-3.5 inline align-text-bottom text-blue-500" />).</>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
                    3
                  </div>
                  <div>
                    {isCs ? (
                      <>V pravém horním rohu klepněte na <strong>"Přidat"</strong>. Hotovo! Ikona se objeví mezi vašimi aplikacemi.</>
                    ) : (
                      <>Tap <strong>"Add"</strong> in the top-right corner. All set! The icon is now on your home screen.</>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android Instructions */}
          {isAndroid && !canInstallNative && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <span>{isCs ? 'Postup pro Android (Chrome)' : 'Android Instructions (Chrome)'}</span>
              </div>
              <div 
                className="p-4 rounded-xl border space-y-3 text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
                    1
                  </div>
                  <div>
                    {isCs ? (
                      <>V pravém horním rohu prohlížeče Chrome klepněte na <strong>menu</strong> (tři tečky <MoreVertical className="w-3.5 h-3.5 inline align-text-bottom text-blue-500" />).</>
                    ) : (
                      <>Tap the <strong>three dots menu</strong> (<MoreVertical className="w-3.5 h-3.5 inline align-text-bottom text-blue-500" />) in Chrome top right.</>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
                    2
                  </div>
                  <div>
                    {isCs ? (
                      <>Klepněte na položku <strong>"Nainstalovat aplikaci"</strong> nebo <strong>"Přidat na plochu"</strong>.</>
                    ) : (
                      <>Tap <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>.</>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
                    3
                  </div>
                  <div>
                    {isCs ? (
                      <>Potvrďte klepnutím na <strong>Instalovat</strong>. Aplikace se přidá na vaši domovskou obrazovku.</>
                    ) : (
                      <>Confirm by tapping <strong>Install</strong>. The app will be placed directly onto your home screen.</>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Instructions */}
          {isDesktop && !canInstallNative && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Laptop className="w-3.5 h-3.5" />
                <span>{isCs ? 'Postup pro počítač (Chrome / Edge / Opera)' : 'Desktop Instructions (Chrome / Edge / Opera)'}</span>
              </div>
              <div 
                className="p-4 rounded-xl border space-y-3 text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
                    1
                  </div>
                  <div>
                    {isCs ? (
                      <>Přímo v <strong>adresním řádku prohlížeče</strong> nahoře vpravo hledejte ikonu <strong>Instalovat</strong> (počítač se šipkou dolů nebo ikona plus).</>
                    ) : (
                      <>Look for the <strong>Install</strong> icon (computer with down arrow or plus) on the right side of your browser address bar.</>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
                    2
                  </div>
                  <div>
                    {isCs ? (
                      <>Případně otevřete <strong>menu prohlížeče (3 tečky)</strong> a zvolte <strong>Uložit a sdílet → Nainstalovat aplikaci KiYoDo</strong>.</>
                    ) : (
                      <>Or open the <strong>browser menu (3 dots)</strong> and select <strong>Save and share → Install KiYoDo</strong>.</>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Advantages */}
          <div 
            className="p-4 rounded-xl border space-y-2 text-xs"
            style={{
              backgroundColor: 'var(--panel-surface)',
              borderColor: 'var(--panel-border)',
            }}
          >
            <div className="font-semibold text-xs mb-1" style={{ color: 'var(--text-primary)' }}>
              {isCs ? 'Výhody instalované aplikace:' : 'Benefits of installing:'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{isCs ? 'Otevírání na celou obrazovku bez lišt' : 'Full-screen app view without browser bars'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{isCs ? 'Sdílení videí z YouTube přímo do appky' : 'Share videos directly from YouTube app'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{isCs ? 'Okamžité spuštění z plochy' : 'Instant launch right from home screen'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{isCs ? 'Nulová spotřeba místa v paměti (< 1 MB)' : 'Ultra lightweight, zero storage bloat (< 1 MB)'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="p-4 sm:p-5 border-t flex justify-end"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold border transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--panel-border)',
              color: 'var(--text-primary)',
            }}
          >
            {isCs ? 'Rozumím / Zavřít' : 'Got it / Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

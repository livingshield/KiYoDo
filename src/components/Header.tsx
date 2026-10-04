import React, { useState, useRef, useEffect } from 'react';
import { Download, Globe, Settings, Search, Palette, Check, ChevronDown, Sparkles, Moon, Sun, Smartphone, Zap, Gem, Leaf, Cloud, Feather } from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { ThemeId } from '../types';
import { THEME_OPTIONS } from '../utils/theme';
import { APP_VERSION } from '../version';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  lang: Language;
  onToggleLang: () => void;
  activeTab?: 'single' | 'playlist' | 'search' | 'batch' | 'guide' | 'history' | 'merger' | 'bookmarks';
  onSelectTab?: (tab: 'single' | 'playlist' | 'search' | 'batch' | 'guide' | 'history' | 'merger' | 'bookmarks') => void;
  onOpenSettings: () => void;
  theme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
  canInstall?: boolean;
  onInstallApp?: () => void;
  isStandalone?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onToggleLang,
  onSelectTab,
  onOpenSettings,
  theme,
  onSelectTheme,
  canInstall,
  onInstallApp,
  isStandalone = false,
}) => {
  const t = translations[lang];
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

  const currentThemeOption = THEME_OPTIONS.find((opt) => opt.id === theme) || THEME_OPTIONS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getThemeIcon = (id: ThemeId) => {
    switch (id) {
      case 'cyber_gold':
      case 'default':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'emerald_cyan':
      case 'animism':
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case 'prism_chroma':
      case 'flow':
        return <Palette className="w-4 h-4 text-pink-400" />;
      case 'nordic_aurora':
      case 'midnight':
        return <Moon className="w-4 h-4 text-sky-400" />;
      case 'cyber_amethyst':
        return <Gem className="w-4 h-4 text-purple-400" />;
      case 'warm_cashmere':
      case 'light':
      case 'hermetic':
        return <Sun className="w-4 h-4 text-amber-600" />;
      case 'sand_terracotta':
        return <Feather className="w-4 h-4 text-orange-600" />;
      case 'misty_sage':
        return <Leaf className="w-4 h-4 text-emerald-700" />;
      case 'nordic_fog':
        return <Cloud className="w-4 h-4 text-sky-700" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <header 
      className="sticky top-0 z-40 backdrop-blur-md transition-colors duration-200 border-b shadow-xs"
      style={{
        backgroundColor: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Zone 1: Brand title */}
        <div 
          onClick={() => onSelectTab?.('search')} 
          className="flex items-center gap-2 cursor-pointer group shrink-0 select-none"
          title={lang === 'cs' ? 'Přejít na hlavní vyhledávání (Domů)' : 'Go to YouTube Search (Home)'}
        >
          <div 
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-transform group-hover:scale-105"
            style={{
              backgroundColor: 'var(--panel-surface)',
              borderColor: 'var(--panel-border)',
              borderRadius: 'var(--ui-radius-md)',
              borderWidth: 1,
            }}
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="flex items-center gap-1.5">
            <span 
              className="text-base sm:text-lg font-bold tracking-tight"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)',
              }}
            >
              Kiki<span style={{ color: 'var(--accent-primary)' }} className="font-extrabold">YoDo</span>
            </span>
            <span 
              className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.2 sm:py-0.5 rounded border font-semibold tracking-wider opacity-80"
              style={{
                backgroundColor: 'var(--panel-surface)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-muted)',
              }}
              title={`Verze aplikace: v${APP_VERSION}`}
            >
              v{APP_VERSION}
            </span>
          </div>
        </div>

        {/* Zone 2: Compact Action Toolbar */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          
          {/* User Profile / Auth */}
          <UserMenu lang={lang} onNavigateToBookmarks={() => onSelectTab?.('bookmarks')} />

          {/* Multi-Theme Selector Dropdown */}
          <div className="relative" ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => setIsThemeMenuOpen((prev) => !prev)}
              style={{
                backgroundColor: 'var(--panel-surface)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--ui-radius-sm)',
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border text-xs font-medium transition-all cursor-pointer shadow-xs hover:opacity-90"
              title={lang === 'cs' ? `Změnit motiv vzhledu (Aktuální: ${currentThemeOption.name})` : `Change Theme (Current: ${currentThemeOption.nameEn})`}
              aria-expanded={isThemeMenuOpen}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: currentThemeOption.accent }} />
              <span className="hidden md:inline font-medium text-xs">
                {t.themeBtn || (lang === 'cs' ? 'Vzhled' : 'Theme')}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
            </button>

            {isThemeMenuOpen && (
              <div 
                className="absolute right-0 mt-2 w-64 sm:w-72 max-w-[calc(100vw-24px)] p-1.5 shadow-xl border z-50 transition-all animate-in fade-in zoom-in-95 duration-150"
                style={{
                  backgroundColor: 'var(--panel-bg)',
                  borderColor: 'var(--panel-border)',
                  borderRadius: 'var(--ui-radius-md)',
                }}
              >
                <div className="px-3 py-2 border-b text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}>
                  {t.themeTitle || (lang === 'cs' ? 'Výběr vzhledu (Themes)' : 'Select Theme')}
                </div>
                <div className="py-1 space-y-1 max-h-[70vh] overflow-y-auto">
                  {THEME_OPTIONS.map((opt) => {
                    const isSelected = opt.id === theme;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onSelectTheme(opt.id);
                          setIsThemeMenuOpen(false);
                        }}
                        style={{
                          borderRadius: 'var(--ui-radius-sm)',
                          backgroundColor: isSelected ? 'var(--panel-surface)' : 'transparent',
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:opacity-90 cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div 
                            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border"
                            style={{
                              backgroundColor: opt.bg,
                              borderColor: isSelected ? opt.accent : 'var(--panel-border)',
                            }}
                          >
                            {getThemeIcon(opt.id)}
                          </div>
                          <div className="min-w-0">
                            <div 
                              className="font-medium flex items-center gap-1.5 truncate"
                              style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                            >
                              <span className="truncate">{lang === 'cs' ? opt.name : opt.nameEn}</span>
                              {opt.isLight && (
                                <span className="text-[9px] px-1 py-0.2 rounded shrink-0" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
                                  {lang === 'cs' ? 'Světlý' : 'Light'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {lang === 'cs' ? opt.subtitle : opt.subtitleEn}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 shrink-0 ml-1.5" style={{ color: 'var(--accent-primary)' }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {!isStandalone && onInstallApp && (
            <button
              type="button"
              onClick={onInstallApp}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
                borderRadius: 'var(--ui-radius-sm)',
              }}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs font-bold transition-all shadow-sm cursor-pointer hover:opacity-90 ${canInstall ? 'animate-pulse' : ''}`}
              title={t.installAppDesc}
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{lang === 'cs' ? 'Instalovat' : 'Install'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              backgroundColor: 'var(--panel-surface)',
              borderColor: 'var(--panel-border)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--ui-radius-sm)',
            }}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 border text-xs font-medium transition-colors cursor-pointer shadow-xs hover:opacity-90"
            title={t.settingsTitle}
          >
            <Settings className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <span className="hidden md:inline">{t.settingsBtn}</span>
          </button>

          <button
            type="button"
            onClick={onToggleLang}
            style={{
              backgroundColor: 'var(--panel-surface)',
              borderColor: 'var(--panel-border)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--ui-radius-sm)',
            }}
            className="flex items-center gap-1 px-2 py-1.5 border text-xs font-medium transition-colors cursor-pointer shadow-xs hover:opacity-90"
            title="Přepnout jazyk / Switch Language"
          >
            <Globe className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <span className="uppercase font-mono text-[11px] font-semibold">{lang}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

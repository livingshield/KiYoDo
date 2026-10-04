import React, { useState } from 'react';
import { Search, Clipboard, X, Sparkles, Loader2 } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface UrlInputBarProps {
  url: string;
  onChangeUrl: (url: string) => void;
  onSubmit: (url: string) => void;
  isLoading: boolean;
  lang: Language;
}

const SAMPLE_URLS = [
  {
    key: 'driak',
    label: 'DRIÁK - Tady je Krakonošovo!',
    title: 'DRIÁK - Tady je Krakonošovo! (OFFICIAL MUSIC VIDEO 2020) 4K',
    url: 'https://www.youtube.com/watch?v=EBXq5N7wGgA&list=RDEBXq5N7wGgA&start_radio=1',
  },
  {
    key: 'actionprice',
    label: 'Action Price 2026',
    title: 'Action Price 2026 Online Video 16 9 15s CZ',
    url: 'https://www.youtube.com/watch?v=OTCE_zY_LLE&list=RDOTCE_zY_LLE&start_radio=1',
  },
  {
    key: 'visiondays',
    label: 'Vision Days - Punkáčova duše',
    title: 'Vision Days - Cesta do hlubin punkáčovy duše (Official Music Video 2013)',
    url: 'https://www.youtube.com/watch?v=0dDBesAMaJw&list=RD0dDBesAMaJw&start_radio=1',
  },
  {
    key: 'namesicna',
    label: 'Náměsíčná',
    title: 'Námesícná',
    url: 'https://www.youtube.com/watch?v=5_ebw8xSf1U&list=OLAK5uy_mPlXLzPtE4Ch4LxKKpDLyjQzqqGSC79io&index=3',
  },
  {
    key: 'kapriola',
    label: 'KAPRIOLA - Ona se dívá',
    title: 'KAPRIOLA - Ona se dívá',
    url: 'https://www.youtube.com/watch?v=qdA-6CjwTW0&list=RDqdA-6CjwTW0&start_radio=1',
  },
];

export const UrlInputBar: React.FC<UrlInputBarProps> = ({
  url,
  onChangeUrl,
  onSubmit,
  isLoading,
  lang,
}) => {
  const t = translations[lang];
  const [pasteError, setPasteError] = useState<string | null>(null);

  const handlePaste = async () => {
    try {
      setPasteError(null);
      const text = await navigator.clipboard.readText();
      if (text) {
        onChangeUrl(text.trim());
        onSubmit(text.trim());
      }
    } catch {
      setPasteError('Nepodařilo se přečíst schránku. Vložte odkaz ručně (Ctrl+V).');
      setTimeout(() => setPasteError(null), 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && url.trim()) {
      onSubmit(url.trim());
    }
  };

  const isUrl = 
    url.trim().startsWith('http://') || 
    url.trim().startsWith('https://') || 
    url.includes('youtube.com') || 
    url.includes('youtu.be') || 
    url.includes('tiktok.com') || 
    url.includes('instagram.com') || 
    url.includes('facebook.com') || 
    url.includes('fb.watch') || 
    /^[a-zA-Z0-9_-]{11}$/.test(url.trim());

  return (
    <div className="w-full">
      <div 
        className="relative flex flex-col sm:flex-row items-stretch gap-2 border p-1.5 transition-all shadow-md"
        style={{
          backgroundColor: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          borderRadius: 'var(--ui-radius-lg)',
        }}
      >
        <div className="relative flex-1 flex items-center pl-3">
          <Search className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={url}
            onChange={(e) => onChangeUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.inputPlaceholder}
            className="w-full bg-transparent px-3 py-3 text-sm sm:text-base focus:outline-none"
            style={{ color: 'var(--text-primary)' }}
            disabled={isLoading}
          />
          {url && (
            <button
              type="button"
              onClick={() => onChangeUrl('')}
              className="p-1.5 rounded-md transition-colors mr-1 cursor-pointer hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
              title={t.clearBtn}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-1 pb-1 sm:pb-0">
          <button
            type="button"
            onClick={handlePaste}
            style={{
              backgroundColor: 'var(--panel-surface)',
              borderColor: 'var(--panel-border)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--ui-radius-md)',
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer hover:opacity-85 shadow-xs"
            title={t.pasteBtn}
          >
            <Clipboard className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <span className="hidden xs:inline">{t.pasteBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => onSubmit(url)}
            disabled={!url.trim() || isLoading}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
              borderRadius: 'var(--ui-radius-md)',
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-all shadow-md whitespace-nowrap cursor-pointer hover:opacity-90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.analyzing}</span>
              </>
            ) : isUrl || !url.trim() ? (
              <span>{t.analyzeBtn}</span>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>{lang === 'cs' ? 'Hledat na YouTube' : 'Search YouTube'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {pasteError && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 px-1">{pasteError}</p>
      )}

      {/* Supported Platform Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 px-1 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {lang === 'cs' ? 'Podporované sítě:' : 'Supported platforms:'}
          </span>
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
            style={{
              backgroundColor: 'var(--badge-bg)',
              color: 'var(--badge-text)',
              borderColor: 'var(--panel-border)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-primary)' }} />
            YouTube
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            TikTok
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
            Instagram Reels
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Facebook Video
          </span>
        </div>
      </div>

      {/* Quick sample buttons */}
      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs px-1" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--text-muted)' }}>
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          {t.samplesTitle}
        </span>
        {SAMPLE_URLS.map((sample) => (
          <button
            key={sample.key}
            type="button"
            title={sample.title}
            onClick={() => {
              onChangeUrl(sample.url);
              onSubmit(sample.url);
            }}
            style={{
              color: 'var(--text-primary)',
            }}
            className="text-xs underline underline-offset-4 opacity-80 hover:opacity-100 transition-all cursor-pointer font-medium"
          >
            {sample.label}
          </button>
        ))}
      </div>
    </div>
  );
};

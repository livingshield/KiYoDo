import React, { useState, useMemo } from 'react';
import { 
  History, 
  Trash2, 
  ExternalLink, 
  Music, 
  Video, 
  Copy, 
  Download, 
  Play, 
  Eye, 
  Search, 
  X,
  Clock,
  ArrowRight
} from 'lucide-react';
import { DownloadHistoryItem, WatchHistoryItem, DownloadFormat } from '../types';
import { Language, translations } from '../utils/translations';
import { getWebDownloadGatewayUrl } from '../utils/youtube';

export interface DownloadHistoryProps {
  history?: DownloadHistoryItem[];
  downloadHistory?: DownloadHistoryItem[];
  watchHistory?: WatchHistoryItem[];
  onClearHistory?: () => void;
  onClearDownloadHistory?: () => void;
  onClearWatchHistory?: () => void;
  onRemoveDownloadItem?: (id: string) => void;
  onRemoveWatchItem?: (id: string) => void;
  onSelectVideo?: (url: string, preferredFormat?: DownloadFormat) => void;
  lang: Language;
  initialTab?: 'watch' | 'download';
}

export const DownloadHistory: React.FC<DownloadHistoryProps> = ({
  history = [],
  downloadHistory,
  watchHistory = [],
  onClearHistory,
  onClearDownloadHistory,
  onClearWatchHistory,
  onRemoveDownloadItem,
  onRemoveWatchItem,
  onSelectVideo,
  lang,
  initialTab = 'watch',
}) => {
  const t = translations[lang];
  const effectiveDownloads = downloadHistory ?? history;

  const [activeTab, setActiveTab] = useState<'watch' | 'download'>(() => {
    if (initialTab) return initialTab;
    return watchHistory.length > 0 ? 'watch' : 'download';
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleRedownload = (item: DownloadHistoryItem) => {
    const url = getWebDownloadGatewayUrl('cobalt', item.videoId, item.format, item.quality);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async (videoIdOrUrl: string, copyKey: string) => {
    const targetUrl = videoIdOrUrl.startsWith('http') 
      ? videoIdOrUrl 
      : `https://www.youtube.com/watch?v=${videoIdOrUrl}`;
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopiedId(copyKey);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore
    }
  };

  const formatRelativeTime = (timestamp: number): string => {
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 60) return lang === 'cs' ? 'před chvílí' : 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return lang === 'cs' ? `před ${diffMin} min` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return lang === 'cs' ? `před ${diffHours} hod` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return lang === 'cs' ? `před ${diffDays} dny` : `${diffDays}d ago`;
    const d = new Date(timestamp);
    return d.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filtered lists
  const filteredWatchHistory = useMemo(() => {
    if (!searchFilter.trim()) return watchHistory;
    const q = searchFilter.toLowerCase();
    return watchHistory.filter((item) => 
      item.title.toLowerCase().includes(q) || 
      item.author.toLowerCase().includes(q)
    );
  }, [watchHistory, searchFilter]);

  const filteredDownloadHistory = useMemo(() => {
    if (!searchFilter.trim()) return effectiveDownloads;
    const q = searchFilter.toLowerCase();
    return effectiveDownloads.filter((item) => 
      item.title.toLowerCase().includes(q) || 
      item.author.toLowerCase().includes(q) ||
      item.format.toLowerCase().includes(q)
    );
  }, [effectiveDownloads, searchFilter]);

  const clearCurrentTab = () => {
    if (activeTab === 'watch') {
      if (onClearWatchHistory) onClearWatchHistory();
    } else {
      if (onClearDownloadHistory) onClearDownloadHistory();
      else if (onClearHistory) onClearHistory();
    }
  };

  const currentCount = activeTab === 'watch' ? watchHistory.length : effectiveDownloads.length;

  return (
    <div 
      className="border rounded-2xl p-4 sm:p-6 shadow-xl transition-all"
      style={{ 
        backgroundColor: 'var(--panel-bg)', 
        borderColor: 'var(--panel-border)',
        borderRadius: 'var(--ui-radius-lg)',
        boxShadow: 'var(--panel-shadow)'
      }}
    >
      {/* Header with Title and Segment Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderBottomColor: 'var(--panel-border)' }}>
        <div className="flex items-center gap-2">
          <History className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {t.historyTitle}
          </h2>
          <span className="text-xs font-mono ml-1 px-2 py-0.5 rounded-full border" style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}>
            {watchHistory.length + effectiveDownloads.length}
          </span>
        </div>

        {/* Tab switch buttons */}
        <div 
          className="flex items-center p-1 border rounded-xl"
          style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
        >
          {/* Watch history tab */}
          <button
            type="button"
            onClick={() => setActiveTab('watch')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'watch' ? 'shadow-xs' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'watch' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'watch' ? 'var(--accent-contrast)' : 'var(--text-primary)',
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t.historyTabWatch}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20">
              {watchHistory.length}
            </span>
          </button>

          {/* Download history tab */}
          <button
            type="button"
            onClick={() => setActiveTab('download')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'download' ? 'shadow-xs' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'download' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'download' ? 'var(--accent-contrast)' : 'var(--text-primary)',
            }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.historyTabDownload}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20">
              {effectiveDownloads.length}
            </span>
          </button>
        </div>

        {/* Clear Tab History Button */}
        {currentCount > 0 && (
          <button
            type="button"
            onClick={clearCurrentTab}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer hover:opacity-80 self-start sm:self-auto"
            style={{ 
              backgroundColor: 'var(--panel-surface)', 
              borderColor: 'var(--panel-border)', 
              color: 'var(--text-muted)' 
            }}
            title={activeTab === 'watch' ? t.historyWatchClear : t.historyClear}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>{activeTab === 'watch' ? t.historyWatchClear : t.historyClear}</span>
          </button>
        )}
      </div>

      {/* Optional Search / Filter in history */}
      {currentCount > 3 && (
        <div className="pt-3 pb-1">
          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={t.historySearchPlaceholder}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border transition-colors outline-hidden focus:border-amber-500"
              style={{
                backgroundColor: 'var(--panel-surface)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-primary)',
              }}
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10 opacity-70 hover:opacity-100"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: WATCH HISTORY */}
      {activeTab === 'watch' && (
        <>
          {watchHistory.length === 0 ? (
            <div className="py-12 text-center">
              <Eye className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t.historyWatchEmpty}
              </p>
            </div>
          ) : filteredWatchHistory.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              {lang === 'cs' ? 'Hledanému výrazu neodpovídá žádné video v historii sledování.' : 'No videos match your search in watch history.'}
            </div>
          ) : (
            <div className="mt-3 divide-y" style={{ borderColor: 'var(--panel-border)' }}>
              {filteredWatchHistory.map((item) => {
                const copyKey = `watch_${item.id}`;
                const isCopied = copiedId === copyKey;

                return (
                  <div
                    key={item.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 group"
                    style={{ borderBottomColor: 'var(--panel-border)' }}
                  >
                    <div 
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      onClick={() => onSelectVideo && onSelectVideo(item.url)}
                      title={t.historyPlayVideo}
                    >
                      {/* Video Thumbnail with duration overlay */}
                      <div 
                        className="w-16 h-11 sm:w-20 sm:h-12 rounded-lg border overflow-hidden shrink-0 relative group/thumb shadow-xs"
                        style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                      >
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
                        />
                        {/* Play Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                        {item.duration && (
                          <div className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/80 rounded text-[9px] font-mono text-white">
                            {item.duration}
                          </div>
                        )}
                      </div>

                      {/* Video Metadata */}
                      <div className="min-w-0 flex-1">
                        <h4 
                          className="text-xs sm:text-sm font-semibold truncate group-hover:text-amber-500 transition-colors" 
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] sm:text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          <span className="truncate max-w-[140px] sm:max-w-xs">{item.author}</span>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1 font-mono text-[10px] opacity-80 shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {/* Play in KiYoDo */}
                      {onSelectVideo && (
                        <button
                          type="button"
                          onClick={() => onSelectVideo(item.url)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:opacity-90 shadow-xs"
                          style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
                          title={t.historyPlayVideo}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span className="hidden sm:inline">{lang === 'cs' ? 'Přehrát' : 'Play'}</span>
                        </button>
                      )}

                      {/* Quick MP3 */}
                      {onSelectVideo && (
                        <button
                          type="button"
                          onClick={() => onSelectVideo(item.url, 'mp3')}
                          className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer hover:opacity-85 flex items-center gap-1"
                          style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
                          title={t.historyQuickMp3}
                        >
                          <Music className="w-3.5 h-3.5 text-red-400" />
                          <span className="hidden md:inline font-mono text-[10px]">MP3</span>
                        </button>
                      )}

                      {/* Quick MP4 */}
                      {onSelectVideo && (
                        <button
                          type="button"
                          onClick={() => onSelectVideo(item.url, 'mp4')}
                          className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer hover:opacity-85 flex items-center gap-1"
                          style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
                          title={t.historyQuickMp4}
                        >
                          <Video className="w-3.5 h-3.5 text-blue-400" />
                          <span className="hidden md:inline font-mono text-[10px]">MP4</span>
                        </button>
                      )}

                      {/* Copy Link */}
                      <button
                        type="button"
                        onClick={() => handleCopyLink(item.url, copyKey)}
                        className="p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer border hover:opacity-80"
                        style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
                        title={isCopied ? 'Zkopírováno!' : 'Kopírovat odkaz'}
                      >
                        <Copy className={`w-3.5 h-3.5 ${isCopied ? 'text-emerald-400' : ''}`} />
                      </button>

                      {/* External YouTube link */}
                      <a
                        href={item.url.startsWith('http') ? item.url : `https://www.youtube.com/watch?v=${item.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer border hover:opacity-80"
                        style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
                        title="Otevřít na YouTube"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {/* Delete single watch item */}
                      {onRemoveWatchItem && (
                        <button
                          type="button"
                          onClick={() => onRemoveWatchItem(item.id)}
                          className="p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer border hover:border-red-500/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                          style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                          title={t.historyRemoveItem}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: DOWNLOAD HISTORY */}
      {activeTab === 'download' && (
        <>
          {effectiveDownloads.length === 0 ? (
            <div className="py-12 text-center">
              <History className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t.historyEmpty}
              </p>
            </div>
          ) : filteredDownloadHistory.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              {lang === 'cs' ? 'Hledanému výrazu neodpovídá žádný stažený soubor v historii.' : 'No downloads match your search in download history.'}
            </div>
          ) : (
            <div className="mt-3 divide-y" style={{ borderColor: 'var(--panel-border)' }}>
              {filteredDownloadHistory.map((item) => {
                const copyKey = `dl_${item.id}`;
                const isCopied = copiedId === copyKey;
                const videoUrl = `https://www.youtube.com/watch?v=${item.videoId}`;

                return (
                  <div
                    key={item.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 group"
                    style={{ borderBottomColor: 'var(--panel-border)' }}
                  >
                    <div 
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      onClick={() => onSelectVideo && onSelectVideo(videoUrl)}
                      title={t.historyPlayVideo}
                    >
                      <div 
                        className="w-16 h-11 sm:w-20 sm:h-12 rounded-lg border overflow-hidden shrink-0 relative group/thumb shadow-xs"
                        style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                      >
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                        <div className="absolute bottom-0.5 right-0.5 p-0.5 bg-black/80 rounded text-[9px] text-white">
                          {item.format === 'mp3' ? (
                            <Music className="w-2.5 h-2.5 text-red-400" />
                          ) : (
                            <Video className="w-2.5 h-2.5 text-blue-400" />
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 
                          className="text-xs sm:text-sm font-semibold truncate group-hover:text-amber-500 transition-colors" 
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] sm:text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          <span className="truncate max-w-[120px] sm:max-w-xs">{item.author}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {item.format.toUpperCase()} ({item.quality}{item.format === 'mp3' ? 'k' : 'p'})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[10px] opacity-75 shrink-0">
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {/* Open in KiYoDo player */}
                      {onSelectVideo && (
                        <button
                          type="button"
                          onClick={() => onSelectVideo(videoUrl)}
                          className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer hover:opacity-85 flex items-center gap-1"
                          style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
                          title={t.historyPlayVideo}
                        >
                          <Play className="w-3.5 h-3.5 text-amber-500" />
                          <span className="hidden sm:inline">{lang === 'cs' ? 'Přehrát' : 'Play'}</span>
                        </button>
                      )}

                      {/* Copy Link */}
                      <button
                        type="button"
                        onClick={() => handleCopyLink(item.videoId, copyKey)}
                        className="p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer border hover:opacity-80"
                        style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
                        title={isCopied ? 'Zkopírováno!' : 'Kopírovat odkaz'}
                      >
                        <Copy className={`w-3.5 h-3.5 ${isCopied ? 'text-emerald-400' : ''}`} />
                      </button>

                      {/* YouTube Link */}
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer border hover:opacity-80"
                        style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
                        title="Otevřít na YouTube"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {/* Redownload */}
                      <button
                        type="button"
                        onClick={() => handleRedownload(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer hover:opacity-90 shadow-xs"
                        style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
                        title={t.historyRedownload}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t.historyRedownload}</span>
                      </button>

                      {/* Delete single download item */}
                      {onRemoveDownloadItem && (
                        <button
                          type="button"
                          onClick={() => onRemoveDownloadItem(item.id)}
                          className="p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer border hover:border-red-500/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                          style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                          title={t.historyRemoveItem}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

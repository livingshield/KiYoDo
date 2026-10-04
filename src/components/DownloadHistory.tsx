import React from 'react';
import { History, Trash2, ExternalLink, Music, Video, Copy, Download } from 'lucide-react';
import { DownloadHistoryItem } from '../types';
import { Language, translations } from '../utils/translations';
import { getWebDownloadGatewayUrl } from '../utils/youtube';

interface DownloadHistoryProps {
  history: DownloadHistoryItem[];
  onClearHistory: () => void;
  lang: Language;
}

export const DownloadHistory: React.FC<DownloadHistoryProps> = ({
  history,
  onClearHistory,
  lang,
}) => {
  const t = translations[lang];

  const handleRedownload = (item: DownloadHistoryItem) => {
    const url = getWebDownloadGatewayUrl('cobalt', item.videoId, item.format, item.quality);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async (videoId: string) => {
    try {
      await navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${videoId}`);
    } catch {
      // Ignore
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div 
      className="border rounded-2xl p-6 shadow-xl"
      style={{ 
        backgroundColor: 'var(--panel-bg)', 
        borderColor: 'var(--panel-border)',
        borderRadius: 'var(--ui-radius-lg)',
        boxShadow: 'var(--panel-shadow)'
      }}
    >
      <div className="flex items-center justify-between pb-4 border-b" style={{ borderBottomColor: 'var(--panel-border)' }}>
        <div className="flex items-center gap-2">
          <History className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {t.historyTitle}
          </h2>
          <span className="text-xs font-mono ml-2" style={{ color: 'var(--text-muted)' }}>
            ({history.length})
          </span>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer hover:opacity-80"
            style={{ 
              backgroundColor: 'var(--panel-surface)', 
              borderColor: 'var(--panel-border)', 
              color: 'var(--text-muted)' 
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.historyClear}</span>
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="py-12 text-center">
          <History className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {t.historyEmpty}
          </p>
        </div>
      ) : (
        <div className="mt-4 divide-y" style={{ borderColor: 'var(--panel-border)' }}>
          {history.map((item) => (
            <div
              key={item.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 rounded-lg transition-colors"
              style={{ borderBottomColor: 'var(--panel-border)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div 
                  className="w-12 h-9 rounded border overflow-hidden shrink-0 relative"
                  style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                >
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0.5 right-0.5 p-0.5 bg-black/80 rounded text-[9px] text-white">
                    {item.format === 'mp3' ? (
                      <Music className="w-2.5 h-2.5 text-red-400" />
                    ) : (
                      <Video className="w-2.5 h-2.5 text-blue-400" />
                    )}
                  </div>
                </div>

                <div className="min-w-0">
                  <h4 className="text-sm font-medium truncate max-w-md" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    <span>{item.author}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                      {item.format.toUpperCase()} ({item.quality}{item.format === 'mp3' ? 'k' : 'p'})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums opacity-75">
                      {formatDate(item.timestamp)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyLink(item.videoId)}
                  className="p-2 rounded-lg transition-colors cursor-pointer border hover:opacity-80"
                  style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
                  title="Kopírovat odkaz"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                <a
                  href={`https://www.youtube.com/watch?v=${item.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg transition-colors cursor-pointer border hover:opacity-80"
                  style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
                  title="Otevřít na YouTube"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => handleRedownload(item)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.historyRedownload}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

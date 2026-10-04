import React, { useState, useMemo } from 'react';
import { 
  ListMusic, 
  CheckSquare, 
  Square, 
  Download, 
  Terminal, 
  Layers, 
  Search, 
  ExternalLink, 
  Check, 
  Music, 
  Film, 
  Sparkles, 
  ArrowLeft,
  Clock,
  Radio,
  FileCode2,
  FolderDown
} from 'lucide-react';
import { PlaylistInfo, PlaylistItem, DownloadFormat, AudioQuality, VideoQuality } from '../types';
import { Language, translations } from '../utils/translations';
import { 
  generatePlaylistWindowsBatchScript, 
  generatePlaylistPowerShellCommand, 
  triggerFileDownload 
} from '../utils/youtube';

interface PlaylistViewProps {
  playlist: PlaylistInfo;
  onBack: () => void;
  onSelectSingleVideo: (videoUrl: string) => void;
  onTransferToBatch: (videoUrls: string[]) => void;
  lang: Language;
  defaultFormat?: DownloadFormat;
  defaultAudioQuality?: AudioQuality;
  defaultVideoQuality?: VideoQuality;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlist,
  onBack,
  onSelectSingleVideo,
  onTransferToBatch,
  lang,
  defaultFormat = 'mp3',
  defaultAudioQuality = '320',
  defaultVideoQuality = '1080',
}) => {
  const t = translations[lang];

  // Selected tracks state (all selected by default)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(playlist.videos.map((v) => v.id))
  );

  const [format, setFormat] = useState<DownloadFormat>(defaultFormat);
  const [audioQuality, setAudioQuality] = useState<AudioQuality>(defaultAudioQuality);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>(defaultVideoQuality);
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedPs, setCopiedPs] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Filtered tracks
  const filteredVideos = useMemo(() => {
    if (!filterQuery.trim()) return playlist.videos;
    const q = filterQuery.toLowerCase().trim();
    return playlist.videos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.author.toLowerCase().includes(q)
    );
  }, [playlist.videos, filterQuery]);

  // Total duration calculation for selected items
  const selectedStats = useMemo(() => {
    const selectedList = playlist.videos.filter((v) => selectedIds.has(v.id));
    const totalSec = selectedList.reduce((acc, v) => acc + (v.durationSeconds || 0), 0);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    let durationLabel = '';
    if (hrs > 0) {
      durationLabel = `${hrs} h ${mins} min`;
    } else if (mins > 0) {
      durationLabel = `${mins} min ${secs} s`;
    } else {
      durationLabel = `${secs} s`;
    }

    return {
      count: selectedList.length,
      totalCount: playlist.videos.length,
      durationLabel,
    };
  }, [playlist.videos, selectedIds]);

  const toggleSelectAll = () => {
    if (selectedIds.size === playlist.videos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(playlist.videos.map((v) => v.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleInvertSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const v of playlist.videos) {
        if (!prev.has(v.id)) next.add(v.id);
      }
      return next;
    });
  };

  const handleDownloadBatchScript = () => {
    if (selectedIds.size === 0) return;

    const quality = format === 'mp3' ? audioQuality : videoQuality;
    const script = generatePlaylistWindowsBatchScript({
      playlist,
      selectedVideoIds: Array.from(selectedIds),
      format,
      quality,
    });

    const safeTitle = (playlist.title || 'Playlist')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 40);

    triggerFileDownload(`Stahnout_Playlist_${safeTitle}.bat`, script);
  };

  const handleCopyPowerShell = async () => {
    if (selectedIds.size === 0) return;

    const quality = format === 'mp3' ? audioQuality : videoQuality;
    const cmd = generatePlaylistPowerShellCommand({
      playlist,
      format,
      quality,
    });

    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedPs(true);
      setCopiedNotification(lang === 'cs' ? 'PowerShell příkaz zkopírován!' : 'PowerShell command copied!');
      setTimeout(() => {
        setCopiedPs(false);
        setCopiedNotification(null);
      }, 3000);
    } catch {
      // Fallback
    }
  };

  const handleSendToBatchDownloader = () => {
    const selectedVideos = playlist.videos.filter((v) => selectedIds.has(v.id));
    if (selectedVideos.length === 0) return;
    onTransferToBatch(selectedVideos.map((v) => v.url));
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in">
      {/* Top Bar: Back & Overview */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer border hover:opacity-90 shadow-xs"
          style={{
            backgroundColor: 'var(--panel-surface)',
            borderColor: 'var(--panel-border)',
            color: 'var(--text-primary)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === 'cs' ? 'Zpět na vyhledávání / jedno video' : 'Back to search / single video'}</span>
        </button>

        <span
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border"
          style={{
            backgroundColor: 'var(--panel-surface)',
            borderColor: 'var(--panel-border)',
            color: 'var(--accent-primary)',
          }}
        >
          <Radio className="w-3.5 h-3.5 animate-pulse" style={{ color: 'var(--accent-primary)' }} />
          {lang === 'cs' ? 'YouTube Playlist / Album' : 'YouTube Playlist / Album'}
        </span>
      </div>

      {/* Playlist Hero Header */}
      <div
        className="relative overflow-hidden border p-5 sm:p-6 shadow-md transition-all flex flex-col md:flex-row gap-5 items-start md:items-center"
        style={{
          backgroundColor: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          borderRadius: 'var(--ui-radius-lg)',
        }}
      >
        {/* Cover / Thumbnail */}
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 rounded-xl overflow-hidden shadow-lg border" style={{ borderColor: 'var(--panel-border)' }}>
          {playlist.thumbnailUrl ? (
            <img
              src={playlist.thumbnailUrl}
              alt={playlist.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400">
              <ListMusic className="w-12 h-12" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-2">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">
              <ListMusic className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
              {playlist.videoCount} {lang === 'cs' ? 'skladeb' : 'tracks'}
            </span>
          </div>
        </div>

        {/* Info & Stats */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded text-amber-500 bg-amber-500/10 border border-amber-500/20">
              {lang === 'cs' ? 'Celé album / série' : 'Full Album / Series'}
            </span>
            {playlist.author && (
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                • {playlist.author}
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
            {playlist.title}
          </h2>

          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                {lang === 'cs' ? 'Vybráno:' : 'Selected:'}{' '}
                <strong className="text-emerald-500 font-bold">{selectedStats.count}</strong> z {selectedStats.totalCount}
              </span>
            </span>

            {selectedStats.durationLabel && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>{selectedStats.durationLabel}</span>
              </span>
            )}

            <a
              href={playlist.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 underline underline-offset-2 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            >
              <ExternalLink className="w-3 h-3" />
              <span>{lang === 'cs' ? 'Otevřít na YouTube' : 'Open on YouTube'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Format & Download Controls Card */}
      <div
        className="border p-5 shadow-md flex flex-col gap-5 transition-all"
        style={{
          backgroundColor: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          borderRadius: 'var(--ui-radius-lg)',
        }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          {/* Format selection */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {lang === 'cs' ? 'Formát stažení:' : 'Download format:'}
            </span>
            <div className="inline-flex p-1 rounded-lg border" style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}>
              <button
                type="button"
                onClick={() => setFormat('mp3')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  format === 'mp3'
                    ? 'shadow-xs text-white'
                    : 'hover:opacity-80'
                }`}
                style={{
                  backgroundColor: format === 'mp3' ? 'var(--accent-primary)' : 'transparent',
                  color: format === 'mp3' ? 'var(--accent-contrast)' : 'var(--text-muted)',
                }}
              >
                <Music className="w-3.5 h-3.5" />
                <span>MP3 (Hudba)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('mp4')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  format === 'mp4'
                    ? 'shadow-xs text-white'
                    : 'hover:opacity-80'
                }`}
                style={{
                  backgroundColor: format === 'mp4' ? 'var(--accent-primary)' : 'transparent',
                  color: format === 'mp4' ? 'var(--accent-contrast)' : 'var(--text-muted)',
                }}
              >
                <Film className="w-3.5 h-3.5" />
                <span>MP4 (Video)</span>
              </button>
            </div>
          </div>

          {/* Quality selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {lang === 'cs' ? 'Kvalita:' : 'Quality:'}
            </span>
            <div className="flex items-center gap-1.5">
              {format === 'mp3' ? (
                (['320', '256', '192', '128'] as AudioQuality[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAudioQuality(q)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all cursor-pointer ${
                      audioQuality === q ? 'shadow-xs font-bold' : 'hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: audioQuality === q ? 'var(--accent-primary)' : 'var(--panel-surface)',
                      borderColor: audioQuality === q ? 'var(--accent-primary)' : 'var(--panel-border)',
                      color: audioQuality === q ? 'var(--accent-contrast)' : 'var(--text-primary)',
                    }}
                  >
                    {q}k
                  </button>
                ))
              ) : (
                (['1080', '720', '480', '360'] as VideoQuality[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setVideoQuality(q)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all cursor-pointer ${
                      videoQuality === q ? 'shadow-xs font-bold' : 'hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: videoQuality === q ? 'var(--accent-primary)' : 'var(--panel-surface)',
                      borderColor: videoQuality === q ? 'var(--accent-primary)' : 'var(--panel-border)',
                      color: videoQuality === q ? 'var(--accent-contrast)' : 'var(--text-primary)',
                    }}
                  >
                    {q}p
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Phase 1 Cover Art & Metadata Badge */}
        {format === 'mp3' && (
          <div
            className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg border"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              borderColor: 'rgba(16, 185, 129, 0.25)',
              color: '#10b981',
            }}
          >
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              {lang === 'cs'
                ? 'Do každé skladby playlistu bude automaticky vložen obal alba a ID3v2 tagy (funkční v autorádiích, mobilech i Windows).'
                : 'Cover art and ID3v2 tags will be automatically embedded into each track (works in car stereos, phones, and Windows).'}
            </span>
          </div>
        )}

        {/* Primary Download Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Download Windows Batch Script */}
          <button
            type="button"
            onClick={handleDownloadBatchScript}
            disabled={selectedIds.size === 0}
            className="flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-bold rounded-xl transition-all shadow-md cursor-pointer hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed text-white"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
            title={lang === 'cs' ? 'Stáhne skript pro automatické stažení celého playlistu do složky Downloads' : 'Downloads script to fetch playlist into Downloads folder'}
          >
            <FolderDown className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'cs' ? `Stáhnout skript (.bat) [${selectedStats.count}]` : `Download .bat script [${selectedStats.count}]`}
            </span>
          </button>

          {/* 2. Copy PowerShell Command */}
          <button
            type="button"
            onClick={handleCopyPowerShell}
            disabled={selectedIds.size === 0}
            className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl border transition-all cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            style={{
              backgroundColor: 'var(--panel-surface)',
              borderColor: 'var(--panel-border)',
              color: 'var(--text-primary)',
            }}
            title="Kopírovat 1-řádkový PowerShell příkaz pro okamžité spuštění"
          >
            {copiedPs ? <Check className="w-4 h-4 text-emerald-500" /> : <Terminal className="w-4 h-4 text-sky-400" />}
            <span>{copiedPs ? (lang === 'cs' ? 'Zkopírováno!' : 'Copied!') : (lang === 'cs' ? 'Kopírovat PowerShell' : 'Copy PowerShell')}</span>
          </button>

          {/* 3. Send to Batch Downloader */}
          <button
            type="button"
            onClick={handleSendToBatchDownloader}
            disabled={selectedIds.size === 0}
            className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl border transition-all cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            style={{
              backgroundColor: 'var(--panel-surface)',
              borderColor: 'var(--panel-border)',
              color: 'var(--text-primary)',
            }}
            title="Přenést vybrané skladby do hromadného stahovače v aplikaci"
          >
            <Layers className="w-4 h-4 text-amber-500" />
            <span>{lang === 'cs' ? 'Hromadný stahovač' : 'Send to Batch'}</span>
          </button>
        </div>

        {copiedNotification && (
          <p className="text-xs text-center text-emerald-500 font-semibold animate-fade-in -mt-2">
            {copiedNotification}
          </p>
        )}
      </div>

      {/* Tracklist Section */}
      <div
        className="border shadow-md transition-all flex flex-col"
        style={{
          backgroundColor: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          borderRadius: 'var(--ui-radius-lg)',
        }}
      >
        {/* Tracklist Toolbar */}
        <div className="p-4 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3" style={{ borderColor: 'var(--panel-border)' }}>
          {/* Selection controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer hover:opacity-90"
              style={{
                backgroundColor: 'var(--panel-surface)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-primary)',
              }}
            >
              {selectedIds.size === playlist.videos.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{lang === 'cs' ? 'Zrušit výběr' : 'Deselect all'}</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  <span>{lang === 'cs' ? 'Vybrat vše' : 'Select all'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleInvertSelection}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer hover:opacity-90"
              style={{
                backgroundColor: 'var(--panel-surface)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-muted)',
              }}
              title={lang === 'cs' ? 'Obrátit výběr' : 'Invert selection'}
            >
              {lang === 'cs' ? 'Invertovat' : 'Invert'}
            </button>

            <span className="text-xs ml-2 font-medium" style={{ color: 'var(--text-muted)' }}>
              {selectedIds.size} / {playlist.videos.length}
            </span>
          </div>

          {/* Search inside playlist */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={lang === 'cs' ? 'Hledat v playlistu...' : 'Filter tracks...'}
              className="w-full bg-transparent pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none"
              style={{
                borderColor: 'var(--panel-border)',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--panel-surface)',
              }}
            />
          </div>
        </div>

        {/* Video / Track items list */}
        <div className="divide-y max-h-[600px] overflow-y-auto" style={{ borderColor: 'var(--panel-border)' }}>
          {filteredVideos.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              {lang === 'cs' ? 'Žádná skladba neodpovídá vyhledávání.' : 'No tracks match your filter.'}
            </div>
          ) : (
            filteredVideos.map((video, index) => {
              const isSelected = selectedIds.has(video.id);
              const trackNum = (index + 1).toString().padStart(2, '0');

              return (
                <div
                  key={video.id}
                  className={`flex items-center gap-3 p-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${
                    isSelected ? '' : 'opacity-60'
                  }`}
                  onClick={() => toggleSelect(video.id)}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(video.id);
                    }}
                    className="p-1 rounded cursor-pointer transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Square className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>

                  {/* Numbering */}
                  <span className="w-6 text-center text-xs font-mono font-bold" style={{ color: 'var(--text-muted)' }}>
                    {trackNum}
                  </span>

                  {/* Thumbnail */}
                  <div className="relative w-14 h-10 sm:w-16 sm:h-11 shrink-0 rounded-md overflow-hidden bg-slate-800">
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {video.duration && video.duration !== 'Neznámá' && (
                      <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[10px] text-white px-1 py-0.2 rounded font-mono font-medium">
                        {video.duration}
                      </span>
                    )}
                  </div>

                  {/* Track Details */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-sm font-semibold line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                      {video.title}
                    </span>
                    <span className="text-xs line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                      {video.author}
                    </span>
                  </div>

                  {/* Quick download single video button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSingleVideo(video.url);
                    }}
                    className="p-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer hover:opacity-85 shrink-0"
                    style={{
                      backgroundColor: 'var(--panel-surface)',
                      borderColor: 'var(--panel-border)',
                      color: 'var(--text-primary)',
                    }}
                    title={lang === 'cs' ? 'Analyzovat a stáhnout pouze tuto skladbu' : 'Analyze and download only this track'}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info inside tracklist */}
        <div className="p-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}>
          <span>
            {lang === 'cs'
              ? `Vybráno ${selectedStats.count} z celkem ${playlist.videoCount} skladeb`
              : `Selected ${selectedStats.count} of ${playlist.videoCount} tracks`}
          </span>
          {selectedStats.durationLabel && (
            <span className="font-mono">
              {lang === 'cs' ? 'Délka:' : 'Duration:'} {selectedStats.durationLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

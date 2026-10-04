import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Film, 
  Music, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Loader2, 
  FileCheck, 
  Layers, 
  HelpCircle, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Keyboard,
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';
import { VideoInfo, DownloadFormat } from '../types';
import { Language } from '../utils/translations';
import { mergeVideoAndAudioBlobs } from '../utils/mediaMerger';
import { startServerConversion, pollJobProgress } from '../utils/youtube';

interface AudioVideoMergerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoInfo?: VideoInfo | null;
  videoQuality?: string;
  lang: Language;
  onRecordDownload?: (video: VideoInfo, format: DownloadFormat, quality: string, engineName: string) => void;
}

export const AudioVideoMergerModal: React.FC<AudioVideoMergerModalProps> = ({
  isOpen,
  onClose,
  videoInfo,
  videoQuality,
  lang,
  onRecordDownload,
}) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [isVideoDragging, setIsVideoDragging] = useState(false);
  const [isAudioDragging, setIsAudioDragging] = useState(false);

  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergeStage, setMergeStage] = useState('');
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergedBlobUrl, setMergedBlobUrl] = useState<string | null>(null);
  const [mergedFileName, setMergedFileName] = useState<string>('');

  // Track download states when user triggers step 1 or step 2 from within modal
  const [downloadingVideoTrack, setDownloadingVideoTrack] = useState(false);
  const [downloadingAudioTrack, setDownloadingAudioTrack] = useState(false);

  // Guide visibility
  const [showGuide, setShowGuide] = useState(true);

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up blob URL on unmount or reset
  useEffect(() => {
    return () => {
      if (mergedBlobUrl) {
        URL.revokeObjectURL(mergedBlobUrl);
      }
    };
  }, [mergedBlobUrl]);

  if (!isOpen) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleVideoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsVideoDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setVideoFile(file);
      setMergedBlobUrl(null);
      setMergeError(null);
    }
  };

  const handleAudioDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsAudioDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setAudioFile(file);
      setMergedBlobUrl(null);
      setMergeError(null);
    }
  };

  // Helper to trigger direct download of track from server
  const handleDownloadTrackDirectly = async (track: 'video' | 'audio') => {
    if (!videoInfo) return;
    if (track === 'video') setDownloadingVideoTrack(true);
    else setDownloadingAudioTrack(true);

    try {
      const jobId = await startServerConversion({
        url: videoInfo.url,
        format: track === 'audio' ? 'mp3' : 'mp4',
        quality: track === 'video' ? (videoQuality || '1080') : '320',
        track,
      });

      // Poll until ready
      const pollTimer = setInterval(async () => {
        try {
          const job = await pollJobProgress(jobId);
          if (job.status === 'completed') {
            clearInterval(pollTimer);
            if (track === 'video') setDownloadingVideoTrack(false);
            else setDownloadingAudioTrack(false);

            // Trigger browser download
            const ext = track === 'video' ? 'mp4' : 'm4a';
            const link = document.createElement('a');
            link.href = `/api/download/${jobId}?title=${encodeURIComponent(videoInfo.title + `_${track}`)}`;
            link.setAttribute('download', `${videoInfo.title}_${track}.${ext}`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else if (job.status === 'error') {
            clearInterval(pollTimer);
            if (track === 'video') setDownloadingVideoTrack(false);
            else setDownloadingAudioTrack(false);
            alert(`Stahování ${track} stopy selhalo: ${job.error || 'Neznámá chyba'}`);
          }
        } catch {
          // ignore transient poll error
        }
      }, 700);
    } catch (err: unknown) {
      if (track === 'video') setDownloadingVideoTrack(false);
      else setDownloadingAudioTrack(false);
      alert(`Chyba: ${err instanceof Error ? err.message : 'Nelze spustit stahování stopy'}`);
    }
  };

  const handleStartMerge = async () => {
    if (!videoFile || !audioFile) return;

    setIsMerging(true);
    setMergeProgress(5);
    setMergeStage('Příprava WebAssembly slučovače...');
    setMergeError(null);

    try {
      const outBlob = await mergeVideoAndAudioBlobs(videoFile, audioFile, (pct, stageMsg) => {
        setMergeProgress(pct);
        setMergeStage(stageMsg);
      });

      const safeName = videoInfo?.title
        ? `${videoInfo.title}_slouceno.mp4`
        : videoFile.name.replace(/\.[^/.]+$/, '') + '_se_zvukem.mp4';

      const url = URL.createObjectURL(outBlob);
      setMergedBlobUrl(url);
      setMergedFileName(safeName);
      setIsMerging(false);

      if (videoInfo && onRecordDownload) {
        onRecordDownload(videoInfo, 'mp4', '1080 (Sloučeno)', 'Záložní slučovač (WebAssembly)');
      }

      // Auto download
      const link = document.createElement('a');
      link.href = url;
      link.download = safeName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      setIsMerging(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('memory') || msg.includes('OOM') || msg.includes('allocate') || msg.includes('RangeError')) {
        setMergeError('Nedostatek paměti RAM v prohlížeči pro sloučení tohoto souboru. Doporučujeme použít náš bezpečný 1-klik skript .bat pro Windows, který funguje přímo přes ffmpeg na disku počítače bez paměťového limitu.');
      } else {
        setMergeError(`Chyba při slučování: ${msg}`);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl border shadow-2xl overflow-hidden my-8"
        style={{
          backgroundColor: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          borderRadius: 'var(--ui-radius-lg)',
        }}
      >
        {/* Header */}
        <div 
          className="p-5 sm:p-6 border-b flex items-start justify-between gap-4"
          style={{
            borderColor: 'var(--panel-border)',
            backgroundColor: 'var(--panel-surface)',
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: 'var(--badge-bg)',
                borderColor: 'var(--panel-border)',
                color: 'var(--accent-primary)',
              }}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 
                  className="text-base sm:text-lg font-bold"
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {lang === 'cs' ? 'Záložní slučovač videa a audia (Možnost C)' : 'Backup Video & Audio Merger (Option C)'}
                </h3>
                <span 
                  className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: 'var(--badge-bg)',
                    color: 'var(--badge-text)',
                  }}
                >
                  Bezpečný mód
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {lang === 'cs' 
                  ? 'Záložní řešení při nedostatku paměti: přetáhněte video a zvukový soubor ze stažených souborů a sloučte je do 1 funkčního MP4.'
                  : 'Safe fallback when memory is tight: drag & drop video and audio tracks from your downloads to merge them into 1 working MP4.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border transition-colors cursor-pointer hover:opacity-80 shrink-0"
            style={{
              backgroundColor: 'var(--panel-bg)',
              borderColor: 'var(--panel-border)',
              color: 'var(--text-muted)',
            }}
            title={lang === 'cs' ? 'Zavřít' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Active Video Quick-Download Bar (if video is currently selected) */}
          {videoInfo && (
            <div 
              className="p-4 border rounded-xl"
              style={{
                backgroundColor: 'var(--panel-surface)',
                borderColor: 'var(--accent-primary)',
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  {lang === 'cs' ? 'Kroky pro aktuální video:' : 'Steps for current video:'} {videoInfo.title}
                </span>
                <span className="text-[11px] font-mono text-slate-400 truncate max-w-[140px]">{videoInfo.author}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDownloadTrackDirectly('video')}
                  disabled={downloadingVideoTrack}
                  style={{
                    backgroundColor: 'var(--panel-bg)',
                    borderColor: 'var(--panel-border)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--ui-radius-sm)',
                  }}
                  className="flex items-center justify-between p-3 border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 hover:opacity-90"
                >
                  <div className="flex items-center gap-2 text-left">
                    <Film className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <div className="font-bold">1. Stáhnout video stopu</div>
                      <div className="text-[10px] text-slate-400">{videoQuality || '1080'}p obraz bez zvuku (.mp4)</div>
                    </div>
                  </div>
                  {downloadingVideoTrack ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                  ) : (
                    <Download className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadTrackDirectly('audio')}
                  disabled={downloadingAudioTrack}
                  style={{
                    backgroundColor: 'var(--panel-bg)',
                    borderColor: 'var(--panel-border)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--ui-radius-sm)',
                  }}
                  className="flex items-center justify-between p-3 border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 hover:opacity-90"
                >
                  <div className="flex items-center gap-2 text-left">
                    <Music className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-bold">2. Stáhnout audio stopu</div>
                      <div className="text-[10px] text-slate-400">HQ zvuková stopa (.m4a / .mp3)</div>
                    </div>
                  </div>
                  {downloadingAudioTrack ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                  ) : (
                    <Download className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* User Guide: "Jak najít soubory v počítači a přetáhnout je sem" */}
          <div 
            className="border rounded-xl overflow-hidden"
            style={{
              backgroundColor: 'var(--panel-surface)',
              borderColor: 'var(--panel-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-left cursor-pointer transition-colors hover:opacity-90"
              style={{ color: 'var(--text-primary)' }}
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span>
                  {lang === 'cs' ? 'Návod: Jak najít stažené soubory v počítači (i pro úplné začátečníky)' : 'Guide: How to find downloaded files on your PC'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
                <span>{showGuide ? (lang === 'cs' ? 'Skrýt návod' : 'Hide') : (lang === 'cs' ? 'Zobrazit tipy' : 'Show tips')}</span>
                {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showGuide && (
              <div 
                className="p-4 pt-1 border-t space-y-3 text-xs leading-relaxed"
                style={{ borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Tip 1: Top-Right Download Icon */}
                  <div 
                    className="p-3 border rounded-lg flex items-start gap-2.5"
                    style={{
                      backgroundColor: 'var(--panel-bg)',
                      borderColor: 'var(--panel-border)',
                    }}
                  >
                    <div className="p-1.5 rounded bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="text-white block font-semibold">1. Přímo z bubliny prohlížeče (Nejjednodušší)</strong>
                      <p className="mt-1 text-[11px]">
                        Po kliknutí na stažení se soubor ukáže vpravo nahoře v prohlížeči (ikona šipky ⬇️). Klikněte na něj myší, držte stisknuté tlačítko a <strong>přetáhněte jej rovnou sem</strong> do rámečku! Nemusíte otevírat žádnou složku.
                      </p>
                    </div>
                  </div>

                  {/* Tip 2: Ctrl + J */}
                  <div 
                    className="p-3 border rounded-lg flex items-start gap-2.5"
                    style={{
                      backgroundColor: 'var(--panel-bg)',
                      borderColor: 'var(--panel-border)',
                    }}
                  >
                    <div className="p-1.5 rounded bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
                      <Keyboard className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="text-white block font-semibold">2. Klávesová zkratka Ctrl + J</strong>
                      <p className="mt-1 text-[11px]">
                        Stiskněte najednou klávesy <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-white">Ctrl</kbd> a <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-white">J</kbd>. Otevře se seznam stažených souborů, odkud můžete soubor myší přetáhnout.
                      </p>
                    </div>
                  </div>

                  {/* Tip 3: Win + E */}
                  <div 
                    className="p-3 border rounded-lg flex items-start gap-2.5"
                    style={{
                      backgroundColor: 'var(--panel-bg)',
                      borderColor: 'var(--panel-border)',
                    }}
                  >
                    <div className="p-1.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="text-white block font-semibold">3. Klávesová zkratka Win + E (Windows)</strong>
                      <p className="mt-1 text-[11px]">
                        Stiskněte klávesu Windows <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-white">⊞ Win</kbd> + <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-white">E</kbd>. V levém panelu klikněte na žlutou složku <strong>Stažené soubory</strong> (Downloads).
                      </p>
                    </div>
                  </div>

                  {/* Tip 4: Simple Click */}
                  <div 
                    className="p-3 border rounded-lg flex items-start gap-2.5"
                    style={{
                      backgroundColor: 'var(--panel-bg)',
                      borderColor: 'var(--panel-border)',
                    }}
                  >
                    <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                      <FileCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="text-white block font-semibold">4. Obyčejné kliknutí na rámeček</strong>
                      <p className="mt-1 text-[11px]">
                        Nemusíte nic přetahovat! Stačí na šedý rámeček níže <strong>kliknout myší</strong> a soubor vybrat z běžného okna pro výběr souborů ve vašem počítači.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dual Drag & Drop Zones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Zone 1: Video File */}
            <div className="flex flex-col">
              <label className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <Film className="w-4 h-4 text-blue-400" />
                <span>1. Video stopa (obraz)</span>
                <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>(.mp4, .webm)</span>
              </label>

              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setVideoFile(e.target.files[0]);
                    setMergedBlobUrl(null);
                    setMergeError(null);
                  }
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsVideoDragging(true);
                }}
                onDragLeave={() => setIsVideoDragging(false)}
                onDrop={handleVideoDrop}
                onClick={() => videoInputRef.current?.click()}
                className={`flex-1 min-h-[140px] p-5 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isVideoDragging
                    ? 'border-blue-400 bg-blue-500/15 scale-[1.01]'
                    : videoFile
                    ? 'border-emerald-500/60 bg-emerald-500/10'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'
                }`}
              >
                {videoFile ? (
                  <div className="space-y-1.5">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                    <div className="font-bold text-xs text-white max-w-[220px] truncate" title={videoFile.name}>
                      {videoFile.name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {formatFileSize(videoFile.size)}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVideoFile(null);
                      }}
                      className="mt-1 text-[11px] text-red-400 hover:underline cursor-pointer"
                    >
                      Změnit / Odebrat
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud className="w-8 h-8 text-blue-400/80 mx-auto" />
                    <div className="text-xs font-semibold text-slate-200">
                      Přetáhněte sem video soubor
                    </div>
                    <div className="text-[11px] text-slate-400">
                      nebo klikněte pro výběr z PC
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Zone 2: Audio File */}
            <div className="flex flex-col">
              <label className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <Music className="w-4 h-4 text-amber-400" />
                <span>2. Audio stopa (zvuk)</span>
                <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>(.m4a, .mp3, .webm)</span>
              </label>

              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,video/mp4"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setAudioFile(e.target.files[0]);
                    setMergedBlobUrl(null);
                    setMergeError(null);
                  }
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsAudioDragging(true);
                }}
                onDragLeave={() => setIsAudioDragging(false)}
                onDrop={handleAudioDrop}
                onClick={() => audioInputRef.current?.click()}
                className={`flex-1 min-h-[140px] p-5 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isAudioDragging
                    ? 'border-amber-400 bg-amber-500/15 scale-[1.01]'
                    : audioFile
                    ? 'border-emerald-500/60 bg-emerald-500/10'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'
                }`}
              >
                {audioFile ? (
                  <div className="space-y-1.5">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                    <div className="font-bold text-xs text-white max-w-[220px] truncate" title={audioFile.name}>
                      {audioFile.name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {formatFileSize(audioFile.size)}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAudioFile(null);
                      }}
                      className="mt-1 text-[11px] text-red-400 hover:underline cursor-pointer"
                    >
                      Změnit / Odebrat
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud className="w-8 h-8 text-amber-400/80 mx-auto" />
                    <div className="text-xs font-semibold text-slate-200">
                      Přetáhněte sem audio soubor
                    </div>
                    <div className="text-[11px] text-slate-400">
                      nebo klikněte pro výběr z PC
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Merge Progress Bar */}
          {isMerging && (
            <div 
              className="p-4 border rounded-xl"
              style={{
                backgroundColor: 'var(--panel-surface)',
                borderColor: 'var(--panel-border)',
              }}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                  <span>{mergeStage}</span>
                </span>
                <span className="font-mono font-bold" style={{ color: 'var(--accent-primary)' }}>
                  {mergeProgress}%
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full overflow-hidden bg-slate-800">
                <div 
                  className="h-full transition-all duration-200 rounded-full"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    width: `${mergeProgress}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Sloučení probíhá přímo ve vašem prohlížeči pomocí bezztrátového spojení stop (lossless multiplexing). Původní kvalita obrazu i zvuku zůstává 100% zachována.
              </p>
            </div>
          )}

          {/* Error Banner with helpful fallback */}
          {mergeError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 space-y-2">
              <div className="flex items-start gap-2.5 font-bold text-sm text-red-200">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span>Sloučení se nezdařilo</span>
              </div>
              <p className="leading-relaxed pl-7">{mergeError}</p>
            </div>
          )}

          {/* Success Banner */}
          {mergedBlobUrl && !isMerging && (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Soubory byly úspěšně sloučeny do jednoho MP4!</span>
                </div>
                <a
                  href={mergedBlobUrl}
                  download={mergedFileName}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Stáhnout znovu</span>
                </a>
              </div>
              <p className="text-[11px] text-emerald-300/80">
                Stahování hotového MP4 souboru ({mergedFileName}) se automaticky spustilo do vašeho počítače.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div 
          className="p-5 sm:p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{
            borderColor: 'var(--panel-border)',
            backgroundColor: 'var(--panel-surface)',
          }}
        >
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Žádná data se neposílají na cizí servery, vše se spojuje lokálně.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              style={{
                borderColor: 'var(--panel-border)',
                color: 'var(--text-muted)',
              }}
            >
              {lang === 'cs' ? 'Zavřít' : 'Close'}
            </button>

            <button
              type="button"
              onClick={handleStartMerge}
              disabled={!videoFile || !audioFile || isMerging}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
                borderRadius: 'var(--ui-radius-sm)',
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 font-bold text-xs shadow-lg transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isMerging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Slučuji ({mergeProgress}%)...</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Sloučit do MP4 souboru</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

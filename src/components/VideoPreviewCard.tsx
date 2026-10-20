import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { 
  Music, 
  Video, 
  Download, 
  Terminal, 
  ExternalLink, 
  Scissors, 
  Copy, 
  Check, 
  FileCode,
  Sparkles,
  HardDrive,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Settings,
  Star,
  BookmarkCheck,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Gauge,
  ChevronDown,
  ChevronUp,
  PictureInPicture2,
  Captions,
  CaptionsOff,
  Clock,
  Calendar,
  Eye,
  User,
  X,
  Globe,
  Layers,
  Cpu,
  FolderOpen,
  ListMusic,
  ListOrdered,
  Volume2,
  Sliders,
  Headphones,
  Bookmark,
  SkipBack,
  SkipForward,
  ArrowLeft,
  ArrowRight,
  History
} from 'lucide-react';
import { 
  VideoInfo, 
  DownloadFormat, 
  AudioQuality, 
  VideoQuality, 
  UserPreferences,
  VideoChapter,
  VideoSubtitleTrack,
  AudioBoostOption,
  WatchHistoryItem
} from '../types';
import { Language, translations } from '../utils/translations';
import { 
  generateWindowsBatchScript, 
  generateYtDlpCommand, 
  triggerFileDownload,
  startServerConversion,
  pollJobProgress,
  getWebDownloadGatewayUrl,
  downloadTrackBlob,
  generateSplitChaptersBatchScript,
  generateSingleChapterBatchScript,
  generateSplitChaptersPowerShellCommand,
  downloadSubtitlesFile,
  generateSubtitlesBatchScript,
  generateSubtitlesPowerShellCommand
} from '../utils/youtube';
import { estimateMemoryRequirements, mergeVideoAndAudioBlobs, extractAudioToMp3 } from '../utils/mediaMerger';
import { AudioVideoMergerModal } from './AudioVideoMergerModal';
import { AddToBookmarkModal } from './AddToBookmarkModal';

interface VideoPreviewCardProps {
  video: VideoInfo;
  lang: Language;
  preferences: UserPreferences;
  onUpdatePreferences?: (prefs: UserPreferences) => void;
  onOpenSettings?: () => void;
  onRecordDownload: (video: VideoInfo, format: DownloadFormat, quality: string, engineName: string) => void;
  onBackToPreviousVideo?: () => void;
  onForwardVideo?: () => void;
  previousVideo?: { title: string; url: string; duration?: string; thumbnailUrl?: string } | null;
  nextVideo?: { title: string; url: string; duration?: string; thumbnailUrl?: string } | null;
  recentWatchedVideos?: WatchHistoryItem[];
  onSelectRecentVideo?: (url: string) => void;
}

const parseDurationToSeconds = (durStr?: string, durSec?: number): number => {
  if (typeof durSec === 'number' && durSec > 0) return durSec;
  if (!durStr) return 0;
  const parts = durStr.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
};

const formatTimestamp = (totalSec: number): string => {
  if (!totalSec || isNaN(totalSec) || totalSec < 0) return '0:00';
  const sec = Math.floor(totalSec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const VideoPreviewCard: React.FC<VideoPreviewCardProps> = ({
  video,
  lang,
  preferences,
  onUpdatePreferences,
  onOpenSettings,
  onRecordDownload,
  onBackToPreviousVideo,
  onForwardVideo,
  previousVideo,
  nextVideo,
  recentWatchedVideos,
  onSelectRecentVideo,
}) => {
  const t = translations[lang];

  const playerRef = useRef<HTMLVideoElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const recentMenuRef = useRef<HTMLDivElement | null>(null);

  const [isRecentMenuOpen, setIsRecentMenuOpen] = useState(false);

  const [format, setFormat] = useState<DownloadFormat>(preferences.defaultFormat);
  const [audioQuality, setAudioQuality] = useState<AudioQuality>(preferences.defaultAudioQuality);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>(preferences.defaultVideoQuality);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [quickSaved, setQuickSaved] = useState(false);
  const [showTrim, setShowTrim] = useState(false);
  const [trimStart, setTrimStart] = useState('');
  const [trimEnd, setTrimEnd] = useState('');
  const [showChapters, setShowChapters] = useState(true);
  const [copiedChapterPs, setCopiedChapterPs] = useState(false);
  const [showSubtitlesSection, setShowSubtitlesSection] = useState(false);
  const [selectedSubLang, setSelectedSubLang] = useState<string>('cs');
  const [selectedSubFormat, setSelectedSubFormat] = useState<'srt' | 'vtt'>('srt');
  const [isDownloadingSub, setIsDownloadingSub] = useState(false);
  const [copiedSubPs, setCopiedSubPs] = useState(false);
  const [audioBoost, setAudioBoost] = useState<AudioBoostOption>(preferences.defaultAudioBoost || 'none');
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [thumbnailFallback, setThumbnailFallback] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Playback progress states
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => parseDurationToSeconds(video.duration, video.durationSeconds));
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Playback speed states
  const SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const;
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const speedMenuRef = useRef<HTMLDivElement | null>(null);

  // In-window playback quality states
  const PLAYBACK_QUALITY_OPTIONS: { id: string; label: string; ytQuality: string; badge?: string }[] = [
    { id: 'auto', label: 'Auto', ytQuality: 'default', badge: lang === 'cs' ? 'Doporučeno' : 'Recommended' },
    { id: '1080', label: '1080p', ytQuality: 'hd1080', badge: 'Full HD' },
    { id: '720', label: '720p', ytQuality: 'hd720', badge: 'HD' },
    { id: '480', label: '480p', ytQuality: 'large', badge: 'SD' },
    { id: '360', label: '360p', ytQuality: 'medium' },
    { id: '240', label: '240p', ytQuality: 'small' },
  ];
  const [playbackQuality, setPlaybackQuality] = useState<string>('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const qualityMenuRef = useRef<HTMLDivElement | null>(null);

  // Audio-only playback state (Data Saver Mode)
  const [isAudioOnly, setIsAudioOnly] = useState(false);

  // Picture-in-Picture state
  const [isPip, setIsPip] = useState(false);

  // Closed Captions (subtitles) state
  const [showCaptions, setShowCaptions] = useState(false);
  const [hasCaptions, setHasCaptions] = useState<boolean | null>(null);

  // Simulated download progress states (triggered on quality selection)
  const [simulatedDownload, setSimulatedDownload] = useState<{
    active: boolean;
    quality: string;
    format: DownloadFormat;
    progress: number;
    status: 'starting' | 'transferring' | 'finalizing' | 'completed';
    speed: string;
    transferredBytes: number;
    totalBytes: number;
  } | null>(null);
  const simulatedDownloadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Option A & Option C States
  const [isWasmMerging, setIsWasmMerging] = useState(false);
  const [wasmPercent, setWasmPercent] = useState(0);
  const [wasmStage, setWasmStage] = useState('');
  const [wasmMuxError, setWasmMuxError] = useState<string | null>(null);
  const [wasmMuxCompleted, setWasmMuxCompleted] = useState(false);
  const [isMergerModalOpen, setIsMergerModalOpen] = useState(false);
  const wasmAbortControllerRef = useRef<AbortController | null>(null);
  // Advanced options collapsible accordion
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<'quality' | 'method' | 'audio' | 'trim' | 'subtitles' | 'chapters'>('quality');

  // Automatically update format and quality when a new video is loaded or preferences change
  useEffect(() => {
    setFormat(preferences.defaultFormat);
    setAudioQuality(preferences.defaultAudioQuality);

    // Auto-select highest available quality if preferred quality is unavailable for this video
    if (video.availableQualities && video.availableQualities.length > 0) {
      if (video.availableQualities.includes(preferences.defaultVideoQuality)) {
        setVideoQuality(preferences.defaultVideoQuality);
      } else {
        setVideoQuality(video.maxQuality || video.availableQualities[0]);
      }
    } else {
      setVideoQuality(preferences.defaultVideoQuality);
    }

    setShowPlayer(false);
    setIsPlaying(false);
    setIsAudioOnly(false);
    setIsPip(false);
    setShowCaptions(false);
    setHasCaptions(null);
    setCurrentTime(0);
    setDuration(parseDurationToSeconds(video.duration, video.durationSeconds));
    setPlaybackSpeed(1);
    setShowSpeedMenu(false);
    setSimulatedDownload(null);
    setIsWasmMerging(false);
    setWasmPercent(0);
    setWasmStage('');
    setWasmMuxError(null);
    setWasmMuxCompleted(false);
    setIsMergerModalOpen(false);
    setShowChapters(true);
    setCopiedChapterPs(false);
    if (video.subtitles && video.subtitles.length > 0) {
      const csSub = video.subtitles.find(s => s.code.startsWith('cs'));
      setSelectedSubLang(csSub ? csSub.code : video.subtitles[0].code);
    } else {
      setSelectedSubLang('cs');
    }
    setShowSubtitlesSection(false);
    setIsDownloadingSub(false);
    setCopiedSubPs(false);
    setAudioBoost(preferences.defaultAudioBoost || 'none');
    if (simulatedDownloadTimerRef.current) {
      clearInterval(simulatedDownloadTimerRef.current);
      simulatedDownloadTimerRef.current = null;
    }
  }, [video.id, video.duration, video.durationSeconds, preferences]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (simulatedDownloadTimerRef.current) {
        clearInterval(simulatedDownloadTimerRef.current);
      }
    };
  }, []);

  const handleTogglePip = async () => {
    if (playerRef.current) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          setIsPip(false);
          return;
        } else if ('requestPictureInPicture' in playerRef.current) {
          await (playerRef.current as HTMLVideoElement).requestPictureInPicture();
          setIsPip(true);
          return;
        }
      } catch {
        // fallback to react-player pip prop
      }
    }
    setIsPip((prev) => !prev);
  };

  const detectCaptions = () => {
    if (!playerRef.current) return;
    try {
      const el = playerRef.current as any;
      if (el.textTracks && el.textTracks.length > 0) {
        setHasCaptions(true);
        return;
      }
      if (el.api && typeof el.api.getOption === 'function') {
        const list = el.api.getOption('captions', 'tracklist');
        if (Array.isArray(list) && list.length > 0) {
          setHasCaptions(true);
          return;
        }
      }
      if (hasCaptions === null) {
        setHasCaptions(true);
      }
    } catch {
      // ignore
    }
  };

  const handleToggleCaptions = () => {
    const nextState = !showCaptions;
    setShowCaptions(nextState);

    if (playerRef.current) {
      try {
        const el = playerRef.current as any;
        // 1. Native HTML5 TextTracks
        if (el.textTracks && el.textTracks.length > 0) {
          for (let i = 0; i < el.textTracks.length; i++) {
            el.textTracks[i].mode = nextState ? 'showing' : 'hidden';
          }
        }

        // 2. YouTube API via youtube-video-element or iframe
        if (el.api && typeof el.api.setOption === 'function') {
          if (nextState) {
            if (typeof el.api.loadModule === 'function') el.api.loadModule('captions');
            el.api.setOption('captions', 'track', { languageCode: lang === 'cs' ? 'cs' : 'en' });
          } else {
            if (typeof el.api.unloadModule === 'function') {
              el.api.unloadModule('captions');
            } else {
              el.api.setOption('captions', 'track', {});
            }
          }
        }
      } catch (err) {
        console.warn('Captions toggle error:', err);
      }
    }
  };

  const estimateExpectedBytes = (fmt: DownloadFormat, q: string, sec: number): number => {
    const safeSec = sec > 0 ? sec : 210;
    if (fmt === 'mp3') {
      const kbps = parseInt(q, 10) || 320;
      return Math.round(((kbps * 1000) / 8) * safeSec);
    } else {
      const map: Record<string, number> = {
        '1080': 4800,
        '720': 2500,
        '480': 1200,
        '360': 700,
      };
      const kbps = map[q] || 2500;
      return Math.round(((kbps * 1000) / 8) * safeSec);
    }
  };

  const triggerDownloadSimulation = (newFmt: DownloadFormat, newQ: string) => {
    if (simulatedDownloadTimerRef.current) {
      clearInterval(simulatedDownloadTimerRef.current);
      simulatedDownloadTimerRef.current = null;
    }

    const totalBytes = estimateExpectedBytes(newFmt, newQ, duration || 180);

    setSimulatedDownload({
      active: true,
      quality: newQ,
      format: newFmt,
      progress: 0,
      status: 'starting',
      speed: '14.2 MB/s',
      transferredBytes: 0,
      totalBytes,
    });

    let current = 0;
    simulatedDownloadTimerRef.current = setInterval(() => {
      current += 3.5 + Math.random() * 2.5;
      if (current >= 100) {
        current = 100;
        if (simulatedDownloadTimerRef.current) {
          clearInterval(simulatedDownloadTimerRef.current);
          simulatedDownloadTimerRef.current = null;
        }
        setSimulatedDownload((prev) =>
          prev
            ? {
                ...prev,
                progress: 100,
                status: 'completed',
                speed: '0 MB/s',
                transferredBytes: prev.totalBytes,
              }
            : null
        );
      } else {
        const randSpeed = (12 + Math.random() * 6).toFixed(1) + ' MB/s';
        const status =
          current < 15
            ? 'starting'
            : current < 88
            ? 'transferring'
            : 'finalizing';
        const transferred = Math.min(
          totalBytes,
          Math.floor((current / 100) * totalBytes)
        );

        setSimulatedDownload((prev) =>
          prev
            ? {
                ...prev,
                progress: Math.floor(current),
                status,
                speed: randSpeed,
                transferredBytes: transferred,
              }
            : null
        );
      }
    }, 60);
  };

  // Close speed menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setShowSpeedMenu(false);
      }
    };
    if (showSpeedMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSpeedMenu]);

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    if (playerRef.current) {
      try {
        const el = playerRef.current as any;
        if (typeof el.setPlaybackRate === 'function') {
          el.setPlaybackRate(speed);
        } else {
          el.playbackRate = speed;
        }
      } catch {
        // ignore
      }
    }
  };

  // Close quality menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setShowQualityMenu(false);
      }
    };
    if (showQualityMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showQualityMenu]);

  // Close recent watched videos menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (recentMenuRef.current && !recentMenuRef.current.contains(e.target as Node)) {
        setIsRecentMenuOpen(false);
      }
    };
    if (isRecentMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRecentMenuOpen]);

  const handleQualityChange = (selectedQualityId: string) => {
    setPlaybackQuality(selectedQualityId);
    setShowQualityMenu(false);

    const option = PLAYBACK_QUALITY_OPTIONS.find(o => o.id === selectedQualityId) || PLAYBACK_QUALITY_OPTIONS[0];
    const targetYt = option.ytQuality;

    if (playerRef.current) {
      try {
        const el = playerRef.current as any;
        if (el.api) {
          if (typeof el.api.setPlaybackQuality === 'function') {
            el.api.setPlaybackQuality(targetYt);
          }
          if (typeof el.api.setPlaybackQualityRange === 'function') {
            el.api.setPlaybackQualityRange(targetYt, targetYt);
          }
        }
        if (typeof el.getInternalPlayer === 'function') {
          const internal = el.getInternalPlayer();
          if (internal) {
            if (typeof internal.setPlaybackQuality === 'function') {
              internal.setPlaybackQuality(targetYt);
            }
            if (typeof internal.setPlaybackQualityRange === 'function') {
              internal.setPlaybackQualityRange(targetYt, targetYt);
            }
          }
        }
        if (typeof el.setPlaybackQuality === 'function') {
          el.setPlaybackQuality(targetYt);
        }
      } catch (err) {
        console.debug('Failed to set playback quality:', err);
      }
    }
  };

  // Toggle between standard video player and data-saver audio-only player
  const handleToggleAudioOnly = () => {
    setIsAudioOnly((prev) => !prev);
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  // Periodic sync of current playback time while player is active and playing
  useEffect(() => {
    if (!isPlaying || !showPlayer) return;
    const interval = setInterval(() => {
      if (playerRef.current && !isScrubbing) {
        const el = playerRef.current as any;
        const cur = typeof el.getCurrentTime === 'function' ? el.getCurrentTime() : el.currentTime;
        if (typeof cur === 'number' && !isNaN(cur)) {
          setCurrentTime(cur);
        }
        const dur = typeof el.getDuration === 'function' ? el.getDuration() : el.duration;
        if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
          setDuration(dur);
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isPlaying, showPlayer, isScrubbing]);

  const seekTo = (seconds: number) => {
    const targetDuration = duration > 0 ? duration : (playerRef.current?.duration || seconds);
    const boundedTime = Math.max(0, Math.min(seconds, targetDuration || seconds));
    setCurrentTime(boundedTime);
    if (playerRef.current) {
      try {
        const el = playerRef.current as any;
        if (typeof el.seekTo === 'function') {
          el.seekTo(boundedTime, 'seconds');
        } else if (typeof el.currentTime === 'number') {
          el.currentTime = boundedTime;
        }
      } catch {
        // ignore
      }
    }
  };

  const jumpSeconds = (delta: number) => {
    seekTo(currentTime + delta);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetDuration = duration > 0 ? duration : (playerRef.current?.duration || 0);
    if (targetDuration > 0) {
      seekTo(ratio * targetDuration);
    }
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = rect.width > 0 ? clientX / rect.width : 0;
    const targetDuration = duration > 0 ? duration : (playerRef.current?.duration || 0);
    setHoverX(clientX);
    setHoverTime(targetDuration > 0 ? ratio * targetDuration : null);
  };

  const handleProgressBarMouseLeave = () => {
    setHoverTime(null);
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  // Check if current selection matches user's default preferences
  const isCurrentDefault =
    format === preferences.defaultFormat &&
    (format === 'mp3'
      ? audioQuality === preferences.defaultAudioQuality
      : videoQuality === preferences.defaultVideoQuality);

  const handleSaveAsDefault = () => {
    if (!onUpdatePreferences) return;
    onUpdatePreferences({
      ...preferences,
      defaultFormat: format,
      defaultAudioQuality: audioQuality,
      defaultVideoQuality: videoQuality,
    });
    setQuickSaved(true);
    setTimeout(() => setQuickSaved(false), 2000);
  };

  // Direct Server Conversion states
  const [isConverting, setIsConverting] = useState(false);
  const [conversionPercent, setConversionPercent] = useState(0);
  const [conversionMessage, setConversionMessage] = useState('');
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [completedJobId, setCompletedJobId] = useState<string | null>(null);
  const [completedFileSize, setCompletedFileSize] = useState<number | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQuality = format === 'mp3' ? audioQuality : videoQuality;
  const currentDurationSec = duration > 0 ? duration : parseDurationToSeconds(video.duration, video.durationSeconds);
  const memEstimate = estimateMemoryRequirements(currentDurationSec, videoQuality);

  // Approximate size estimate
  const estimatedSize = format === 'mp3' 
    ? (audioQuality === '320' ? '~9-12 MB' : audioQuality === '256' ? '~7-9 MB' : '~4-6 MB')
    : (videoQuality === '1080' ? `~${memEstimate.totalEstimatedMb} MB` : videoQuality === '720' ? '~20-45 MB' : '~10-25 MB');

  // Handle in-browser Option A (WebAssembly lossless muxing)
  const handleWasmMergeDownload = async () => {
    setIsWasmMerging(true);
    setWasmPercent(5);
    setWasmStage(`Krok 1/3: Stahuji ${videoQuality}p video stopu ze serveru...`);
    setWasmMuxError(null);
    setWasmMuxCompleted(false);

    const abortCtrl = new AbortController();
    wasmAbortControllerRef.current = abortCtrl;

    try {
      // 1. Fetch video track blob
      const videoBlob = await downloadTrackBlob({
        url: video.url,
        track: 'video',
        quality: videoQuality,
        signal: abortCtrl.signal,
        onProgress: (pct, msg) => {
          setWasmPercent(Math.round(pct * 0.45));
          setWasmStage(`Krok 1/3 (video): ${msg}`);
        },
      });

      // 2. Fetch audio track blob
      setWasmPercent(45);
      setWasmStage('Krok 2/3: Stahuji vysoce kvalitní audio stopu...');
      const audioBlob = await downloadTrackBlob({
        url: video.url,
        track: 'audio',
        quality: '320',
        signal: abortCtrl.signal,
        onProgress: (pct, msg) => {
          setWasmPercent(45 + Math.round(pct * 0.20));
          setWasmStage(`Krok 2/3 (audio): ${msg}`);
        },
      });

      // 3. Merge in browser memory with WebAssembly
      setWasmPercent(65);
      setWasmStage('Krok 3/3: Slučuji video a audio v prohlížeči (lossless multiplex)...');
      const mergedBlob = await mergeVideoAndAudioBlobs(
        videoBlob, 
        audioBlob, 
        (pct, stageMsg) => {
          setWasmPercent(65 + Math.round(pct * 0.33));
          setWasmStage(`Krok 3/3: ${stageMsg}`);
        },
        audioBoost
      );

      // 4. Trigger download
      setWasmPercent(100);
      setWasmStage('Sloučení dokončeno! Ukládám MP4 do počítače...');
      setWasmMuxCompleted(true);
      setIsWasmMerging(false);

      const safeFilename = `${video.title.replace(/[/\\?%*:|"<>]/g, '').trim() || video.id}_${videoQuality}p.mp4`;
      const blobUrl = URL.createObjectURL(mergedBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);

      onRecordDownload(video, 'mp4', `${videoQuality}p (WebAssembly Sloučeno)`, 'WebAssembly Možnost A');
    } catch (err: unknown) {
      setIsWasmMerging(false);
      const msg = err instanceof Error ? err.message : String(err);
      const isOom = msg.toLowerCase().includes('memory') || 
                    msg.toLowerCase().includes('oom') || 
                    msg.toLowerCase().includes('allocate') || 
                    msg.toLowerCase().includes('quota') ||
                    msg.toLowerCase().includes('rangeerror');
      
      if (isOom) {
        setWasmMuxError(`V prohlížeči došla volná paměť RAM pro toto video (odhadováno ~${memEstimate.totalEstimatedMb} MB). Doporučujeme přejít na Záložní slučovač (Možnost C) nebo 1-klik skript .bat pro PC, který paměťový limit nemá.`);
      } else {
        setWasmMuxError(`Chyba při automatickém sloučení: ${msg}`);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  // Handle in-browser pure MP3 extraction via WebAssembly (strips any video tracks completely)
  const handleWasmAudioDownload = async () => {
    setIsConverting(true);
    setConversionPercent(10);
    setConversionMessage('Krok 1/2: Stahuji audio stopu ze serveru...');
    setConversionError(null);
    setCompletedJobId(null);
    setCompletedFileSize(null);

    const abortCtrl = new AbortController();
    wasmAbortControllerRef.current = abortCtrl;

    try {
      // 1. Download raw track blob from server (audio track or fallback muxed stream)
      const rawBlob = await downloadTrackBlob({
        url: video.url,
        track: 'audio',
        quality: audioQuality,
        signal: abortCtrl.signal,
        onProgress: (pct, msg) => {
          setConversionPercent(Math.round(pct * 0.5));
          setConversionMessage(`Krok 1/2 (stahování): ${msg}`);
        },
      });

      // 2. Extract pure MP3 via WebAssembly FFmpeg (strips video track -vn, applies volume boost & trimming)
      setConversionPercent(55);
      setConversionMessage('Krok 2/2: Převádím do čistého MP3 bez videa (WebAssembly)...');

      const mp3Blob = await extractAudioToMp3(rawBlob, {
        bitrate: audioQuality,
        audioBoost,
        trimStart: trimStart.trim() || undefined,
        trimEnd: trimEnd.trim() || undefined,
        onProgress: (pct, stageMsg) => {
          setConversionPercent(55 + Math.round(pct * 0.42));
          setConversionMessage(`Krok 2/2: ${stageMsg}`);
        },
      });

      setConversionPercent(100);
      setConversionMessage('Extrakce dokončena! Ukládám čisté MP3 do počítače...');
      setIsConverting(false);
      setCompletedFileSize(mp3Blob.size);

      const safeFilename = `${video.title.replace(/[/\\?%*:|"<>]/g, '').trim() || video.id}.mp3`;
      const blobUrl = URL.createObjectURL(mp3Blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);

      onRecordDownload(video, 'mp3', `${audioQuality}k (Čisté MP3)`, 'WebAssembly Extrakce');
    } catch (err: unknown) {
      setIsConverting(false);
      const msg = err instanceof Error ? err.message : String(err);
      setConversionError(`Chyba při extrakci audia: ${msg}`);
    }
  };

  // Handle direct in-app conversion and download
  const handleDirectDownload = async () => {
    if (format === 'mp3') {
      handleWasmAudioDownload();
      return;
    }
    if (format === 'mp4') {
      handleWasmMergeDownload();
      return;
    }

    setIsConverting(true);
    setConversionPercent(5);
    setConversionMessage('Připojuji se k serveru...');
    setConversionError(null);
    setCompletedJobId(null);
    setCompletedFileSize(null);

    try {
      const jobId = await startServerConversion({
        url: video.url,
        format,
        quality: currentQuality,
        trimStart: trimStart.trim() || undefined,
        trimEnd: trimEnd.trim() || undefined,
      });

      // Poll progress every 750ms
      pollingTimerRef.current = setInterval(async () => {
        try {
          const progress = await pollJobProgress(jobId);
          setConversionPercent(progress.percent || 10);
          setConversionMessage(progress.message || 'Zpracovávám...');

          if (progress.status === 'completed') {
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
            setIsConverting(false);
            setCompletedJobId(jobId);
            setCompletedFileSize(progress.fileSize || null);
            onRecordDownload(video, format, currentQuality, 'Integrovaný konvertor');

            // Trigger immediate browser download
            const downloadUrl = `/api/download/${jobId}?title=${encodeURIComponent(video.title)}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `${video.title}.${format}`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else if (progress.status === 'error') {
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
            setIsConverting(false);
            setConversionError(progress.error || 'Konverze selhala na straně serveru.');
          }
        } catch {
          // ignore transient poll error
        }
      }, 750);
    } catch (err: unknown) {
      setIsConverting(false);
      const msg = err instanceof Error ? err.message : 'Nepodařilo se zahájit konverzi.';
      setConversionError(msg);
    }
  };

  // Quick 1-click Hero Download trigger
  const handleQuickDownload = async (targetFormat: DownloadFormat) => {
    setFormat(targetFormat);
    setCompletedJobId(null);
    setCompletedFileSize(null);

    if (video.platform === 'tiktok') {
      if (targetFormat === 'mp3' && video.directAudioUrl) {
        window.open(video.directAudioUrl, '_blank');
        onRecordDownload(video, 'mp3', 'HQ', 'TikTok Audio Direct');
        return;
      } else if (targetFormat === 'mp4' && video.directDownloadUrl) {
        window.open(video.directDownloadUrl, '_blank');
        onRecordDownload(video, 'mp4', 'HD', 'TikTok Video Direct');
        return;
      }
    }

    if (targetFormat === 'mp4') {
      handleWasmMergeDownload();
      return;
    }

    if (targetFormat === 'mp3') {
      handleWasmAudioDownload();
      return;
    }
  };
  const handleSaveAgain = () => {
    if (!completedJobId) return;
    const downloadUrl = `/api/download/${completedJobId}?title=${encodeURIComponent(video.title)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `${video.title}.${format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Windows Batch File Generation & Download
  const handleDownloadBatchScript = () => {
    const scriptContent = generateWindowsBatchScript({
      url: video.url,
      title: video.title,
      format,
      quality: currentQuality,
      trimStart: trimStart.trim() || undefined,
      trimEnd: trimEnd.trim() || undefined,
      audioBoost,
      platform: video.platform,
    });

    const safeFilename = `Stahnout_${format.toUpperCase()}_${video.id}.bat`;
    triggerFileDownload(safeFilename, scriptContent, 'application/x-bat;charset=utf-8');
    onRecordDownload(video, format, currentQuality, `Windows Script (.bat) [${audioBoost}]`);
  };

  const [copiedPowerShell, setCopiedPowerShell] = useState(false);

  const handleCopyPowerShell = async () => {
    const isAudio = format === 'mp3';
    let af = '';
    if (audioBoost === 'boost3') af = 'volume=1.41';
    else if (audioBoost === 'boost6') af = 'volume=2.0';
    else if (audioBoost === 'normalize') af = 'loudnorm=I=-16:TP=-1.5:LRA=11';

    const boostArg = af ? (isAudio ? `--postprocessor-args "ExtractAudio:-filter:a ${af}"` : `--postprocessor-args "FFmpeg:-filter:a ${af}"`) : '';
    const extractorArg = video.platform && video.platform !== 'youtube' ? '' : '--extractor-args "youtube:player_client=android,web" ';

    const dlArgs = isAudio
      ? `${extractorArg}-x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata ${boostArg}`
      : `${extractorArg}-S "res:${videoQuality},ext:mp4:m4a" -f "bestvideo[height<=${videoQuality}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${videoQuality}]+bestaudio/best[height<=${videoQuality}]/best" --merge-output-format mp4 ${boostArg}`;

    const psCmd = `$url="${video.url}"; $o="$HOME\\Downloads\\%(title)s.%(ext)s"; $y = if (Get-Command yt-dlp -ErrorAction SilentlyContinue) { "yt-dlp" } else { $t = "$env:TEMP\\yt-dlp.exe"; if (!(Test-Path $t)) { [Net.ServicePointManager]::SecurityProtocol = 3072; Invoke-WebRequest 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile $t }; $t }; Write-Host "[*] Zkousim prime stazeni..." -ForegroundColor Cyan; & $y ${dlArgs} -o $o $url; if ($LASTEXITCODE -ne 0) { foreach ($b in @("edge", "chrome", "firefox", "brave")) { Write-Host "[*] Zkousim stazeni s overenim z $b..." -ForegroundColor Cyan; & $y --cookies-from-browser $b ${dlArgs} -o $o $url; if ($LASTEXITCODE -eq 0) { break } } }`;

    try {
      await navigator.clipboard.writeText(psCmd);
      setCopiedPowerShell(true);
      setTimeout(() => setCopiedPowerShell(false), 2500);
    } catch {
      // fallback
    }
  };

  // Handle Copy Terminal Command
  const handleCopyCommand = async () => {
    const cmd = generateYtDlpCommand({
      url: video.url,
      format,
      quality: currentQuality,
      trimStart: trimStart.trim() || undefined,
      trimEnd: trimEnd.trim() || undefined,
      audioBoost,
      platform: video.platform,
    });

    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Handle downloading all chapters split into individual files (.bat)
  const handleDownloadAllChapters = () => {
    const scriptContent = generateSplitChaptersBatchScript({
      video,
      format,
      quality: currentQuality,
    });
    const safeFilename = `Rozdelit_Kapitoly_${format.toUpperCase()}_${video.id}.bat`;
    triggerFileDownload(safeFilename, scriptContent, 'application/x-bat;charset=utf-8');
    onRecordDownload(video, format, currentQuality, `Rozdělení ${video.chapters?.length || 0} kapitol (.bat)`);
  };

  // Handle single chapter download (.bat)
  const handleDownloadSingleChapter = (chapter: VideoChapter, index: number) => {
    const scriptContent = generateSingleChapterBatchScript({
      video,
      chapter,
      chapterIndex: index,
      format,
      quality: currentQuality,
    });
    const safeTitle = chapter.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const safeFilename = `Kapitola_${index + 1}_${safeTitle}_${format.toUpperCase()}.bat`;
    triggerFileDownload(safeFilename, scriptContent, 'application/x-bat;charset=utf-8');
    onRecordDownload(video, format, currentQuality, `Kapitola ${index + 1}: ${chapter.title} (.bat)`);
  };

  // Handle copy PowerShell script for chapters split
  const handleCopySplitChaptersPowerShell = async () => {
    const psCmd = generateSplitChaptersPowerShellCommand({
      video,
      format,
      quality: currentQuality,
    });
    try {
      await navigator.clipboard.writeText(psCmd);
      setCopiedChapterPs(true);
      setTimeout(() => setCopiedChapterPs(false), 2500);
    } catch {
      // fallback
    }
  };

  // Prefill chapter into trim range
  const handleApplyChapterToTrim = (chapter: VideoChapter) => {
    setTrimStart(String(chapter.startTime));
    setTrimEnd(String(chapter.endTime));
    setShowTrim(true);
  };

  // Handle direct subtitle download (.srt or .vtt)
  const handleDownloadSubtitles = async () => {
    setIsDownloadingSub(true);
    try {
      const activeTrack = video.subtitles?.find(s => s.code === selectedSubLang);
      await downloadSubtitlesFile({
        url: video.url,
        lang: selectedSubLang,
        format: selectedSubFormat,
        title: video.title,
        isAuto: activeTrack?.isAutoGenerated,
      });
      onRecordDownload(video, 'mp4' as any, selectedSubFormat, `Titulky [${selectedSubLang.toUpperCase()}]`);
    } finally {
      setIsDownloadingSub(false);
    }
  };

  // Handle subtitle batch script (.bat)
  const handleDownloadSubtitlesBatch = () => {
    const scriptContent = generateSubtitlesBatchScript({
      video,
      lang: selectedSubLang,
      format: selectedSubFormat,
    });
    const safeFilename = `Titulky_${selectedSubLang.toUpperCase()}_${video.id}.bat`;
    triggerFileDownload(safeFilename, scriptContent, 'application/x-bat;charset=utf-8');
    onRecordDownload(video, 'mp4' as any, selectedSubFormat, `Skript titulky [${selectedSubLang.toUpperCase()}]`);
  };

  // Handle copy PowerShell subtitle download command
  const handleCopySubtitlesPowerShell = async () => {
    const psCmd = generateSubtitlesPowerShellCommand({
      video,
      lang: selectedSubLang,
      format: selectedSubFormat,
    });
    try {
      await navigator.clipboard.writeText(psCmd);
      setCopiedSubPs(true);
      setTimeout(() => setCopiedSubPs(false), 2500);
    } catch {
      // fallback
    }
  };

  const effectiveThumbnail = thumbnailFallback 
    ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
    : video.thumbnailUrl;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatUploadDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const effectiveDisplayDuration =
    video.duration && video.duration !== 'Neznámá' && video.duration !== 'Unknown'
      ? video.duration
      : duration > 0
      ? formatTimestamp(duration)
      : null;

  const formattedUploadDate = formatUploadDate(video.uploadDate);

  const availablePlaybackQualities = PLAYBACK_QUALITY_OPTIONS.filter((opt) => {
    if (opt.id === 'auto') return true;
    if (video.availableQualities && video.availableQualities.length > 0) {
      return video.availableQualities.includes(opt.id as any) || opt.id === '360' || opt.id === '240';
    }
    if (video.rawMaxHeight) {
      return parseInt(opt.id, 10) <= video.rawMaxHeight;
    }
    return true;
  });

  return (
    <div 
      className="border overflow-hidden shadow-2xl transition-all"
      style={{
        backgroundColor: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        borderRadius: 'var(--ui-radius-lg)',
      }}
    >
      {/* Top Navigation & Watch History Bar */}
      {(previousVideo || nextVideo || (recentWatchedVideos && recentWatchedVideos.length > 0)) && (
        <div 
          className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2.5 border-b text-xs"
          style={{ 
            backgroundColor: 'var(--panel-surface)', 
            borderColor: 'var(--panel-border)' 
          }}
        >
          <div className="flex items-center gap-2">
            {previousVideo && onBackToPreviousVideo && (
              <button
                type="button"
                onClick={onBackToPreviousVideo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/10 shadow-xs"
                style={{
                  backgroundColor: 'var(--panel-bg)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
                title={`${t.backToPreviousVideo}: ${previousVideo.title}`}
              >
                <ArrowLeft className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-bold">{t.backToPreviousVideo}</span>
                <span className="hidden sm:inline font-normal truncate max-w-[180px] md:max-w-xs text-slate-400">
                  ({previousVideo.title})
                </span>
              </button>
            )}

            {nextVideo && onForwardVideo && (
              <button
                type="button"
                onClick={onForwardVideo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/10 shadow-xs"
                style={{
                  backgroundColor: 'var(--panel-bg)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
                title={`${t.navNextVideo}: ${nextVideo.title}`}
              >
                <span>{t.navNextVideo}</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              </button>
            )}
          </div>

          {/* Quick Recent Watched Videos Dropdown */}
          {recentWatchedVideos && recentWatchedVideos.length > 0 && onSelectRecentVideo && (
            <div className="relative" ref={recentMenuRef}>
              <button
                type="button"
                onClick={() => setIsRecentMenuOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer hover:opacity-85"
                style={{
                  backgroundColor: 'var(--panel-bg)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--text-muted)',
                }}
                title={t.recentWatched}
              >
                <History className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">{t.recentWatched}</span>
                <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] bg-black/15 dark:bg-white/10 font-bold" style={{ color: 'var(--text-primary)' }}>
                  {recentWatchedVideos.length}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {isRecentMenuOpen && (
                <div 
                  className="absolute right-0 top-full mt-1.5 w-72 sm:w-80 rounded-xl border shadow-2xl p-2 z-50 divide-y"
                  style={{
                    backgroundColor: 'var(--panel-bg)',
                    borderColor: 'var(--panel-border)',
                    boxShadow: 'var(--panel-shadow)',
                  }}
                >
                  <div className="px-2 py-1 pb-2 flex items-center justify-between text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    <span>{t.recentWatched}</span>
                    <span className="text-[10px] font-normal text-slate-400 font-mono">
                      {recentWatchedVideos.length} {lang === 'cs' ? 'videí' : 'videos'}
                    </span>
                  </div>
                  <div className="pt-1 max-h-60 overflow-y-auto space-y-1">
                    {recentWatchedVideos.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setIsRecentMenuOpen(false);
                          onSelectRecentVideo(item.url);
                        }}
                        className="w-full flex items-center gap-2.5 p-1.5 rounded-lg text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer group"
                      >
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-10 h-7 rounded object-cover shrink-0 border"
                          style={{ borderColor: 'var(--panel-border)' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate group-hover:text-amber-500 transition-colors" style={{ color: 'var(--text-primary)' }}>
                            {item.title}
                          </p>
                          <p className="text-[10px] truncate text-slate-400">
                            {item.author} {item.duration ? `· ${item.duration}` : ''}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Video Header & Media Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Thumbnail or ReactPlayer HTML5 Video Player Preview */}
        <div className="lg:col-span-5 relative">
          {showPlayer ? (
            <div className="flex flex-col gap-3">
              <div 
                className="aspect-video w-full rounded-xl overflow-hidden bg-black border shadow-2xl relative group/player"
                style={{ borderColor: isAudioOnly ? 'rgba(16, 185, 129, 0.5)' : 'var(--panel-border)' }}
              >
                {/* Underlying Video/YouTube Player (Kept running in background during audio-only mode) */}
                <div className={`w-full h-full ${isAudioOnly ? 'opacity-0 pointer-events-none absolute inset-0 -z-10' : ''}`}>
                  {video.platform === 'facebook' ? (
                    video.directDownloadUrl ? (
                      <video
                        ref={playerRef}
                        src={video.directDownloadUrl}
                        controls={!isAudioOnly}
                        autoPlay={isPlaying}
                        playsInline
                        className="w-full h-full object-contain bg-black"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => {
                          setIsPlaying(false);
                          if (duration > 0) setCurrentTime(duration);
                        }}
                        onTimeUpdate={(e) => {
                          if (isScrubbing) return;
                          const target = e.currentTarget;
                          if (target) {
                            if (typeof target.currentTime === 'number' && !isNaN(target.currentTime)) {
                              setCurrentTime(target.currentTime);
                            }
                            if (typeof target.duration === 'number' && !isNaN(target.duration) && target.duration > 0) {
                              setDuration(target.duration);
                            }
                          }
                        }}
                        onDurationChange={(e) => {
                          const target = e.currentTarget;
                          if (target && typeof target.duration === 'number' && !isNaN(target.duration) && target.duration > 0) {
                            setDuration(target.duration);
                          }
                        }}
                        onLoadedMetadata={(e) => {
                          const target = e.currentTarget;
                          if (target && typeof target.duration === 'number' && !isNaN(target.duration) && target.duration > 0) {
                            setDuration(target.duration);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-black flex flex-col items-center justify-center relative">
                        <iframe
                          src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(video.url)}&show_text=false&t=0&autoplay=1`}
                          className="w-full h-full border-0"
                          style={{ border: 'none', overflow: 'hidden' }}
                          scrolling="no"
                          frameBorder="0"
                          allowFullScreen={true}
                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen"
                        />
                      </div>
                    )
                  ) : video.platform === 'instagram' ? (
                    video.directDownloadUrl ? (
                      <video
                        ref={playerRef}
                        src={video.directDownloadUrl}
                        controls={!isAudioOnly}
                        autoPlay={isPlaying}
                        playsInline
                        className="w-full h-full object-contain bg-black"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                      />
                    ) : (
                      <div className="w-full h-full bg-black flex flex-col items-center justify-center relative">
                        <iframe
                          src={`https://www.instagram.com/reel/${video.id}/embed`}
                          className="w-full h-full border-0"
                          style={{ border: 'none', overflow: 'hidden' }}
                          scrolling="no"
                          frameBorder="0"
                          allowFullScreen={true}
                        />
                      </div>
                    )
                  ) : video.platform === 'tiktok' && video.directDownloadUrl ? (
                    <video
                      ref={playerRef}
                      src={video.directDownloadUrl}
                      controls={!isAudioOnly}
                      autoPlay={isPlaying}
                      playsInline
                      className="w-full h-full object-contain bg-black"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => {
                        setIsPlaying(false);
                        if (duration > 0) setCurrentTime(duration);
                      }}
                      onTimeUpdate={(e) => {
                        if (isScrubbing) return;
                        const target = e.currentTarget;
                        if (target) {
                          if (typeof target.currentTime === 'number' && !isNaN(target.currentTime)) {
                            setCurrentTime(target.currentTime);
                          }
                          if (typeof target.duration === 'number' && !isNaN(target.duration) && target.duration > 0) {
                            setDuration(target.duration);
                          }
                        }
                      }}
                      onDurationChange={(e) => {
                        const target = e.currentTarget;
                        if (target && typeof target.duration === 'number' && !isNaN(target.duration) && target.duration > 0) {
                          setDuration(target.duration);
                        }
                      }}
                      onLoadedMetadata={(e) => {
                        const target = e.currentTarget;
                        if (target && typeof target.duration === 'number' && !isNaN(target.duration) && target.duration > 0) {
                          setDuration(target.duration);
                        }
                      }}
                    />
                  ) : (
                    <ReactPlayer
                      ref={playerRef}
                      src={
                        playbackQuality !== 'auto' && video.url.includes('youtube.com')
                          ? `${video.url}${video.url.includes('?') ? '&' : '?'}vq=${PLAYBACK_QUALITY_OPTIONS.find(o => o.id === playbackQuality)?.ytQuality || 'default'}`
                          : video.url
                      }
                      playing={isPlaying}
                      playbackRate={playbackSpeed}
                      controls={!isAudioOnly}
                      width="100%"
                      height="100%"
                      pip={isPip}
                      config={{
                        youtube: {
                          cc_load_policy: (showCaptions ? 1 : 0) as 0 | 1,
                          cc_lang_pref: lang === 'cs' ? 'cs' : 'en',
                        },
                      }}
                      onReady={() => {
                        detectCaptions();
                        if (playbackQuality !== 'auto') {
                          handleQualityChange(playbackQuality);
                        }
                      }}
                      onEnterPictureInPicture={() => setIsPip(true)}
                      onLeavePictureInPicture={() => setIsPip(false)}
                      onPlay={() => {
                        setIsPlaying(true);
                        if (playerRef.current) {
                          try {
                            playerRef.current.playbackRate = playbackSpeed;
                          } catch {
                            // ignore
                          }
                          detectCaptions();
                          if (playbackQuality !== 'auto') {
                            handleQualityChange(playbackQuality);
                          }
                        }
                      }}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => {
                        setIsPlaying(false);
                        if (duration > 0) setCurrentTime(duration);
                      }}
                      onTimeUpdate={(e) => {
                        if (isScrubbing) return;
                        const target = e.currentTarget;
                        if (target) {
                          if (typeof target.currentTime === 'number' && !isNaN(target.currentTime)) {
                            setCurrentTime(target.currentTime);
                          }
                          if (typeof target.duration === 'number' && !isNaN(target.duration) && target.duration > 0) {
                            setDuration(target.duration);
                          }
                        }
                      }}
                      onDurationChange={(e) => {
                        const target = e.currentTarget;
                        if (target && typeof target.duration === 'number' && !isNaN(target.duration) && target.duration > 0) {
                          setDuration(target.duration);
                        }
                      }}
                      onLoadedMetadata={(e) => {
                        const target = e.currentTarget;
                        if (target && typeof target.duration === 'number' && !isNaN(target.duration) && target.duration > 0) {
                          setDuration(target.duration);
                        }
                        if (playerRef.current) {
                          try {
                            playerRef.current.playbackRate = playbackSpeed;
                          } catch {
                            // ignore
                          }
                          detectCaptions();
                        }
                      }}
                    />
                  )}
                </div>

                {/* Dedicated Data-Saver Audio-Only Canvas Overlay */}
                {isAudioOnly && (
                  <div className="absolute inset-0 z-10 bg-slate-950 flex flex-col items-center justify-center p-4 select-none">
                    {/* Background blurred cover art */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <img
                        src={effectiveThumbnail}
                        alt=""
                        aria-hidden="true"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover blur-2xl opacity-25 scale-125"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/90" />
                    </div>

                    {/* Switch to video button at top-left */}
                    <button
                      type="button"
                      onClick={handleToggleAudioOnly}
                      className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/85 hover:bg-slate-900 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur-md border border-white/20 hover:border-white/50 transition-all hover:scale-105 cursor-pointer opacity-90 hover:opacity-100"
                      title={lang === 'cs' ? 'Přepnout zpět na video' : 'Switch back to video'}
                    >
                      <Video className="w-3.5 h-3.5 text-slate-300" />
                      <span>{lang === 'cs' ? 'Přepnout na video' : 'Switch to video'}</span>
                    </button>

                    {/* Close button at top-right */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlayer(false);
                        setIsPlaying(false);
                      }}
                      className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/85 hover:bg-black text-xs font-semibold text-white shadow-xl backdrop-blur-md border border-white/20 hover:border-red-400 transition-all hover:scale-105 cursor-pointer opacity-80 hover:opacity-100"
                      title={t.closePlayer}
                    >
                      <X className="w-3.5 h-3.5 text-red-400" />
                      <span>{t.closePlayer}</span>
                    </button>

                    {/* Center Audio Visual & Artwork */}
                    <div className="relative z-10 flex flex-col items-center text-center max-w-[85%]">
                      {/* Vinyl / Cover Art */}
                      <div 
                        onClick={togglePlayPause}
                        className="relative group cursor-pointer mb-2.5"
                        title={isPlaying ? (lang === 'cs' ? 'Pozastavit' : 'Pause') : (lang === 'cs' ? 'Přehrát' : 'Play')}
                      >
                        <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-2xl border-2 border-emerald-500/50 relative ${isPlaying ? 'ring-4 ring-emerald-500/30' : 'ring-2 ring-white/10'} transition-all`}>
                          <img
                            src={effectiveThumbnail}
                            alt={video.title}
                            referrerPolicy="no-referrer"
                            className={`w-full h-full object-cover transition-transform duration-500 ${isPlaying ? 'scale-105 animate-[spin_12s_linear_infinite]' : 'grayscale-[20%]'}`}
                          />
                          <div className="absolute inset-0 bg-black/35 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            {isPlaying ? (
                              <Pause className="w-7 h-7 text-white drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                            ) : (
                              <Play className="w-7 h-7 text-white drop-shadow-md ml-1" />
                            )}
                          </div>
                        </div>

                        {/* Center Vinyl Spindle Hole */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-950 border border-emerald-400/80 pointer-events-none" />
                      </div>

                      {/* Track Title & Artist */}
                      <h4 className="text-white font-bold text-xs sm:text-sm line-clamp-1 drop-shadow-sm mb-0.5 max-w-full">
                        {video.title}
                      </h4>
                      <p className="text-slate-400 text-[11px] sm:text-xs line-clamp-1 mb-2">
                        {video.author}
                      </p>

                      {/* Animated Sound Wave Bars */}
                      <div className="flex items-center gap-1 h-5">
                        {[40, 75, 100, 60, 90, 50, 80, 45, 95, 60, 30].map((h, i) => (
                          <span
                            key={i}
                            className={`w-1 rounded-full bg-gradient-to-t from-emerald-500 to-teal-300 transition-all duration-300 ${
                              isPlaying ? 'animate-pulse' : 'opacity-30'
                            }`}
                            style={{
                              height: isPlaying ? `${Math.max(20, (h * ((i % 3) + 1)) % 100)}%` : '20%',
                              animationDelay: `${i * 120}ms`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top overlay buttons in video mode */}
                {!isAudioOnly && (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleAudioOnly}
                      className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/85 hover:bg-emerald-950 text-xs font-semibold text-emerald-300 shadow-xl backdrop-blur-md border border-emerald-500/40 hover:border-emerald-400 transition-all hover:scale-105 cursor-pointer opacity-90 hover:opacity-100"
                      title={t.audioOnlyTooltip}
                    >
                      <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{lang === 'cs' ? 'Přehrát pouze audio' : 'Audio only'}</span>
                      <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/30 text-emerald-200 font-semibold hidden sm:inline">
                        -95%
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlayer(false);
                        setIsPlaying(false);
                      }}
                      className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/85 hover:bg-black text-xs font-semibold text-white shadow-xl backdrop-blur-md border border-white/20 hover:border-white/50 transition-all hover:scale-105 cursor-pointer opacity-80 hover:opacity-100"
                      title={t.closePlayer}
                    >
                      <X className="w-3.5 h-3.5 text-slate-300" />
                      <span>{t.closePlayer}</span>
                    </button>
                  </>
                )}
              </div>

              {/* Custom Playback Progress Bar & Navigation Toolbar */}
              <div 
                className="rounded-xl p-3 border shadow-xl backdrop-blur-sm"
                style={{
                  backgroundColor: 'var(--panel-bg)',
                  borderColor: 'var(--panel-border)',
                }}
              >
                {/* Progress Header: Current timestamp / Duration + Percentage */}
                <div className="flex items-center justify-between text-xs font-mono mb-2" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isPlaying 
                          ? (isAudioOnly ? 'bg-emerald-400 animate-pulse' : 'animate-pulse') 
                          : 'bg-amber-400'
                      }`}
                      style={isPlaying && !isAudioOnly ? { backgroundColor: 'var(--accent-primary)' } : undefined}
                    />
                    <span className="font-semibold tracking-wider" style={{ color: 'var(--text-primary)' }}>
                      {formatTimestamp(currentTime)}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>/</span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatTimestamp(duration)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span 
                      className="px-2 py-0.5 rounded-md border font-bold text-[11px] shadow-xs"
                      style={isAudioOnly ? {
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        borderColor: 'rgba(16, 185, 129, 0.3)',
                        color: '#34d399',
                      } : {
                        backgroundColor: 'var(--badge-bg)',
                        borderColor: 'var(--panel-border)',
                        color: 'var(--badge-text)',
                      }}
                    >
                      {Math.round(progressPercent)}%
                    </span>
                    <span className="text-[11px] hidden sm:inline font-sans" style={{ color: 'var(--text-muted)' }}>
                      {isPlaying 
                        ? (isAudioOnly ? (t.audioModePlaying || 'Přehrávání pouze audia') : (lang === 'cs' ? 'Přehrává se' : 'Playing')) 
                        : (lang === 'cs' ? 'Pozastaveno' : 'Paused')}
                    </span>
                  </div>
                </div>

                {/* Interactive Scrubber Bar */}
                <div
                  ref={progressBarRef}
                  onClick={handleProgressBarClick}
                  onMouseMove={handleProgressBarMouseMove}
                  onMouseLeave={handleProgressBarMouseLeave}
                  className="relative h-2.5 w-full bg-slate-800 hover:h-3.5 rounded-full cursor-pointer group/bar transition-all select-none overflow-visible mb-2.5"
                  role="progressbar"
                  aria-label={t.playbackProgress}
                  aria-valuemin={0}
                  aria-valuemax={duration || 100}
                  aria-valuenow={currentTime}
                >
                  {/* Background Track with rounded overflow */}
                  <div className="absolute inset-0 rounded-full bg-slate-800/90 overflow-hidden">
                    <div className="absolute inset-0 bg-slate-700/40" />
                    {/* Filled Played Track (Gradient) */}
                    <div
                      className={`h-full rounded-full relative transition-[width] duration-75 shadow-sm ${
                        isAudioOnly
                          ? 'bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-300 shadow-emerald-500/50'
                          : 'shadow-xs'
                      }`}
                      style={isAudioOnly ? { width: `${progressPercent}%` } : {
                        width: `${progressPercent}%`,
                        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary, var(--accent-hover)))',
                      }}
                    />
                  </div>

                  {/* Floating Scrubber Knob */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg shadow-black/80 border-2 pointer-events-none transform -translate-x-1/2 transition-transform duration-75 group-hover/bar:scale-125 group-hover/bar:w-4 group-hover/bar:h-4"
                    style={{
                      left: `${progressPercent}%`,
                      borderColor: isAudioOnly ? '#10b981' : 'var(--accent-primary)',
                    }}
                  />

                  {/* Hover Time Tooltip */}
                  {hoverTime !== null && (
                    <div
                      className="absolute bottom-full mb-2 -translate-x-1/2 px-2 py-0.5 bg-slate-900 border border-slate-700 text-white text-[10px] font-mono rounded shadow-2xl pointer-events-none whitespace-nowrap z-30 flex items-center gap-1"
                      style={{ left: `${hoverX}px` }}
                    >
                      <span 
                        className="w-1.5 h-1.5 rounded-full" 
                        style={{ backgroundColor: isAudioOnly ? '#34d399' : 'var(--accent-primary)' }} 
                      />
                      <span>{formatTimestamp(hoverTime)}</span>
                    </div>
                  )}
                </div>

                {/* Tier 1 Row: Playback Transport (Play/Pause, -10s, +10s, 0:00) + Close */}
                <div 
                  className="flex items-center justify-between gap-1.5 text-xs pt-1 pb-2 border-b"
                  style={{ borderColor: 'var(--panel-border)' }}
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Previous Video in player */}
                    {previousVideo && onBackToPreviousVideo && (
                      <button
                        type="button"
                        onClick={onBackToPreviousVideo}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer shadow-xs"
                        title={`${t.backToPreviousVideo}: ${previousVideo.title}`}
                      >
                        <SkipBack className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={togglePlayPause}
                      style={{
                        backgroundColor: isPlaying ? 'transparent' : 'var(--accent-primary)',
                        color: isPlaying ? 'var(--text-primary)' : 'var(--accent-contrast)',
                        borderColor: isPlaying ? 'var(--panel-border)' : 'transparent',
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
                        isPlaying ? 'border hover:bg-white/5' : 'hover:opacity-90'
                      }`}
                      title={isPlaying ? (lang === 'cs' ? 'Pozastavit' : 'Pause') : (lang === 'cs' ? 'Přehrát' : 'Play')}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>{lang === 'cs' ? 'Pauza' : 'Pause'}</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          <span>{lang === 'cs' ? 'Přehrát' : 'Play'}</span>
                        </>
                      )}
                    </button>

                    {/* Next Video in player */}
                    {nextVideo && onForwardVideo && (
                      <button
                        type="button"
                        onClick={onForwardVideo}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer shadow-xs"
                        title={`${t.navNextVideo}: ${nextVideo.title}`}
                      >
                        <SkipForward className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => jumpSeconds(-10)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer"
                      title={t.jumpBack10}
                    >
                      <RotateCcw className="w-3 h-3 text-slate-400" />
                      <span className="font-mono text-[11px]">-10s</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => jumpSeconds(10)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer"
                      title={t.jumpForward10}
                    >
                      <span className="font-mono text-[11px]">+10s</span>
                      <RotateCw className="w-3 h-3 text-slate-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => seekTo(0)}
                      className="inline-flex items-center px-2 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
                      title={t.restartVideo}
                    >
                      0:00
                    </button>
                  </div>

                  {/* Close Player */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlayer(false);
                      setIsPlaying(false);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer shrink-0"
                    title={t.closePlayer}
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden sm:inline">{t.closePlayer}</span>
                  </button>
                </div>

                {/* Tier 2 Row: Stream Quality & Speed on Left; Audio-only, PiP, CC on Right */}
                <div className="flex items-center justify-between gap-1.5 text-xs pt-2">
                  <div className="flex items-center gap-1.5">
                    {/* Playback Quality Selection Menu */}
                    <div className="relative" ref={qualityMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800"
                        title={t.playbackQuality || 'Kvalita přehrávání'}
                      >
                        <Sliders className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold">
                          {playbackQuality === 'auto' ? (t.qualityAuto || 'Auto') : `${playbackQuality}p`}
                        </span>
                        <ChevronDown
                          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                            showQualityMenu ? 'rotate-180' : ''
                          }`}
                          style={showQualityMenu ? { color: 'var(--accent-primary)' } : undefined}
                        />
                      </button>

                      {/* Quality Dropdown Menu */}
                      {showQualityMenu && (
                        <div 
                          className="absolute bottom-full mb-1.5 left-0 z-50 min-w-[170px] border rounded-xl shadow-2xl p-1.5 backdrop-blur-md"
                          style={{
                            backgroundColor: 'var(--panel-bg)',
                            borderColor: 'var(--panel-border)',
                          }}
                        >
                          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                            <span>{t.playbackQuality || 'Kvalita přehrávání'}</span>
                            <Sliders className="w-3 h-3 text-slate-500" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {availablePlaybackQualities.map((opt) => {
                              const isSelected = playbackQuality === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleQualityChange(opt.id)}
                                  style={isSelected ? {
                                    backgroundColor: 'var(--badge-bg)',
                                    color: 'var(--badge-text)',
                                    borderColor: 'var(--panel-border)',
                                  } : undefined}
                                  className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all text-left cursor-pointer ${
                                    isSelected
                                      ? 'font-semibold border'
                                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold">{opt.label}</span>
                                    {opt.badge && (
                                      <span 
                                        className="text-[9px] px-1 py-0.2 rounded font-sans"
                                        style={{
                                          backgroundColor: 'var(--panel-surface)',
                                          color: 'var(--text-muted)',
                                        }}
                                      >
                                        {opt.badge}
                                      </span>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 shrink-0 ml-1" style={{ color: 'var(--accent-primary)' }} />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Playback Speed Selection Menu */}
                    <div className="relative" ref={speedMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800"
                        title={t.playbackSpeed}
                      >
                        <Gauge className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold">{playbackSpeed}x</span>
                        <ChevronDown
                          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                            showSpeedMenu ? 'rotate-180' : ''
                          }`}
                          style={showSpeedMenu ? { color: 'var(--accent-primary)' } : undefined}
                        />
                      </button>

                      {/* Speed Dropdown Menu */}
                      {showSpeedMenu && (
                        <div 
                          className="absolute bottom-full mb-1.5 left-0 z-50 min-w-[130px] border rounded-xl shadow-2xl p-1.5 backdrop-blur-md"
                          style={{
                            backgroundColor: 'var(--panel-bg)',
                            borderColor: 'var(--panel-border)',
                          }}
                        >
                          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                            <span>{t.playbackSpeed}</span>
                            <Gauge className="w-3 h-3 text-slate-500" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {SPEED_OPTIONS.map((speed) => {
                              const isSelected = playbackSpeed === speed;
                              return (
                                <button
                                  key={speed}
                                  type="button"
                                  onClick={() => handleSpeedChange(speed)}
                                  style={isSelected ? {
                                    backgroundColor: 'var(--badge-bg)',
                                    color: 'var(--badge-text)',
                                    borderColor: 'var(--panel-border)',
                                  } : undefined}
                                  className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all text-left cursor-pointer ${
                                    isSelected
                                      ? 'font-semibold border'
                                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                  }`}
                                >
                                  <span>{speed === 1 ? `${speed}x (${lang === 'cs' ? 'běžná' : 'normal'})` : `${speed}x`}</span>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 shrink-0 ml-1" style={{ color: 'var(--accent-primary)' }} />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right secondary toggles: Audio-only, PiP, CC */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Audio-only Data Saver Mode Button */}
                    <button
                      type="button"
                      onClick={handleToggleAudioOnly}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isAudioOnly
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 shadow-xs ring-1 ring-emerald-500/40'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                      title={t.audioOnlyTooltip}
                    >
                      <Headphones className={`w-3.5 h-3.5 ${isAudioOnly ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                      <span>{isAudioOnly ? (lang === 'cs' ? 'Pouze audio' : 'Audio only') : (lang === 'cs' ? 'Pouze audio' : 'Audio only')}</span>
                      <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/30 text-emerald-200 font-semibold">
                        -95%
                      </span>
                    </button>

                    {/* Picture-in-Picture Mode Toggle Button */}
                    <button
                      type="button"
                      onClick={handleTogglePip}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                        isPip
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-xs ring-1 ring-cyan-500/30'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                      title={isPip ? t.pipActive : t.pipMode}
                    >
                      <PictureInPicture2 className={`w-3.5 h-3.5 ${isPip ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className="text-[11px]">PiP</span>
                    </button>

                    {/* Closed Captions (Subtitles) Toggle Button */}
                    <button
                      type="button"
                      onClick={handleToggleCaptions}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                        showCaptions
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-xs ring-1 ring-purple-500/30'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                      title={showCaptions ? t.captionsOn : t.captionsToggle}
                    >
                      {showCaptions ? (
                        <Captions className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <CaptionsOff className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="font-bold text-[11px]">CC</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 relative group/thumb">
              <img
                src={effectiveThumbnail}
                alt={video.title}
                onError={() => setThumbnailFallback(true)}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500"
              />

              {/* Played progress line on thumbnail if partially watched */}
              {currentTime > 0 && duration > 0 && (
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-slate-950/80 overflow-hidden z-10">
                  <div
                    className="h-full shadow-xs"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: 'var(--accent-primary)',
                    }}
                  />
                </div>
              )}

              {/* Big Centered Play Button to Play In-Window */}
              <button
                type="button"
                onClick={() => {
                  setShowPlayer(true);
                  setIsPlaying(true);
                }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 hover:bg-black/60 transition-all group/btn cursor-pointer"
                title={t.playInWindow}
              >
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl transform group-hover/btn:scale-110 transition-all duration-200 ring-4 ring-white/25"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  <Play className="w-6 h-6 fill-current ml-1" />
                </div>
                <span className="mt-2.5 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-xs font-semibold text-white tracking-wide shadow-lg group-hover/btn:border-white/30 transition-colors">
                  {t.playInWindow}
                </span>
              </button>

              {/* Bottom Info Bar with Duration and external YouTube link */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-between p-3 pointer-events-none">
                {video.duration ? (
                  <span className="text-[11px] font-mono font-bold text-white bg-black/80 px-2 py-0.5 rounded border border-white/10">
                    {video.duration}
                  </span>
                ) : (
                  <span />
                )}
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto flex items-center gap-1.5 text-xs text-white/90 hover:text-white bg-black/65 backdrop-blur-sm px-2.5 py-1 rounded border border-white/10 hover:border-white/30 transition-colors"
                  title={`Otevřít na ${video.platform === 'facebook' ? 'Facebook' : video.platform === 'instagram' ? 'Instagram' : video.platform === 'tiktok' ? 'TikTok' : 'YouTube'}`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>
                    {video.platform === 'facebook'
                      ? 'Facebook'
                      : video.platform === 'instagram'
                      ? 'Instagram'
                      : video.platform === 'tiktok'
                      ? 'TikTok'
                      : 'YouTube'}
                  </span>
                </a>
              </div>
            </div>
          )}

          {/* Sub-bar below video/player: In-window player toggle & metadata */}
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2 min-w-0">
              {!showPlayer && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAudioOnly(false);
                      setShowPlayer(true);
                      setIsPlaying(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all cursor-pointer shadow-xs"
                    title={t.playInWindow}
                  >
                    <Play className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)', fill: 'var(--accent-primary)' }} />
                    <span>{t.playInWindow}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAudioOnly(true);
                      setShowPlayer(true);
                      setIsPlaying(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-600/60 transition-all cursor-pointer shadow-xs hover:scale-[1.02]"
                    title={t.audioOnlyTooltip}
                  >
                    <Headphones className="w-4 h-4 text-emerald-400" />
                    <span>{lang === 'cs' ? 'Přehrát pouze audio' : 'Play audio only'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 font-semibold border border-emerald-400/30 hidden sm:inline">
                      -95% dat
                    </span>
                  </button>
                </>
              )}

              {currentTime > 0 && duration > 0 && !showPlayer && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-700/60 hidden sm:inline">
                  {t.played}: {formatTimestamp(currentTime)} ({Math.round(progressPercent)}%)
                </span>
              )}

              <span className="font-medium text-slate-300 truncate hidden sm:inline">{video.author}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-slate-400">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700/60 hidden sm:inline">HTML5</span>
              <span className="hidden sm:inline">ID: {video.id}</span>
              <span className="hidden sm:inline" aria-hidden="true">·</span>
              <span className="text-slate-300">{estimatedSize}</span>
            </div>
          </div>
        </div>

        {/* Video Details & Format Controls */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div>
            {/* Platform Badge */}
            <div className="flex items-center gap-2 mb-2">
              {video.platform === 'tiktok' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  TikTok Video
                </span>
              )}
              {video.platform === 'instagram' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/15 text-pink-400 border border-pink-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                  Instagram Reels
                </span>
              )}
              {video.platform === 'facebook' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  Facebook Video
                </span>
              )}
              {(!video.platform || video.platform === 'youtube') && (
                <span 
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                  style={{
                    backgroundColor: 'var(--badge-bg)',
                    color: 'var(--badge-text)',
                    borderColor: 'var(--panel-border)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-primary)' }} />
                  YouTube
                </span>
              )}
            </div>

            <h2 
              className="text-lg sm:text-xl font-bold line-clamp-2 leading-snug"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)',
              }}
            >
              {video.title}
            </h2>

            {/* Video Metadata Bar: Author, Duration, Upload Date, Views */}
            <div className="mt-2.5 flex flex-wrap items-center gap-y-2 gap-x-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              {/* Channel / Author */}
              <div 
                className="flex items-center gap-1.5 font-medium px-2 py-0.5 border"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--ui-radius-sm)',
                }}
              >
                <User className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                {video.authorUrl ? (
                  <a
                    href={video.authorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline transition-colors truncate max-w-[180px]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {video.author}
                  </a>
                ) : (
                  <span className="truncate max-w-[180px]">{video.author}</span>
                )}
              </div>

              {/* Video Duration */}
              {effectiveDisplayDuration && (
                <div
                  className="flex items-center gap-1.5 font-mono px-2 py-0.5 border"
                  style={{
                    backgroundColor: 'var(--panel-surface)',
                    borderColor: 'var(--panel-border)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--ui-radius-sm)',
                  }}
                  title={t.metadataDuration}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                  <span>{effectiveDisplayDuration}</span>
                </div>
              )}

              {/* Upload Date */}
              {formattedUploadDate && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 border"
                  style={{
                    backgroundColor: 'var(--panel-surface)',
                    borderColor: 'var(--panel-border)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--ui-radius-sm)',
                  }}
                  title={t.metadataUploadDate}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                  <span>{formattedUploadDate}</span>
                </div>
              )}

              {/* View Count */}
              {video.viewCount && (
                <div
                  className="flex items-center gap-1.5 font-mono px-2 py-0.5 border"
                  style={{
                    backgroundColor: 'var(--panel-surface)',
                    borderColor: 'var(--panel-border)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--ui-radius-sm)',
                  }}
                  title={t.metadataViews}
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <span>{video.viewCount} {lang === 'cs' ? 'zhlédnutí' : 'views'}</span>
                </div>
              )}

              {/* Status Indicator */}
              <span 
                className="font-medium flex items-center gap-1 px-2 py-0.5 border text-[11px]"
                style={{
                  backgroundColor: 'var(--badge-bg)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--badge-text)',
                  borderRadius: 'var(--ui-radius-sm)',
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Připraveno ke stažení</span>
              </span>

              {/* Add to Bookmark Button */}
              <button
                type="button"
                onClick={() => setIsBookmarkModalOpen(true)}
                className="font-medium flex items-center gap-1.5 px-2.5 py-0.5 border text-[11px] transition-all hover:bg-white/10 cursor-pointer shadow-xs"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--accent-primary)',
                  borderRadius: 'var(--ui-radius-sm)',
                }}
                title={lang === 'cs' ? 'Uložit do záložek' : 'Save to bookmarks'}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{lang === 'cs' ? 'Do záložek' : 'Bookmark'}</span>
              </button>
            </div>

            {/* TikTok Direct Download Banner (if applicable) */}
            {video.platform === 'tiktok' && (video.directDownloadUrl || video.directAudioUrl) && (
              <div 
                className="mt-4 p-4 border shadow-sm space-y-2"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: '#06b6d4',
                  borderRadius: 'var(--ui-radius-md)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <h3 className="text-sm font-bold text-cyan-400" style={{ fontFamily: 'var(--font-heading)' }}>
                    {t.directSocialDownload}
                  </h3>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'cs' ? 'Přímé stažení bez vodoznaku:' : 'Direct watermark-free download:'}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {video.directDownloadUrl && (
                    <a
                      href={video.directDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={`${video.title}.mp4`}
                      onClick={() => onRecordDownload(video, 'mp4', 'HD', 'TikTok Direct')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{lang === 'cs' ? 'Stáhnout video (Bez vodoznaku)' : 'Download MP4 (No Watermark)'}</span>
                    </a>
                  )}
                  {video.directAudioUrl && (
                    <a
                      href={video.directAudioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={`${video.title}.mp3`}
                      onClick={() => onRecordDownload(video, 'mp3', 'HQ', 'TikTok Audio')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border transition-all cursor-pointer"
                      style={{
                        backgroundColor: 'var(--panel-bg)',
                        borderColor: 'var(--panel-border)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Music className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{lang === 'cs' ? 'Pouze MP3 zvuk' : 'MP3 Audio Only'}</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* HERO 1-CLICK CALL TO ACTION CARDS */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Hero Card 1: 🎵 MP3 Download */}
              <div 
                className="p-4 border flex flex-col justify-between transition-all duration-200 hover:shadow-md"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: format === 'mp3' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  borderRadius: 'var(--ui-radius-md)',
                  borderWidth: format === 'mp3' ? 2 : 1,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--accent-primary)' }}
                      >
                        <Music className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                          Stáhnout MP3
                        </h3>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          Čistý zvuk & ID3 cover art
                        </p>
                      </div>
                    </div>

                    <span 
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: 'var(--panel-bg)',
                        borderColor: 'var(--panel-border)',
                        color: 'var(--accent-primary)',
                      }}
                    >
                      {audioQuality} kbps
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--panel-border)] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDownload('mp3')}
                    disabled={isConverting}
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: 'var(--accent-contrast)',
                      borderRadius: 'var(--ui-radius-sm)',
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-bold shadow-md transition-all hover:opacity-95 cursor-pointer disabled:opacity-50"
                  >
                    {isConverting && format === 'mp3' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Převádím ({conversionPercent}%)...</span>
                      </>
                    ) : completedJobId && format === 'mp3' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Uložit znovu {completedFileSize ? `(${formatFileSize(completedFileSize)})` : ''}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Stáhnout MP3 ({audioQuality}k)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Hero Card 2: 🎬 MP4 Video Download */}
              <div 
                className="p-4 border flex flex-col justify-between transition-all duration-200 hover:shadow-md"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: format === 'mp4' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  borderRadius: 'var(--ui-radius-md)',
                  borderWidth: format === 'mp4' ? 2 : 1,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--accent-primary)' }}
                      >
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                          Stáhnout Video (MP4)
                        </h3>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          Obraz i zvuk sloučené do 1 souboru
                        </p>
                      </div>
                    </div>

                    <span 
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: 'var(--panel-bg)',
                        borderColor: 'var(--panel-border)',
                        color: 'var(--accent-primary)',
                      }}
                    >
                      {videoQuality}p
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--panel-border)] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDownload('mp4')}
                    disabled={isWasmMerging}
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: 'var(--accent-contrast)',
                      borderRadius: 'var(--ui-radius-sm)',
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-bold shadow-md transition-all hover:opacity-95 cursor-pointer disabled:opacity-50"
                  >
                    {isWasmMerging ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Slučuji ({wasmPercent}%)...</span>
                      </>
                    ) : wasmMuxCompleted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Sloučeno! Klikněte pro stažení znovu</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Stáhnout Video ({videoQuality}p)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Active Merging Progress Bar (WebAssembly) */}
            {isWasmMerging && (
              <div 
                className="mt-3 p-3.5 border rounded-lg animate-in fade-in"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--accent-primary)',
                }}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    <span>{wasmStage || 'Slučuji audio a video v prohlížeči...'}</span>
                  </span>
                  <span className="font-mono font-bold" style={{ color: 'var(--accent-primary)' }}>
                    {wasmPercent}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--panel-bg)' }}>
                  <div 
                    className="h-full transition-all duration-200 rounded-full"
                    style={{ 
                      backgroundColor: 'var(--accent-primary)',
                      width: `${Math.max(5, wasmPercent)}%` 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Active Server Conversion Progress Bar (.NET) */}
            {isConverting && (
              <div 
                className="mt-3 p-3.5 border rounded-lg animate-in fade-in"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--accent-primary)',
                }}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    <span>{conversionMessage || 'Zpracovávám na serveru...'}</span>
                  </span>
                  <span className="font-mono font-bold" style={{ color: 'var(--accent-primary)' }}>
                    {conversionPercent}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--panel-bg)' }}>
                  <div 
                    className="h-full transition-all duration-200 rounded-full"
                    style={{ 
                      backgroundColor: 'var(--accent-primary)',
                      width: `${Math.max(5, conversionPercent)}%` 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Conversion / Wasm Error Banner with 1-Click Fallbacks */}
            {(conversionError || wasmMuxError) && (
              <div 
                className="mt-3 p-3.5 border rounded-lg text-xs space-y-2.5 animate-in fade-in"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: '#ef4444',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-bold text-red-500">
                      {conversionError ? 'Chyba serverového stahování (YouTube blokuje cloud)' : 'Automatické sloučení v prohlížeči selhalo'}
                    </h4>
                    <p className="mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {conversionError || wasmMuxError}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadBatchScript}
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: 'var(--accent-contrast)',
                          borderRadius: 'var(--ui-radius-sm)',
                        }}
                        className="flex items-center gap-1.5 py-1.5 px-3 font-bold text-xs shadow-xs hover:opacity-90 cursor-pointer"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>1-klik skript (.bat) do Downloads</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsMergerModalOpen(true)}
                        className="flex items-center gap-1.5 py-1.5 px-3 border text-xs font-semibold rounded hover:opacity-90 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--panel-bg)',
                          borderColor: 'var(--panel-border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        <span>Možnost C: Záložní slučovač</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* COLLAPSIBLE ACCORDION FOR ADVANCED SETTINGS & ADDITIONAL OPTIONS */}
            <div 
              className="mt-4 border rounded-xl overflow-hidden transition-all duration-200"
              style={{
                backgroundColor: 'var(--panel-surface)',
                borderColor: 'var(--panel-border)',
              }}
            >
              {/* Accordion Trigger Header */}
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="w-full flex items-center justify-between p-3.5 text-xs font-semibold cursor-pointer transition-colors hover:opacity-90"
                style={{ color: 'var(--text-primary)' }}
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <span>{lang === 'cs' ? 'Pokročilá nastavení a další možnosti stažení' : 'Advanced settings & additional download options'}</span>
                  <span 
                    className="font-mono text-[10px] px-2 py-0.5 rounded border"
                    style={{
                      backgroundColor: 'var(--badge-bg)',
                      borderColor: 'var(--panel-border)',
                      color: 'var(--badge-text)',
                    }}
                  >
                    {audioQuality}k / {videoQuality}p
                  </span>
                </div>

                <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <span>{showAdvancedOptions ? (lang === 'cs' ? 'Zavřít' : 'Close') : (lang === 'cs' ? 'Rozbalit' : 'Expand')}</span>
                  {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {/* Accordion Drawer Content */}
              {showAdvancedOptions && (
                <div className="p-4 border-t border-[var(--panel-border)] space-y-4 animate-in fade-in duration-150">
                  {/* Tab Selector Pills */}
                  <div className="flex flex-wrap gap-1.5 p-1 border rounded-lg" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
                    {[
                      { id: 'quality', label: '🎚️ Kvalita & Formát' },
                      { id: 'method', label: '💻 Metody (.bat, PowerShell, Web)' },
                      { id: 'audio', label: '🔊 Zvuk & Ořez' },
                      { id: 'subtitles', label: '💬 Titulky' },
                      ...(video.chapters && video.chapters.length > 0 ? [{ id: 'chapters', label: `📑 Kapitoly (${video.chapters.length})` }] : []),
                    ].map((tab) => {
                      const isActive = advancedTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setAdvancedTab(tab.id as any)}
                          style={{
                            backgroundColor: isActive ? 'var(--panel-surface)' : 'transparent',
                            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                            borderColor: isActive ? 'var(--panel-border)' : 'transparent',
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer ${isActive ? 'shadow-xs font-bold' : 'hover:opacity-80'}`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab 1: Quality & Format */}
                  {advancedTab === 'quality' && (
                    <div className="space-y-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>
                            Kvalita MP3 zvuku
                          </label>
                          {isCurrentDefault ? (
                            <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1">
                              <BookmarkCheck className="w-3 h-3" />
                              <span>{t.isDefault}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSaveAsDefault}
                              className="text-[10px] font-semibold flex items-center gap-1 hover:opacity-80 cursor-pointer"
                              style={{ color: 'var(--accent-primary)' }}
                            >
                              <Star className="w-3 h-3 fill-current" />
                              <span>{quickSaved ? t.defaultSaved : t.saveAsDefault}</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { value: '320', label: '320 kbps', desc: 'HQ Studio' },
                            { value: '256', label: '256 kbps', desc: 'Vysoká' },
                            { value: '192', label: '192 kbps', desc: 'Standard' },
                            { value: '128', label: '128 kbps', desc: 'Základní' },
                          ].map((q) => {
                            const isSelected = audioQuality === q.value;
                            return (
                              <button
                                key={q.value}
                                type="button"
                                onClick={() => {
                                  setAudioQuality(q.value as AudioQuality);
                                  setCompletedJobId(null);
                                }}
                                style={{
                                  backgroundColor: isSelected ? 'var(--badge-bg)' : 'var(--panel-bg)',
                                  borderColor: isSelected ? 'var(--accent-primary)' : 'var(--panel-border)',
                                  color: isSelected ? 'var(--badge-text)' : 'var(--text-muted)',
                                  borderRadius: 'var(--ui-radius-sm)',
                                  borderWidth: isSelected ? 2 : 1,
                                }}
                                className="p-2 text-center border transition-all cursor-pointer hover:opacity-90"
                              >
                                <div className="font-mono font-bold text-xs">{q.label}</div>
                                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{q.desc}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[var(--panel-border)]">
                        <label className="block text-xs font-bold uppercase tracking-wider font-mono mb-2" style={{ color: 'var(--text-muted)' }}>
                          Rozlišení videa (MP4)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { value: '1080', label: '1080p', desc: 'Full HD' },
                            { value: '720', label: '720p', desc: 'HD kvalita' },
                            { value: '480', label: '480p', desc: 'SD video' },
                            { value: '360', label: '360p', desc: 'Nízká' },
                          ].map((q) => {
                            const isAvailable = !video.availableQualities || video.availableQualities.includes(q.value as VideoQuality);
                            const isSelected = videoQuality === q.value;
                            return (
                              <button
                                key={q.value}
                                type="button"
                                disabled={!isAvailable}
                                onClick={() => {
                                  if (!isAvailable) return;
                                  setVideoQuality(q.value as VideoQuality);
                                  setCompletedJobId(null);
                                }}
                                style={{
                                  backgroundColor: isSelected 
                                    ? 'var(--badge-bg)' 
                                    : !isAvailable 
                                      ? 'rgba(0,0,0,0.1)' 
                                      : 'var(--panel-bg)',
                                  borderColor: isSelected 
                                    ? 'var(--accent-primary)' 
                                    : 'var(--panel-border)',
                                  color: isSelected 
                                    ? 'var(--badge-text)' 
                                    : 'var(--text-muted)',
                                  borderRadius: 'var(--ui-radius-sm)',
                                  borderWidth: isSelected ? 2 : 1,
                                }}
                                className={`p-2 text-center border transition-all ${
                                  !isAvailable ? 'line-through opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'
                                }`}
                              >
                                <div className="font-mono font-bold text-xs">{q.label}</div>
                                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  {!isAvailable ? 'Nedostupné' : q.desc}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Download Methods */}
                  {advancedTab === 'method' && (
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            <FileCode className="w-3.5 h-3.5 text-blue-400" />
                            <span>1-klik Windows dávkový skript (.bat)</span>
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Stáhne soubor přímo do vaší složky Downloads. Obchází veškeré blokování ze strany YouTube na cloudu.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadBatchScript}
                          style={{
                            backgroundColor: 'var(--accent-primary)',
                            color: 'var(--accent-contrast)',
                            borderRadius: 'var(--ui-radius-sm)',
                          }}
                          className="shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold hover:opacity-90 cursor-pointer shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Stáhnout .bat skript</span>
                        </button>
                      </div>

                      <div className="p-3 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            <Terminal className="w-3.5 h-3.5 text-purple-400" />
                            <span>PowerShell příkaz do schránky</span>
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Zkopírujte příkaz a vložte jej přímo do PowerShellu ve Windows (Win + X).
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyPowerShell}
                          style={{
                            backgroundColor: 'var(--badge-bg)',
                            borderColor: 'var(--panel-border)',
                            color: 'var(--badge-text)',
                            borderRadius: 'var(--ui-radius-sm)',
                          }}
                          className="shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 border text-xs font-mono hover:opacity-90 cursor-pointer"
                        >
                          {copiedPowerShell ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedPowerShell ? 'Zkopírováno!' : 'Kopírovat'}</span>
                        </button>
                      </div>

                      <div className="p-3 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            <Layers className="w-3.5 h-3.5 text-amber-400" />
                            <span>Možnost C: Záložní slučovač (Drag & Drop)</span>
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Pokud automatické sloučení selže kvůli nedostatku RAM, sloučí video přímo v samostatném okně.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMergerModalOpen(true)}
                          className="shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 border text-xs font-semibold rounded hover:opacity-90 cursor-pointer"
                          style={{
                            backgroundColor: 'var(--panel-surface)',
                            borderColor: 'var(--panel-border)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <Layers className="w-3.5 h-3.5 text-amber-400" />
                          <span>Otevřít slučovač</span>
                        </button>
                      </div>

                      <div className="p-3 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            <Globe className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Webový stahovač (10Downloader Gateway)</span>
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Přímá externí webová brána bez instalace jakýchkoliv aplikací.
                          </p>
                        </div>
                        <a
                          href={getWebDownloadGatewayUrl('10downloader', video.id, format, currentQuality)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 border text-xs font-semibold rounded hover:opacity-90 cursor-pointer"
                          style={{
                            backgroundColor: 'var(--panel-surface)',
                            borderColor: 'var(--panel-border)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Otevřít v novém okně</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Audio Boost & Trim */}
                  {advancedTab === 'audio' && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                          <Volume2 className="w-4 h-4 text-amber-400" />
                          <span>Zesílení hlasitosti a normalizace audia</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { value: 'none', label: t.audioBoostNone, desc: 'Bez úprav' },
                            { value: 'boost3', label: t.audioBoost3, desc: 'Jemné (+40 %)' },
                            { value: 'boost6', label: t.audioBoost6, desc: 'Tiché audio (2×)' },
                            { value: 'normalize', label: t.audioBoostNorm, desc: 'Vyvážená úroveň' },
                          ].map((b) => {
                            const isSelected = audioBoost === b.value;
                            return (
                              <button
                                key={b.value}
                                type="button"
                                onClick={() => setAudioBoost(b.value as AudioBoostOption)}
                                style={{
                                  backgroundColor: isSelected ? 'var(--badge-bg)' : 'var(--panel-bg)',
                                  borderColor: isSelected ? 'var(--accent-primary)' : 'var(--panel-border)',
                                  color: isSelected ? 'var(--badge-text)' : 'var(--text-muted)',
                                  borderRadius: 'var(--ui-radius-sm)',
                                  borderWidth: isSelected ? 2 : 1,
                                }}
                                className="p-2 text-center border transition-all cursor-pointer hover:opacity-90"
                              >
                                <div className="font-mono font-bold text-xs">{b.label}</div>
                                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{b.desc}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[var(--panel-border)]">
                        <div className="flex items-center gap-1.5 text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                          <Scissors className="w-4 h-4 text-rose-400" />
                          <span>Časový ořez (Trim)</span>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 p-3 border rounded-lg" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Od:</span>
                            <input
                              type="text"
                              placeholder="00:30"
                              value={trimStart}
                              onChange={(e) => setTrimStart(e.target.value)}
                              className="border rounded px-2 py-1 text-xs font-mono w-24 focus:outline-none"
                              style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Do:</span>
                            <input
                              type="text"
                              placeholder="02:15"
                              value={trimEnd}
                              onChange={(e) => setTrimEnd(e.target.value)}
                              className="border rounded px-2 py-1 text-xs font-mono w-24 focus:outline-none"
                              style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
                            />
                          </div>
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Formát MM:SS nebo HH:MM:SS. Prázdné pole = celé video.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 4: Subtitles */}
                  {advancedTab === 'subtitles' && (
                    <div className="space-y-3">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t.subtitlesDesc}
                      </p>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs shrink-0 font-mono" style={{ color: 'var(--text-muted)' }}>Jazyk:</span>
                          {video.subtitles && video.subtitles.length > 0 ? (
                            <select
                              value={selectedSubLang}
                              onChange={(e) => setSelectedSubLang(e.target.value)}
                              className="border rounded px-2.5 py-1.5 text-xs flex-1 min-w-0"
                              style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
                            >
                              {video.subtitles.map((track, i) => (
                                <option key={i} value={track.code}>
                                  {track.name} ({track.code}){track.isAutoGenerated ? ' [Auto]' : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                placeholder="cs, en, sk..."
                                value={selectedSubLang}
                                onChange={(e) => setSelectedSubLang(e.target.value)}
                                className="border rounded px-2 py-1 text-xs font-mono w-24 focus:outline-none"
                                style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
                              />
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>(kód jazyka)</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Formát:</span>
                          <div className="inline-flex rounded border p-0.5" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedSubFormat('srt')}
                              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                                selectedSubFormat === 'srt' ? 'font-bold' : 'opacity-60'
                              }`}
                              style={{
                                backgroundColor: selectedSubFormat === 'srt' ? 'var(--accent-primary)' : 'transparent',
                                color: selectedSubFormat === 'srt' ? 'var(--accent-contrast)' : 'var(--text-primary)',
                              }}
                            >
                              .SRT
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedSubFormat('vtt')}
                              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                                selectedSubFormat === 'vtt' ? 'font-bold' : 'opacity-60'
                              }`}
                              style={{
                                backgroundColor: selectedSubFormat === 'vtt' ? 'var(--accent-primary)' : 'transparent',
                                color: selectedSubFormat === 'vtt' ? 'var(--accent-contrast)' : 'var(--text-primary)',
                              }}
                            >
                              .VTT
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--panel-border)]">
                        <button
                          type="button"
                          onClick={handleDownloadSubtitles}
                          disabled={isDownloadingSub}
                          style={{
                            backgroundColor: 'var(--accent-primary)',
                            color: 'var(--accent-contrast)',
                            borderRadius: 'var(--ui-radius-sm)',
                          }}
                          className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer disabled:opacity-50"
                        >
                          {isDownloadingSub ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          <span>{t.subtitlesDownloadDirect}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadSubtitlesBatch}
                          className="px-2.5 py-1.5 text-xs rounded border flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                          style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>.bat skript</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopySubtitlesPowerShell}
                          className="px-2.5 py-1.5 text-xs rounded border flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                          style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
                        >
                          {copiedSubPs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedSubPs ? 'Zkopírováno' : 'PowerShell'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tab 5: Chapters */}
                  {advancedTab === 'chapters' && video.chapters && video.chapters.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {t.chaptersDesc}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleDownloadAllChapters}
                            style={{
                              backgroundColor: 'var(--accent-primary)',
                              color: 'var(--accent-contrast)',
                              borderRadius: 'var(--ui-radius-sm)',
                            }}
                            className="px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 hover:opacity-90 cursor-pointer shadow-xs"
                          >
                            <Download className="w-3 h-3" />
                            <span>{t.chaptersDownloadAll}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCopySplitChaptersPowerShell}
                            className="px-2 py-1 text-xs rounded border flex items-center gap-1 hover:opacity-90 cursor-pointer"
                            style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
                          >
                            {copiedChapterPs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>PowerShell</span>
                          </button>
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[var(--panel-border)]">
                        {video.chapters.map((chapter, idx) => (
                          <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-3 text-xs p-1.5 rounded transition-colors hover:bg-[var(--panel-bg)]">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0 w-5 h-5 rounded border font-mono text-[10px] flex items-center justify-center font-bold" style={{ backgroundColor: 'var(--badge-bg)', borderColor: 'var(--panel-border)', color: 'var(--badge-text)' }}>
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <span className="shrink-0 font-mono text-[11px] px-1.5 py-0.5 rounded border" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--accent-primary)' }}>
                                {chapter.startTime} - {chapter.endTime}
                              </span>
                              <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }} title={chapter.title}>
                                {chapter.title}
                              </span>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApplyChapterToTrim(chapter)}
                                className="px-2 py-0.5 text-[10px] rounded border flex items-center gap-1 hover:opacity-80 cursor-pointer"
                                style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
                              >
                                <Scissors className="w-2.5 h-2.5" />
                                <span>{t.chaptersTrimBtn}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadSingleChapter(chapter, idx)}
                                className="px-2 py-0.5 text-[10px] rounded border flex items-center gap-1 font-semibold hover:opacity-90 cursor-pointer"
                                style={{ backgroundColor: 'var(--badge-bg)', borderColor: 'var(--panel-border)', color: 'var(--badge-text)' }}
                              >
                                <Download className="w-2.5 h-2.5" />
                                <span>{t.chaptersDownloadTrack}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Backup Option C: Audio/Video Merger Modal */}
      <AudioVideoMergerModal
        isOpen={isMergerModalOpen}
        onClose={() => setIsMergerModalOpen(false)}
        videoInfo={video}
        videoQuality={videoQuality}
        lang={lang}
        onRecordDownload={onRecordDownload}
      />

      {/* Add To Bookmark Modal */}
      <AddToBookmarkModal
        isOpen={isBookmarkModalOpen}
        onClose={() => setIsBookmarkModalOpen(false)}
        video={video}
        lang={lang}
      />
    </div>
  );
};

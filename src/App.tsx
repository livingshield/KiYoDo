/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Header 
} from './components/Header';
import { 
  UrlInputBar 
} from './components/UrlInputBar';
import { 
  VideoPreviewCard 
} from './components/VideoPreviewCard';
import { 
  YouTubeSearch 
} from './components/YouTubeSearch';
import { 
  BatchDownloader 
} from './components/BatchDownloader';
import { 
  DownloadHistory 
} from './components/DownloadHistory';
import { 
  DesktopHelperSection 
} from './components/DesktopHelperSection';
import { 
  Footer 
} from './components/Footer';
import { 
  SettingsModal 
} from './components/SettingsModal';
import { 
  PlaylistView 
} from './components/PlaylistView';
import { 
  VideoInfo, 
  PlaylistInfo,
  DownloadFormat, 
  DownloadHistoryItem,
  WatchHistoryItem,
  VideoSearchResult,
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
  ThemeId
} from './types';
import { 
  Language, 
  translations 
} from './utils/translations';
import { 
  fetchVideoDetails, 
  extractYouTubeId,
  extractYouTubePlaylistId,
  isYouTubePlaylistUrl,
  hasPlaylistReference,
  fetchPlaylistDetails,
  isSupportedMediaUrl
} from './utils/youtube';
import { 
  getInitialTheme, 
  applyTheme 
} from './utils/theme';
import { 
  AlertCircle, 
  ArrowRight,
  ArrowLeft,
  HardDrive,
  Settings,
  Search,
  Layers,
  ListMusic,
  Link2,
  Copy,
  ChevronDown,
  History,
  FileText,
  Sliders,
  Sparkles,
  X,
  FileCode,
  Bookmark
} from 'lucide-react';
import { AudioVideoMergerModal } from './components/AudioVideoMergerModal';
import { BookmarksView } from './components/BookmarksView';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './contexts/AuthContext';
import { InstallModal } from './components/InstallModal';
import { InstallBanner } from './components/InstallBanner';
import { UpdateNotificationBanner } from './components/UpdateNotificationBanner';
import { checkRemoteVersion, isAppRunningStandalone } from './utils/versionCheck';
import { APP_VERSION } from './version';

const LOCAL_STORAGE_HISTORY_KEY = 'yt_downloader_pc_history';
const LOCAL_STORAGE_WATCH_HISTORY_KEY = 'kiyodo_watch_history';
const LOCAL_STORAGE_LANG_KEY = 'yt_downloader_pc_lang';
const LOCAL_STORAGE_PREFS_KEY = 'yt_downloader_user_preferences';

export interface VideoStackItem {
  videoId: string;
  url: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  duration?: string;
}

const DEFAULT_INITIAL_URL = 'https://www.youtube.com/watch?v=EBXq5N7wGgA&list=RDEBXq5N7wGgA&start_radio=1';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_LANG_KEY);
    return saved === 'en' ? 'en' : 'cs';
  });

  const [theme, setTheme] = useState<ThemeId>(getInitialTheme);

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_PREFS_KEY);
      if (saved) return { ...DEFAULT_USER_PREFERENCES, ...JSON.parse(saved) };
    } catch {
      // fallback
    }
    return DEFAULT_USER_PREFERENCES;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);

  const { isAuthModalOpen, closeAuthModal, authModalTab } = useAuth();
  const [activeTab, setActiveTab] = useState<'search' | 'single' | 'playlist' | 'batch' | 'merger' | 'guide' | 'history' | 'bookmarks'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [playlistPrompt, setPlaylistPrompt] = useState<{ url: string; listId: string } | null>(null);
  const [batchInitialUrls, setBatchInitialUrls] = useState<string[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<DownloadHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_WATCH_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Navigation history stack for watched videos
  const [videoStack, setVideoStack] = useState<VideoStackItem[]>([]);
  const [stackIndex, setStackIndex] = useState<number>(-1);
  const isNavigatingRef = useRef(false);

  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const t = translations[lang];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Synchronize theme with root HTML element data-theme and storage
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Synchronize background style with root HTML element data-bg and storage
  useEffect(() => {
    const bg = preferences.backgroundStyle || 'artwork';
    document.documentElement.setAttribute('data-bg', bg);
    try {
      localStorage.setItem('kiyodo_bg_style', bg);
    } catch {
      // Storage quota or disabled
    }
  }, [preferences.backgroundStyle]);

  const handleSelectTheme = (newTheme: ThemeId) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Storage quota or disabled
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_WATCH_HISTORY_KEY, JSON.stringify(watchHistory));
    } catch {
      // Storage quota or disabled
    }
  }, [watchHistory]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'cs' ? 'en' : 'cs'));
  };

  const handleAnalyze = async (inputUrl: string) => {
    if (!inputUrl.trim()) return;

    const trimmed = inputUrl.trim();
    const isUrlOrId = 
      trimmed.includes('youtube.com') || 
      trimmed.includes('youtu.be') || 
      trimmed.startsWith('http://') || 
      trimmed.startsWith('https://') || 
      /^[a-zA-Z0-9_-]{11}$/.test(trimmed);

    // If user entered a search keyword (e.g. "karel gott" or "relaxacni hudba")
    if (!isUrlOrId) {
      setSearchQuery(trimmed);
      setActiveTab('search');
      return;
    }

    // Check if input is a dedicated playlist URL
    if (isYouTubePlaylistUrl(trimmed)) {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const pInfo = await fetchPlaylistDetails(trimmed);
        setPlaylistInfo(pInfo);
        setActiveTab('playlist');
        setPlaylistPrompt(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Nepodařilo se načíst playlist.';
        setErrorMessage(message);
        setPlaylistInfo(null);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Check if input is a video URL that also contains a playlist reference (list=)
    if (hasPlaylistReference(trimmed)) {
      const pId = extractYouTubePlaylistId(trimmed);
      if (pId) {
        setPlaylistPrompt({ url: trimmed, listId: pId });
      }
    } else {
      setPlaylistPrompt(null);
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const info = await fetchVideoDetails(trimmed);
      setVideoInfo(info);
      recordWatchHistory(info);
      pushToVideoStack(info);
      setActiveTab('single');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nepodařilo se načíst video.';
      setErrorMessage(message);
      setVideoInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const recordWatchHistory = (info: VideoInfo | VideoSearchResult | { id: string; url?: string; title: string; author: string; thumbnailUrl: string; duration?: string; platform?: any }) => {
    const videoId = info.id;
    const targetUrl = 'url' in info && info.url ? info.url : `https://www.youtube.com/watch?v=${videoId}`;
    const newItem: WatchHistoryItem = {
      id: `${videoId}_${Date.now()}`,
      videoId,
      url: targetUrl,
      title: info.title,
      author: info.author,
      thumbnailUrl: info.thumbnailUrl,
      duration: info.duration,
      timestamp: Date.now(),
      platform: 'platform' in info ? info.platform : 'youtube',
    };
    setWatchHistory((prev) => {
      const filtered = prev.filter((item) => item.videoId !== videoId);
      return [newItem, ...filtered.slice(0, 99)];
    });
  };

  const pushToVideoStack = (info: VideoInfo) => {
    if (isNavigatingRef.current) return;
    setVideoStack((prev) => {
      const base = stackIndex >= 0 ? prev.slice(0, stackIndex + 1) : [];
      if (base.length > 0 && base[base.length - 1].videoId === info.id) return base;
      const next = [
        ...base,
        {
          videoId: info.id,
          url: info.url,
          title: info.title,
          author: info.author,
          thumbnailUrl: info.thumbnailUrl,
          duration: info.duration,
        }
      ];
      setStackIndex(next.length - 1);
      return next;
    });
  };

  const effectivePreviousVideo = useMemo(() => {
    if (stackIndex > 0 && videoStack[stackIndex - 1]) {
      return videoStack[stackIndex - 1];
    }
    const prevWatch = watchHistory.find((item) => item.videoId !== videoInfo?.id);
    if (prevWatch) {
      return {
        videoId: prevWatch.videoId,
        url: prevWatch.url,
        title: prevWatch.title,
        author: prevWatch.author,
        thumbnailUrl: prevWatch.thumbnailUrl,
        duration: prevWatch.duration,
      };
    }
    return null;
  }, [stackIndex, videoStack, watchHistory, videoInfo?.id]);

  const effectiveNextVideo = useMemo(() => {
    if (stackIndex >= 0 && stackIndex < videoStack.length - 1 && videoStack[stackIndex + 1]) {
      return videoStack[stackIndex + 1];
    }
    return null;
  }, [stackIndex, videoStack]);

  const recentWatchedVideos = useMemo(() => {
    return watchHistory.filter((item) => item.videoId !== videoInfo?.id).slice(0, 8);
  }, [watchHistory, videoInfo?.id]);

  const handleSelectVideo = async (targetUrl: string, preferredFormat?: DownloadFormat) => {
    setUrl(targetUrl);
    if (preferredFormat && preferredFormat !== preferences.defaultFormat) {
      setPreferences((prev) => ({ ...prev, defaultFormat: preferredFormat }));
    }
    setActiveTab('single');
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const info = await fetchVideoDetails(targetUrl);
      setVideoInfo(info);
      recordWatchHistory(info);
      pushToVideoStack(info);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nepodařilo se načíst video.';
      setErrorMessage(message);
      setVideoInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToPreviousVideo = async () => {
    if (stackIndex > 0) {
      const target = videoStack[stackIndex - 1];
      setStackIndex(stackIndex - 1);
      isNavigatingRef.current = true;
      setUrl(target.url);
      setActiveTab('single');
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const info = await fetchVideoDetails(target.url);
        setVideoInfo(info);
        recordWatchHistory(info);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Nepodařilo se načíst video.');
      } finally {
        setIsLoading(false);
        isNavigatingRef.current = false;
      }
    } else if (effectivePreviousVideo) {
      handleSelectVideo(effectivePreviousVideo.url);
    }
  };

  const handleForwardVideo = async () => {
    if (stackIndex >= 0 && stackIndex < videoStack.length - 1) {
      const target = videoStack[stackIndex + 1];
      setStackIndex(stackIndex + 1);
      isNavigatingRef.current = true;
      setUrl(target.url);
      setActiveTab('single');
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const info = await fetchVideoDetails(target.url);
        setVideoInfo(info);
        recordWatchHistory(info);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Nepodařilo se načíst video.');
      } finally {
        setIsLoading(false);
        isNavigatingRef.current = false;
      }
    }
  };

  const handleClearWatchHistory = () => {
    setWatchHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_WATCH_HISTORY_KEY);
  };

  const handleRemoveWatchItem = (id: string) => {
    setWatchHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRemoveDownloadItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleLoadPlaylist = async (playlistUrlOrId: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const pInfo = await fetchPlaylistDetails(playlistUrlOrId);
      setPlaylistInfo(pInfo);
      setActiveTab('playlist');
      setPlaylistPrompt(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nepodařilo se načíst playlist.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFromPlaylist = async (videoUrl: string) => {
    setUrl(videoUrl);
    setActiveTab('single');
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const info = await fetchVideoDetails(videoUrl);
      setVideoInfo(info);
      recordWatchHistory(info);
      pushToVideoStack(info);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nepodařilo se načíst video.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferToBatch = (videoUrls: string[]) => {
    setBatchInitialUrls(videoUrls);
    setActiveTab('batch');
  };

  const handleSelectFromSearch = async (videoUrl: string, preferredFormat?: DownloadFormat) => {
    setUrl(videoUrl);
    if (preferredFormat && preferredFormat !== preferences.defaultFormat) {
      setPreferences((prev) => ({ ...prev, defaultFormat: preferredFormat }));
    }
    setActiveTab('single');
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const info = await fetchVideoDetails(videoUrl);
      setVideoInfo(info);
      recordWatchHistory(info);
      pushToVideoStack(info);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nepodařilo se načíst video.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordDownload = (
    video: VideoInfo, 
    format: DownloadFormat, 
    quality: string,
    engineName: string
  ) => {
    const newItem: DownloadHistoryItem = {
      id: `${video.id}_${Date.now()}`,
      videoId: video.id,
      title: video.title,
      author: video.author,
      thumbnailUrl: video.thumbnailUrl,
      format,
      quality,
      timestamp: Date.now(),
      engineName,
    };

    // Detect new version deployed on server upon each download
    checkRemoteVersion().then((result) => {
      if (result.hasUpdate) {
        setNewVersionInfo({ current: result.currentVersion, latest: result.latestVersion });
      }
    });

    setHistory((prev) => [newItem, ...prev.slice(0, 49)]); // keep last 50
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
  };

  const handleSavePreferences = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    try {
      localStorage.setItem(LOCAL_STORAGE_PREFS_KEY, JSON.stringify(newPrefs));
    } catch {
      // Storage quota or disabled
    }
  };

  // PWA & Standalone state
  const [isStandalone, setIsStandalone] = useState(false);
  const [newVersionInfo, setNewVersionInfo] = useState<{ current: string; latest: string } | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  useEffect(() => {
    setIsStandalone(isAppRunningStandalone());

    // Listen for any download trigger across the app to check for updates
    const handleDownloadEvent = () => {
      checkRemoteVersion().then((result) => {
        if (result.hasUpdate) {
          setNewVersionInfo({ current: result.currentVersion, latest: result.latestVersion });
        }
      });
    };

    window.addEventListener('app:download-triggered', handleDownloadEvent);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('app:download-triggered', handleDownloadEvent);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          setCanInstall(false);
          setDeferredInstallPrompt(null);
          return;
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
    // Fallback or iOS/other browsers: open clear guide modal
    setIsInstallModalOpen(true);
  };

  // Pre-load the requested default video on first mount or handle Web Share Target
  useEffect(() => {
    // Check if opened via Web Share Target (e.g. ?url=... or ?text=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const sharedUrl = params.get('url');
      const sharedText = params.get('text');
      let target = sharedUrl;
      if (!target && sharedText) {
        const match = sharedText.match(/(https?:\/\/[^\s]+)/i);
        target = match ? match[1] : sharedText;
      }

      if (target && isSupportedMediaUrl(target)) {
        setUrl(target);
        handleAnalyze(target);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    } catch {
      // ignore
    }

    if (!videoInfo && !url) {
      setUrl(DEFAULT_INITIAL_URL);
      // Load initial sample in background for immediate visual impact
      fetchVideoDetails(DEFAULT_INITIAL_URL)
        .then((info) => {
          setVideoInfo(info);
          pushToVideoStack(info);
        })
        .catch(() => {
          // Silent fallback
        });
    }
  }, []);

  return (
    <div 
      className="min-h-screen flex flex-col transition-colors duration-200"
      style={{
        backgroundColor: 'var(--app-bg)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Top Header */}
      <Header
        lang={lang}
        onToggleLang={toggleLanguage}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        theme={theme}
        onSelectTheme={handleSelectTheme}
        canInstall={canInstall}
        onInstallApp={handleInstallApp}
        isStandalone={isStandalone}
      />

      {/* New Version Update Notification Banner */}
      {newVersionInfo && (
        <UpdateNotificationBanner
          currentVersion={newVersionInfo.current}
          latestVersion={newVersionInfo.latest}
          onDismiss={() => setNewVersionInfo(null)}
          lang={lang}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 pt-4 sm:pt-8 pb-28 sm:pb-12">
        {/* Desktop View Switcher Tabs (Segmented Control) */}
        <div className="hidden sm:flex justify-center mb-6 sm:mb-8">
          <div 
            className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 border max-w-full shadow-xs"
            style={{
              backgroundColor: 'var(--panel-bg)',
              borderColor: 'var(--panel-border)',
              borderRadius: 'var(--ui-radius-lg)',
            }}
          >
            {/* 1. Hledat na YouTube (Primary) */}
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              style={{
                backgroundColor: activeTab === 'search' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'search' ? 'var(--accent-contrast)' : 'var(--text-muted)',
                borderRadius: 'var(--ui-radius-md)',
              }}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer hover:opacity-95"
            >
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{t.navSearch}</span>
            </button>

            {/* 2. Vložit odkaz (URL) */}
            <button
              type="button"
              onClick={() => setActiveTab('single')}
              style={{
                backgroundColor: activeTab === 'single' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'single' ? 'var(--accent-contrast)' : 'var(--text-muted)',
                borderRadius: 'var(--ui-radius-md)',
              }}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer hover:opacity-95"
            >
              <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{t.navDownloader}</span>
            </button>

            {/* 3. Playlisty */}
            <button
              type="button"
              onClick={() => setActiveTab('playlist')}
              style={{
                backgroundColor: activeTab === 'playlist' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'playlist' ? 'var(--accent-contrast)' : 'var(--text-muted)',
                borderRadius: 'var(--ui-radius-md)',
              }}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer hover:opacity-95"
            >
              <ListMusic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{t.navPlaylist}</span>
              {playlistInfo && (
                <span 
                  className="ml-0.5 sm:ml-1 px-1.5 py-0.2 text-[10px] font-mono rounded font-bold"
                  style={{
                    backgroundColor: activeTab === 'playlist' ? 'rgba(0,0,0,0.2)' : 'var(--badge-bg)',
                    color: activeTab === 'playlist' ? 'inherit' : 'var(--badge-text)',
                  }}
                >
                  {playlistInfo.videoCount}
                </span>
              )}
            </button>

            {/* 4. Dávkové */}
            <button
              type="button"
              onClick={() => setActiveTab('batch')}
              style={{
                backgroundColor: activeTab === 'batch' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'batch' ? 'var(--accent-contrast)' : 'var(--text-muted)',
                borderRadius: 'var(--ui-radius-md)',
              }}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer hover:opacity-95"
            >
              <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{t.navBatch}</span>
            </button>

            {/* 5. Záložky */}
            <button
              type="button"
              onClick={() => setActiveTab('bookmarks')}
              style={{
                backgroundColor: activeTab === 'bookmarks' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'bookmarks' ? 'var(--accent-contrast)' : 'var(--text-muted)',
                borderRadius: 'var(--ui-radius-md)',
              }}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer hover:opacity-95"
            >
              <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{t.navBookmarks || (lang === 'cs' ? 'Záložky' : 'Bookmarks')}</span>
            </button>

            {/* 6. Nástroje ▾ Dropdown (Merger, Historie, Návod, Výchozí kvalita) */}
            <div className="relative" ref={toolsMenuRef}>
              <button
                type="button"
                onClick={() => setIsToolsMenuOpen((prev) => !prev)}
                style={{
                  backgroundColor: (activeTab === 'merger' || activeTab === 'guide' || activeTab === 'history') ? 'var(--panel-surface)' : 'transparent',
                  color: (activeTab === 'merger' || activeTab === 'guide' || activeTab === 'history') ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderColor: (activeTab === 'merger' || activeTab === 'guide' || activeTab === 'history') ? 'var(--panel-border)' : 'transparent',
                  borderRadius: 'var(--ui-radius-md)',
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer hover:opacity-95 border"
              >
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{t.navTools || (lang === 'cs' ? 'Nástroje' : 'Tools')}</span>
                {history.length > 0 && (
                  <span 
                    className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                    title={`${history.length} položek v historii`}
                  />
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isToolsMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Tools Dropdown Menu */}
              {isToolsMenuOpen && (
                <div 
                  className="absolute right-0 mt-2 w-64 p-1.5 shadow-2xl border z-50 transition-all animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    backgroundColor: 'var(--panel-bg)',
                    borderColor: 'var(--panel-border)',
                    borderRadius: 'var(--ui-radius-md)',
                  }}
                >
                  <div className="px-3 py-1.5 border-b text-[10px] font-semibold uppercase tracking-wider" style={{ borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}>
                    {t.navTools || (lang === 'cs' ? 'Doplňkové nástroje' : 'Extra Tools')}
                  </div>
                  <div className="py-1 space-y-0.5">
                    {/* Záložky */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('bookmarks');
                        setIsToolsMenuOpen(false);
                      }}
                      style={{
                        backgroundColor: activeTab === 'bookmarks' ? 'var(--panel-surface)' : 'transparent',
                        color: activeTab === 'bookmarks' ? 'var(--accent-primary)' : 'var(--text-primary)',
                        borderRadius: 'var(--ui-radius-sm)',
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-amber-400" />
                        <span>{t.navBookmarks || (lang === 'cs' ? 'Záložky' : 'Bookmarks')}</span>
                      </div>
                    </button>

                    {/* Sloučit A/V */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('merger');
                        setIsToolsMenuOpen(false);
                      }}
                      style={{
                        backgroundColor: activeTab === 'merger' ? 'var(--panel-surface)' : 'transparent',
                        color: activeTab === 'merger' ? 'var(--accent-primary)' : 'var(--text-primary)',
                        borderRadius: 'var(--ui-radius-sm)',
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-sky-400" />
                        <span>{t.navMerger}</span>
                      </div>
                    </button>

                    {/* Historie */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('history');
                        setIsToolsMenuOpen(false);
                      }}
                      style={{
                        backgroundColor: activeTab === 'history' ? 'var(--panel-surface)' : 'transparent',
                        color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-primary)',
                        borderRadius: 'var(--ui-radius-sm)',
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-amber-400" />
                        <span>{t.navHistory}</span>
                      </div>
                      {(watchHistory.length + history.length) > 0 && (
                        <span 
                          className="px-1.5 py-0.2 text-[10px] font-mono rounded font-bold border"
                          style={{
                            backgroundColor: 'var(--badge-bg)',
                            color: 'var(--badge-text)',
                            borderColor: 'var(--panel-border)',
                          }}
                        >
                          {watchHistory.length + history.length}
                        </span>
                      )}
                    </button>

                    {/* Návod */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('guide');
                        setIsToolsMenuOpen(false);
                      }}
                      style={{
                        backgroundColor: activeTab === 'guide' ? 'var(--panel-surface)' : 'transparent',
                        color: activeTab === 'guide' ? 'var(--accent-primary)' : 'var(--text-primary)',
                        borderRadius: 'var(--ui-radius-sm)',
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span>{t.navPcGuide}</span>
                      </div>
                    </button>

                    {/* Quick Quality Settings */}
                    <div className="pt-1 mt-1 border-t" style={{ borderColor: 'var(--panel-border)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSettingsOpen(true);
                          setIsToolsMenuOpen(false);
                        }}
                        style={{
                          borderRadius: 'var(--ui-radius-sm)',
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-xs text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-purple-400" />
                          <span>{lang === 'cs' ? 'Výchozí kvalita...' : 'Default quality...'}</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-80 uppercase">
                          {preferences.defaultFormat} ({preferences.defaultFormat === 'mp3' ? `${preferences.defaultAudioQuality}k` : `${preferences.defaultVideoQuality}p`})
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Scrollable Pill Row (Top Quick Bar) */}
        <div 
          className="sm:hidden flex items-center gap-1.5 overflow-x-auto scrollbar-none p-1 border rounded-xl mb-4 max-w-full shadow-xs"
          style={{
            backgroundColor: 'var(--panel-bg)',
            borderColor: 'var(--panel-border)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            style={{
              backgroundColor: activeTab === 'search' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'search' ? 'var(--accent-contrast)' : 'var(--text-muted)',
              borderRadius: 'var(--ui-radius-sm)',
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{t.navSearch}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('single')}
            style={{
              backgroundColor: activeTab === 'single' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'single' ? 'var(--accent-contrast)' : 'var(--text-muted)',
              borderRadius: 'var(--ui-radius-sm)',
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>{lang === 'cs' ? 'Odkaz' : 'Link'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('playlist')}
            style={{
              backgroundColor: activeTab === 'playlist' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'playlist' ? 'var(--accent-contrast)' : 'var(--text-muted)',
              borderRadius: 'var(--ui-radius-sm)',
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>{t.navPlaylist}</span>
            {playlistInfo && (
              <span className="px-1 py-0.1 text-[9px] font-mono rounded font-bold bg-white/20">
                {playlistInfo.videoCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            style={{
              backgroundColor: activeTab === 'batch' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'batch' ? 'var(--accent-contrast)' : 'var(--text-muted)',
              borderRadius: 'var(--ui-radius-sm)',
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{t.navBatch}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bookmarks')}
            style={{
              backgroundColor: activeTab === 'bookmarks' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'bookmarks' ? 'var(--accent-contrast)' : 'var(--text-muted)',
              borderRadius: 'var(--ui-radius-sm)',
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{t.navBookmarks || (lang === 'cs' ? 'Záložky' : 'Bookmarks')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileToolsOpen(true)}
            style={{
              backgroundColor: (activeTab === 'merger' || activeTab === 'guide' || activeTab === 'history' || activeTab === 'bookmarks') ? 'var(--panel-surface)' : 'transparent',
              color: (activeTab === 'merger' || activeTab === 'guide' || activeTab === 'history' || activeTab === 'bookmarks') ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderColor: (activeTab === 'merger' || activeTab === 'guide' || activeTab === 'history') ? 'var(--panel-border)' : 'transparent',
              borderRadius: 'var(--ui-radius-sm)',
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 border cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.navTools || (lang === 'cs' ? 'Nástroje' : 'Tools')}</span>
            {(watchHistory.length + history.length) > 0 && (
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent-primary)' }} />
            )}
          </button>
        </div>

        {/* Tab 1: Single URL Downloader */}
        {activeTab === 'single' && (
          <div className="space-y-8">
            {/* Input Bar */}
            <UrlInputBar
              url={url}
              onChangeUrl={setUrl}
              onSubmit={handleAnalyze}
              isLoading={isLoading}
              lang={lang}
            />

            {/* Error Notification */}
            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">Chyba při načítání videa</h4>
                  <p className="mt-0.5 text-xs text-red-700 dark:text-red-200/90 leading-relaxed">
                    {errorMessage}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Tip: Zkuste zkontrolovat, zda odkaz obsahuje platné YouTube ID (např. <code>https://www.youtube.com/watch?v=...</code>).
                  </p>
                </div>
              </div>
            )}

            {/* Playlist Prompt Banner if URL contains list= */}
            {playlistPrompt && (
              <div 
                className="p-3.5 rounded-xl border flex items-center justify-between gap-3 shadow-xs transition-all animate-fade-in"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--panel-border)',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <ListMusic className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-xs sm:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {lang === 'cs'
                      ? 'Toto video je součástí YouTube playlistu / alba.'
                      : 'This video is part of a YouTube playlist / album.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleLoadPlaylist(playlistPrompt.url)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 hover:opacity-90 shadow-xs"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  <span>{lang === 'cs' ? 'Otevřít celý playlist' : 'Open full playlist'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Quick return banner when no video is loaded but previous video exists */}
            {!videoInfo && !isLoading && effectivePreviousVideo && (
              <div 
                className="flex items-center justify-between p-3.5 rounded-xl border shadow-xs"
                style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
              >
                <div className="flex items-center gap-2 text-xs min-w-0" style={{ color: 'var(--text-muted)' }}>
                  <History className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="shrink-0 font-medium">{t.backToPreviousVideo}:</span>
                  <span className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {effectivePreviousVideo.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleBackToPreviousVideo}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:opacity-90 shrink-0 shadow-xs"
                  style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t.backToPreviousVideo}</span>
                </button>
              </div>
            )}

            {/* Video Result Preview Card */}
            {videoInfo && !isLoading && (
              <VideoPreviewCard
                video={videoInfo}
                lang={lang}
                preferences={preferences}
                onUpdatePreferences={handleSavePreferences}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onRecordDownload={handleRecordDownload}
                onBackToPreviousVideo={handleBackToPreviousVideo}
                onForwardVideo={handleForwardVideo}
                previousVideo={effectivePreviousVideo}
                nextVideo={effectiveNextVideo}
                recentWatchedVideos={recentWatchedVideos}
                onSelectRecentVideo={handleSelectVideo}
              />
            )}
          </div>
        )}

        {/* Tab: YouTube Playlist Downloader */}
        {activeTab === 'playlist' && (
          <div className="space-y-8">
            <UrlInputBar
              url={url}
              onChangeUrl={setUrl}
              onSubmit={handleAnalyze}
              isLoading={isLoading}
              lang={lang}
            />

            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    {lang === 'cs' ? 'Chyba při načítání playlistu' : 'Error loading playlist'}
                  </h4>
                  <p className="mt-0.5 text-xs text-red-700 dark:text-red-200/90 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}

            {playlistInfo && !isLoading ? (
              <PlaylistView
                playlist={playlistInfo}
                onBack={() => setActiveTab('single')}
                onSelectSingleVideo={handleSelectFromPlaylist}
                onTransferToBatch={handleTransferToBatch}
                lang={lang}
                defaultFormat={preferences.defaultFormat}
                defaultAudioQuality={preferences.defaultAudioQuality}
                defaultVideoQuality={preferences.defaultVideoQuality}
              />
            ) : !isLoading && (
              <div
                className="border p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-3 shadow-md"
                style={{
                  backgroundColor: 'var(--panel-bg)',
                  borderColor: 'var(--panel-border)',
                  borderRadius: 'var(--ui-radius-lg)',
                }}
              >
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center border"
                  style={{
                    backgroundColor: 'var(--panel-surface)',
                    borderColor: 'var(--panel-border)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <ListMusic className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {lang === 'cs' ? 'Stahování celých YouTube Playlistů a Alb' : 'Download Full YouTube Playlists & Albums'}
                </h3>
                <p className="text-xs sm:text-sm max-w-lg leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'cs'
                    ? 'Vložte výše libovolný odkaz na YouTube playlist (např. https://www.youtube.com/playlist?list=...) a KiYoDo automaticky načte všechny skladby k hromadnému stažení.'
                    : 'Paste any YouTube playlist link above and KiYoDo will automatically load all tracks for bulk download.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const samplePlaylist = 'https://www.youtube.com/playlist?list=OLAK5uy_mPlXLzPtE4Ch4LxKKpDLyjQzqqGSC79io';
                    setUrl(samplePlaylist);
                    handleAnalyze(samplePlaylist);
                  }}
                  className="mt-2 text-xs underline underline-offset-4 font-semibold cursor-pointer transition-opacity hover:opacity-80"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  {lang === 'cs' ? 'Vyzkoušet vzorové album (Budoár Staré Dámy)' : 'Try sample album'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: YouTube Video Search */}
        {activeTab === 'search' && (
          <YouTubeSearch
            lang={lang}
            preferences={preferences}
            onSelectVideo={handleSelectFromSearch}
            onRecordWatch={recordWatchHistory}
            initialQuery={searchQuery}
            onQueryChange={setSearchQuery}
          />
        )}

        {/* Tab 3: Batch Downloader */}
        {activeTab === 'batch' && <BatchDownloader lang={lang} preferences={preferences} initialUrls={batchInitialUrls} />}

        {/* Tab: Standalone Drag & Drop Audio/Video Merger (Option C) */}
        {activeTab === 'merger' && (
          <AudioVideoMergerModal
            isOpen={true}
            onClose={() => setActiveTab('single')}
            videoInfo={videoInfo}
            lang={lang}
            onRecordDownload={handleRecordDownload}
          />
        )}

        {/* Tab 4: PC Guide & Tips */}
        {activeTab === 'guide' && <DesktopHelperSection lang={lang} />}

        {/* Tab 4: History */}
        {activeTab === 'history' && (
          <DownloadHistory
            watchHistory={watchHistory}
            downloadHistory={history}
            onSelectVideo={handleSelectVideo}
            onClearWatchHistory={handleClearWatchHistory}
            onClearDownloadHistory={handleClearHistory}
            onRemoveWatchItem={handleRemoveWatchItem}
            onRemoveDownloadItem={handleRemoveDownloadItem}
            lang={lang}
          />
        )}

        {/* Tab 5: Bookmarks & Personal Folders */}
        {activeTab === 'bookmarks' && (
          <BookmarksView
            lang={lang}
            onSelectVideo={handleSelectFromPlaylist}
            localHistory={history}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Fixed Native App Style) */}
      <nav 
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-xl shadow-2xl transition-colors pb-[max(env(safe-area-inset-bottom),6px)] pt-1"
        style={{
          backgroundColor: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
        }}
      >
        <div className="grid grid-cols-5 items-center px-1">
          {/* 1. Hledat */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('search');
              setIsMobileToolsOpen(false);
            }}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer select-none"
            style={{
              color: activeTab === 'search' ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'search' ? 'bg-white/10 shadow-xs' : ''}`}>
              <Search className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold mt-0.5 tracking-tight truncate max-w-full">
              {t.navSearch}
            </span>
          </button>

          {/* 2. Vložit odkaz */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('single');
              setIsMobileToolsOpen(false);
            }}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer select-none"
            style={{
              color: activeTab === 'single' ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'single' ? 'bg-white/10 shadow-xs' : ''}`}>
              <Link2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold mt-0.5 tracking-tight truncate max-w-full">
              {lang === 'cs' ? 'Odkaz' : 'Link'}
            </span>
          </button>

          {/* 3. Playlisty */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('playlist');
              setIsMobileToolsOpen(false);
            }}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer select-none relative"
            style={{
              color: activeTab === 'playlist' ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}
          >
            <div className={`p-1 rounded-lg relative ${activeTab === 'playlist' ? 'bg-white/10 shadow-xs' : ''}`}>
              <ListMusic className="w-5 h-5" />
              {playlistInfo && (
                <span 
                  className="absolute -top-1 -right-2 px-1 py-0.2 text-[9px] font-mono rounded-full font-bold leading-none"
                  style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
                >
                  {playlistInfo.videoCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold mt-0.5 tracking-tight truncate max-w-full">
              {t.navPlaylist}
            </span>
          </button>

          {/* 4. Dávkové */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('batch');
              setIsMobileToolsOpen(false);
            }}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer select-none"
            style={{
              color: activeTab === 'batch' ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'batch' ? 'bg-white/10 shadow-xs' : ''}`}>
              <Copy className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold mt-0.5 tracking-tight truncate max-w-full">
              {t.navBatch}
            </span>
          </button>

          {/* 5. Nástroje (Drawer Trigger) */}
          <button
            type="button"
            onClick={() => setIsMobileToolsOpen(true)}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer select-none relative"
            style={{
              color: (activeTab === 'merger' || activeTab === 'guide' || activeTab === 'history' || isMobileToolsOpen) 
                ? 'var(--accent-primary)' 
                : 'var(--text-muted)',
            }}
          >
            <div className={`p-1 rounded-lg relative ${(activeTab === 'merger' || activeTab === 'guide' || activeTab === 'history') ? 'bg-white/10 shadow-xs' : ''}`}>
              <Layers className="w-5 h-5" />
              {history.length > 0 && (
                <span 
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                />
              )}
            </div>
            <span className="text-[10px] font-semibold mt-0.5 tracking-tight truncate max-w-full">
              {t.navTools || (lang === 'cs' ? 'Nástroje' : 'Tools')}
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile Tools Bottom Sheet Modal */}
      {isMobileToolsOpen && (
        <div 
          className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsMobileToolsOpen(false)}
        >
          <div 
            className="w-full border-t rounded-t-2xl p-4 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200"
            style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--panel-border)' }}>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t.navTools || (lang === 'cs' ? 'Doplňkové nástroje' : 'Tools')}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setIsMobileToolsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1 pb-2">
              {/* 1. Záložky */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('bookmarks');
                  setIsMobileToolsOpen(false);
                }}
                className="flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-colors"
                style={{
                  backgroundColor: activeTab === 'bookmarks' ? 'var(--panel-surface)' : 'var(--panel-surface)',
                  borderColor: activeTab === 'bookmarks' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">{t.navBookmarks || (lang === 'cs' ? 'Záložky a složky' : 'Bookmarks')}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{lang === 'cs' ? 'Osobní složky s uloženými videi' : 'Personal bookmark folders'}</div>
                  </div>
                </div>
              </button>

              {/* 2. Sloučit video + audio */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('merger');
                  setIsMobileToolsOpen(false);
                }}
                className="flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-colors"
                style={{
                  backgroundColor: activeTab === 'merger' ? 'var(--panel-surface)' : 'var(--panel-surface)',
                  borderColor: activeTab === 'merger' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">{t.navMerger}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Spojení stop přímo v prohlížeči (WASM)</div>
                  </div>
                </div>
              </button>

              {/* 2. Historie */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('history');
                  setIsMobileToolsOpen(false);
                }}
                className="flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-colors"
                style={{
                  backgroundColor: activeTab === 'history' ? 'var(--panel-surface)' : 'var(--panel-surface)',
                  borderColor: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">{t.navHistory}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Přehled stažených souborů</div>
                  </div>
                </div>
                {history.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
                    {history.length}
                  </span>
                )}
              </button>

              {/* 3. Návod pro PC */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('guide');
                  setIsMobileToolsOpen(false);
                }}
                className="flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-colors"
                style={{
                  backgroundColor: activeTab === 'guide' ? 'var(--panel-surface)' : 'var(--panel-surface)',
                  borderColor: activeTab === 'guide' ? 'var(--accent-primary)' : 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">{t.navPcGuide}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>1-klik stahování bez limitů přes skripty</div>
                  </div>
                </div>
              </button>

              {/* 4. Nastavení */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileToolsOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-colors"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">{t.settingsTitle || 'Uživatelské nastavení kvality'}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Předvolby formátu a rozlišení</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        onSavePreferences={handleSavePreferences}
        lang={lang}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        isStandalone={isStandalone}
      />

      {/* Auth Modal (Login / Register / Google) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialTab={authModalTab}
        lang={lang}
      />

      {/* PWA Install Guide Modal */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        lang={lang}
        canInstallNative={canInstall}
        onInstallNative={deferredInstallPrompt ? handleInstallApp : undefined}
      />

      {/* Mobile Install Promotion Banner */}
      {!isStandalone && (
        <InstallBanner
          lang={lang}
          onOpenInstall={() => setIsInstallModalOpen(true)}
          canInstallNative={canInstall}
        />
      )}

      {/* Footer */}
      <Footer lang={lang} />
    </div>
  );
}

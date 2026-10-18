import { 
  VideoInfo, 
  DownloadFormat, 
  DownloadEngine, 
  JobProgress, 
  VideoSearchResult, 
  SearchResponse, 
  PlaylistItem, 
  PlaylistInfo, 
  VideoChapter,
  AudioBoostOption,
  MediaPlatform,
  DurationFilter
} from '../types';
import { notifyDownloadTriggered } from './versionCheck';

/**
 * Extracts a YouTube Playlist ID from a URL or raw ID string.
 */
export function extractYouTubePlaylistId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If already a playlist ID (e.g. PLxxx, OLAK5uy_xxx, UUxxx, RDxxx)
  if (/^(?:PL|UU|LL|FL|RD|OLAK5uy_)[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  // Matches list= parameter
  const match = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Checks whether an input string is a dedicated YouTube playlist URL.
 */
export function isYouTubePlaylistUrl(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  const playlistId = extractYouTubePlaylistId(trimmed);
  if (!playlistId) return false;

  // Dedicated playlist URL or starts with playlist ID prefix without a video
  if (trimmed.includes('youtube.com/playlist') || trimmed.includes('/playlist?')) {
    return true;
  }

  if (/^(?:PL|UU|LL|FL|RD|OLAK5uy_)[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return true;
  }

  if (trimmed.includes('list=') && !trimmed.includes('v=')) {
    return true;
  }

  return false;
}

/**
 * Checks whether an input string is a video URL that also contains a playlist reference (list=).
 */
export function hasPlaylistReference(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  return trimmed.includes('list=') && (trimmed.includes('v=') || /^[a-zA-Z0-9_-]{11}$/.test(trimmed));
}

/**
 * Fetches playlist metadata and videos list from server API
 */
export async function fetchPlaylistDetails(input: string): Promise<PlaylistInfo> {
  const playlistId = extractYouTubePlaylistId(input);
  if (!playlistId) {
    throw new Error('Neplatná adresa YouTube playlistu. Chybí identifikátor list=.');
  }

  const standardUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

  const res = await fetch(`/api/playlist?url=${encodeURIComponent(standardUrl)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Nepodařilo se načíst playlist ze serveru.');
  }

  const data: PlaylistInfo = await res.json();
  return data;
}

/**
 * Extracts a YouTube Video ID from any standard YouTube URL or raw ID.
 */
export function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If it's already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Matches youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, etc.
  const regexPatterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of regexPatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Detects media platform from a given URL or text input.
 */
export function detectMediaPlatform(input: string): MediaPlatform {
  if (!input) return 'unknown';
  const trimmed = input.trim();

  // TikTok
  if (/(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i.test(trimmed)) {
    return 'tiktok';
  }

  // Instagram
  if (/(?:instagram\.com|instagr\.am)/i.test(trimmed)) {
    return 'instagram';
  }

  // Facebook
  if (/(?:facebook\.com|fb\.watch|fb\.com)/i.test(trimmed)) {
    return 'facebook';
  }

  // YouTube
  if (
    extractYouTubeId(trimmed) || 
    extractYouTubePlaylistId(trimmed) || 
    /(?:youtube\.com|youtu\.be)/i.test(trimmed)
  ) {
    return 'youtube';
  }

  return 'unknown';
}

/**
 * Checks whether an input string is a supported media URL.
 */
export function isSupportedMediaUrl(input: string): boolean {
  return detectMediaPlatform(input) !== 'unknown';
}

/**
 * Normalizes YouTube video URL
 */
export function normalizeYouTubeUrl(idOrUrl: string): string {
  const id = extractYouTubeId(idOrUrl);
  return id ? `https://www.youtube.com/watch?v=${id}` : idOrUrl;
}

/**
 * Fetches video metadata across YouTube, TikTok, Instagram, and Facebook
 */
export async function fetchVideoDetails(input: string): Promise<VideoInfo> {
  const trimmed = input.trim();
  const platform = detectMediaPlatform(trimmed);

  // --- TIKTOK SUPPORT ---
  if (platform === 'tiktok') {
    // 1. Try local server endpoint first
    try {
      const serverRes = await fetch(`/api/info?url=${encodeURIComponent(trimmed)}`);
      if (serverRes.ok) {
        const sData = await serverRes.json();
        return {
          id: sData.id || 'tiktok_video',
          url: trimmed,
          title: sData.title || 'TikTok Video',
          author: sData.author || 'TikTok',
          authorUrl: sData.authorUrl,
          thumbnailUrl: sData.thumbnailUrl || 'https://www.tiktok.com/favicon.ico',
          duration: sData.duration || 'Neznámá',
          durationSeconds: sData.durationSeconds,
          platform: 'tiktok',
          directDownloadUrl: sData.directDownloadUrl,
          directAudioUrl: sData.directAudioUrl,
          availableQualities: ['1080', '720'],
          maxQuality: '1080',
        };
      }
    } catch {
      // server fallback
    }

    // 2. Direct client fallback via TikWM (watermark-free MP4 + MP3 audio)
    try {
      const tikRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(trimmed)}`);
      if (tikRes.ok) {
        const tikData = await tikRes.json();
        if (tikData.code === 0 && tikData.data) {
          const d = tikData.data;
          const durSec = d.duration || 0;
          const durStr = durSec > 0 ? `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}` : 'Neznámá';
          return {
            id: d.id || 'tiktok_video',
            url: trimmed,
            title: d.title || (d.music_info ? d.music_info.title : 'TikTok Video'),
            author: d.author?.nickname ? `${d.author.nickname} (@${d.author.unique_id})` : `@${d.author?.unique_id || 'tiktok'}`,
            authorUrl: d.author?.unique_id ? `https://www.tiktok.com/@${d.author.unique_id}` : undefined,
            thumbnailUrl: d.cover || d.origin_cover || 'https://www.tiktok.com/favicon.ico',
            duration: durStr,
            durationSeconds: durSec,
            platform: 'tiktok',
            directDownloadUrl: d.play || d.wmplay,
            directAudioUrl: d.music,
            availableQualities: ['1080', '720'],
            maxQuality: '1080',
          };
        }
      }
    } catch {
      // oEmbed fallback
    }

    // 3. Fallback to TikTok oEmbed
    try {
      const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(trimmed)}`);
      if (oembedRes.ok) {
        const oData = await oembedRes.json();
        return {
          id: oData.embed_product_id || 'tiktok_video',
          url: trimmed,
          title: oData.title || 'TikTok Video',
          author: oData.author_name || 'TikTok',
          authorUrl: oData.author_url,
          thumbnailUrl: oData.thumbnail_url || 'https://www.tiktok.com/favicon.ico',
          duration: 'Neznámá',
          platform: 'tiktok',
          availableQualities: ['1080', '720'],
          maxQuality: '1080',
        };
      }
    } catch {
      // generic fallback
    }

    return {
      id: 'tiktok_video',
      url: trimmed,
      title: 'TikTok Video',
      author: 'TikTok',
      thumbnailUrl: 'https://www.tiktok.com/favicon.ico',
      platform: 'tiktok',
      availableQualities: ['1080', '720'],
      maxQuality: '1080',
    };
  }

  // --- INSTAGRAM SUPPORT ---
  if (platform === 'instagram') {
    const match = trimmed.match(/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i);
    const shortcode = match ? match[1] : 'reel';
    return {
      id: shortcode,
      url: trimmed,
      title: `Instagram Reel (${shortcode})`,
      author: 'Instagram Creator',
      thumbnailUrl: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsNE-BpdtRI.png',
      duration: 'Neznámá',
      platform: 'instagram',
      availableQualities: ['1080', '720'],
      maxQuality: '1080',
    };
  }

  // --- FACEBOOK SUPPORT ---
  if (platform === 'facebook') {
    // 1. Try local server endpoint first
    try {
      const serverRes = await fetch(`/api/info?url=${encodeURIComponent(trimmed)}`);
      if (serverRes.ok) {
        const sData = await serverRes.json();
        return {
          id: sData.id || 'facebook_video',
          url: trimmed,
          title: sData.title || 'Facebook Video / Reel',
          author: sData.author || 'Facebook Creator',
          authorUrl: sData.authorUrl,
          thumbnailUrl: sData.thumbnailUrl || 'https://static.xx.fbcdn.net/rsrc.php/yT/r/a9tlyfGwhvb.ico',
          duration: sData.duration || 'Neznámá',
          durationSeconds: sData.durationSeconds,
          platform: 'facebook',
          directDownloadUrl: sData.directDownloadUrl,
          availableQualities: sData.availableQualities || ['1080', '720'],
          maxQuality: sData.maxQuality || '1080',
        };
      }
    } catch {
      // server fallback
    }

    // 2. Try noembed fallback
    try {
      const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(trimmed)}`);
      if (oembedRes.ok) {
        const oData = await oembedRes.json();
        if (oData && (oData.title || oData.author_name)) {
          return {
            id: 'facebook_video',
            url: trimmed,
            title: oData.title || 'Facebook Video',
            author: oData.author_name || 'Facebook',
            authorUrl: oData.author_url,
            thumbnailUrl: oData.thumbnail_url || 'https://static.xx.fbcdn.net/rsrc.php/yT/r/a9tlyfGwhvb.ico',
            duration: 'Neznámá',
            platform: 'facebook',
            availableQualities: ['1080', '720'],
            maxQuality: '1080',
          };
        }
      }
    } catch {
      // fallback
    }

    return {
      id: 'facebook_video',
      url: trimmed,
      title: 'Facebook Video / Reel',
      author: 'Facebook Creator',
      thumbnailUrl: 'https://static.xx.fbcdn.net/rsrc.php/yT/r/a9tlyfGwhvb.ico',
      duration: 'Neznámá',
      platform: 'facebook',
      availableQualities: ['1080', '720'],
      maxQuality: '1080',
    };
  }

  // --- YOUTUBE SUPPORT ---
  const videoId = extractYouTubeId(trimmed);
  if (!videoId) {
    throw new Error('Neplatná adresa videa. Podporovány jsou YouTube, TikTok, Instagram Reels a Facebook.');
  }

  const standardUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Try local server endpoint first
  try {
    const serverRes = await fetch(`/api/info?url=${encodeURIComponent(standardUrl)}`);
    if (serverRes.ok) {
      const sData = await serverRes.json();
      return {
        id: sData.id || videoId,
        url: standardUrl,
        title: sData.title || 'Neznámé YouTube video',
        author: sData.author || 'YouTube Autor',
        thumbnailUrl: sData.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: sData.duration || 'Neznámá',
        durationSeconds: sData.durationSeconds,
        viewCount: sData.viewCount,
        uploadDate: sData.uploadDate,
        maxQuality: sData.maxQuality,
        availableQualities: sData.availableQualities,
        rawMaxHeight: sData.rawMaxHeight,
        description: sData.description,
        chapters: sData.chapters,
        subtitles: sData.subtitles,
        platform: 'youtube',
      };
    }
  } catch {
    // Ignore server error and try direct oEmbed
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(standardUrl)}&format=json`;
    const response = await fetch(oembedUrl);
    if (response.ok) {
      const data = await response.json();
      return {
        id: videoId,
        url: standardUrl,
        title: data.title || 'YouTube Video',
        author: data.author_name || 'YouTube',
        authorUrl: data.author_url,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 'Neznámá',
        platform: 'youtube',
      };
    }
  } catch {
    // Fall through to fallback
  }

  return {
    id: videoId,
    url: standardUrl,
    title: `YouTube Video (${videoId})`,
    author: 'YouTube',
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: 'Neznámá',
    platform: 'youtube',
  };
}

/**
 * Initiates direct MP3/MP4 conversion on the built-in server
 */
export async function startServerConversion(options: {
  url: string;
  format: DownloadFormat;
  quality: string;
  track?: 'video' | 'audio' | 'auto';
  trimStart?: string;
  trimEnd?: string;
}): Promise<string> {
  const res = await fetch('/api/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Nepodařilo se zahájit konverzi.');
  }

  const data = await res.json();
  return data.jobId;
}

/**
 * Checks progress of conversion job on server
 */
export async function pollJobProgress(jobId: string): Promise<JobProgress> {
  const res = await fetch(`/api/progress/${jobId}`);
  if (!res.ok) {
    throw new Error('Nelze ověřit stav konverze ze serveru.');
  }
  return await res.json();
}

/**
 * Initiates conversion for a single isolated track (video-only or audio-only)
 * and downloads the resulting file directly as an in-memory Blob.
 */
export async function downloadTrackBlob(options: {
  url: string;
  track: 'video' | 'audio';
  quality: string;
  onProgress?: (percent: number, message: string) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const { url, track, quality, onProgress, signal } = options;
  const isAudio = track === 'audio';

  onProgress?.(5, isAudio ? 'Zahajuji stahování audio stopy ze serveru...' : 'Zahajuji stahování video stopy ze serveru...');

  const jobId = await startServerConversion({
    url,
    format: isAudio ? 'mp3' : 'mp4',
    quality,
    track,
  });

  return new Promise<Blob>((resolve, reject) => {
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    let isFinished = false;

    checkInterval = setInterval(async () => {
      if (signal?.aborted) {
        if (checkInterval) clearInterval(checkInterval);
        reject(new Error('Stahování bylo zrušeno.'));
        return;
      }

      try {
        const job = await pollJobProgress(jobId);

        if (job.status === 'completed') {
          if (checkInterval) clearInterval(checkInterval);
          isFinished = true;
          onProgress?.(92, isAudio ? 'Přenáším audio stopu do paměti...' : 'Přenáším video stopu do paměti...');

          const res = await fetch(`/api/download/${jobId}`, { signal });
          if (!res.ok) {
            throw new Error(`Nepodařilo se stáhnout stopu (${res.status})`);
          }
          const blob = await res.blob();
          onProgress?.(100, isAudio ? 'Audio stopa připravena.' : 'Video stopa připravena.');
          resolve(blob);
        } else if (job.status === 'error') {
          if (checkInterval) clearInterval(checkInterval);
          isFinished = true;
          reject(new Error(job.error || 'Konverze stopy na serveru selhala.'));
        } else {
          const scaledPercent = Math.min(88, Math.max(10, job.percent || 15));
          onProgress?.(scaledPercent, job.message || (isAudio ? 'Příprava zvuku...' : 'Příprava videa...'));
        }
      } catch (err) {
        if (!isFinished && signal?.aborted) {
          if (checkInterval) clearInterval(checkInterval);
          reject(err);
        }
      }
    }, 700);
  });
}


/**
 * Returns web gateway URLs for direct 1-click downloads
 */
export function getWebDownloadGatewayUrl(
  engine: DownloadEngine,
  videoId: string,
  format: DownloadFormat,
  quality: string
): string {
  const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  switch (engine) {
    case 'cobalt':
      // Direct Cobalt web app with URL parameter pre-filled
      return `https://cobalt.tools/#${encodeURIComponent(fullUrl)}`;
    
    case '10downloader':
      // 10Downloader direct video page
      return `https://10downloader.com/download?v=${encodeURIComponent(fullUrl)}`;

    case 'y2mate':
      // Y2Mate direct bridge
      return `https://www.y2mate.com/youtube/${videoId}`;

    case 'savefrom':
      // SaveFrom / ssYouTube helper
      return `https://en.savefrom.net/1-youtube-video-downloader-4.html?url=${encodeURIComponent(fullUrl)}`;

    case 'snapsave':
      // SnapSave downloader
      return `https://snapsave.io/cs#url=${encodeURIComponent(fullUrl)}`;

    default:
      return `https://www.y2mate.com/youtube/${videoId}`;
  }
}

/**
 * Generates an automated Windows Batch script (.bat) that the user can run
 * on their PC to download the video/audio directly into their Downloads folder.
 */
export function generateWindowsBatchScript(options: {
  url: string;
  title: string;
  format: DownloadFormat;
  quality: string;
  trimStart?: string;
  trimEnd?: string;
  audioBoost?: AudioBoostOption;
  platform?: MediaPlatform;
}): string {
  const { url, title, format, quality, trimStart, trimEnd, audioBoost, platform } = options;
  const safeTitle = title
    .replace(/\|/g, ' - ')
    .replace(/[&<>^%"`!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const isAudio = format === 'mp3';
  const extension = isAudio ? 'mp3' : 'mp4';
  const effectivePlatform = platform || detectMediaPlatform(url);

  let platformName = 'YouTube';
  if (effectivePlatform === 'tiktok') platformName = 'TikTok';
  else if (effectivePlatform === 'instagram') platformName = 'Instagram';
  else if (effectivePlatform === 'facebook') platformName = 'Facebook';

  const isYouTube = effectivePlatform === 'youtube';
  const extractorArg = isYouTube ? '--extractor-args "youtube:player_client=android,web" ' : '';

  let af = '';
  let boostLabel = 'Původní (beze změny)';
  if (audioBoost === 'boost3') {
    af = 'volume=1.41';
    boostLabel = '+3 dB (Zesíleno o 40%)';
  } else if (audioBoost === 'boost6') {
    af = 'volume=2.0';
    boostLabel = '+6 dB (Dvojnásobná hlasitost)';
  } else if (audioBoost === 'normalize') {
    af = 'loudnorm=I=-16:TP=-1.5:LRA=11';
    boostLabel = 'Automatická normalizace (EBU R128)';
  }

  let timeArgs = '';
  if (trimStart && trimEnd) {
    timeArgs = `-ss ${trimStart} -to ${trimEnd}`;
  } else if (trimStart) {
    timeArgs = `-ss ${trimStart}`;
  } else if (trimEnd) {
    timeArgs = `-to ${trimEnd}`;
  }

  let postArgs = '';
  if (timeArgs && af) {
    postArgs = `--postprocessor-args "ffmpeg:${timeArgs} -filter:a ${af}"`;
  } else if (timeArgs) {
    postArgs = `--postprocessor-args "ffmpeg:${timeArgs}"`;
  } else if (af) {
    postArgs = isAudio 
      ? `--postprocessor-args "ExtractAudio:-filter:a ${af}"`
      : `--postprocessor-args "FFmpeg:-filter:a ${af}"`;
  }

  const dlArgs = isAudio
    ? `${extractorArg}-x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata ${postArgs} -o "%USERPROFILE%\\Downloads\\%%(title)s.%%(ext)s" "${url}"`
    : `${extractorArg}-S "res:${quality},ext:mp4:m4a" -f "bestvideo[height<=${quality}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best" --merge-output-format mp4 ${postArgs} -o "%USERPROFILE%\\Downloads\\%%(title)s.%%(ext)s" "${url}"`;

  return `@echo off\r
chcp 65001 >nul\r
title ${platformName} Stahovac pro PC - ${safeTitle}\r
color 0b\r
\r
echo ===============================================================================\r
echo            ${platformName} Stahovac pro PC - ${isAudio ? 'Zvuk (MP3)' : 'Video (MP4)'}\r
echo ===============================================================================\r
echo.\r
echo Nazev: ${safeTitle}\r
echo Platforma: ${platformName}\r
echo Format: ${extension.toUpperCase()} (${isAudio ? `${quality} kbps` : `${quality}p`} H.264 / AAC)\r
echo Hlasitost: ${boostLabel}\r
echo Cilova slozka: Vase slozka Stazene soubory (Downloads)\r
echo.\r
\r
set "TEMP_DIR=%TEMP%\\yt_downloader_pc"\r
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"\r
set "YTDLP_EXE=yt-dlp"\r
\r
where yt-dlp >nul 2>&1\r
if %ERRORLEVEL% NEQ 0 (\r
    set "YTDLP_EXE=%TEMP_DIR%\\yt-dlp.exe"\r
    if not exist "%TEMP_DIR%\\yt-dlp.exe" (\r
        echo [INFO] Stahuji prenosny yt-dlp.exe z GitHubu...\r
        curl -L -k "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -o "%TEMP_DIR%\\yt-dlp.exe" 2>nul\r
        if not exist "%TEMP_DIR%\\yt-dlp.exe" (\r
            powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '%TEMP_DIR%\\yt-dlp.exe'"\r
        )\r
    )\r
)\r
\r
where ffmpeg >nul 2>&1\r
if %ERRORLEVEL% NEQ 0 (\r
    if exist "%TEMP_DIR%\\ffmpeg.exe" (\r
        set "PATH=%TEMP_DIR%;%PATH%"\r
    ) else (\r
        if exist "%LOCALAPPDATA%\\Microsoft\\WinGet\\Packages" (\r
            for /d %%d in ("%LOCALAPPDATA%\\Microsoft\\WinGet\\Packages\\*ffmpeg*") do (\r
                if exist "%%d\\bin\\ffmpeg.exe" set "PATH=%%d\\bin;%PATH%"\r
                if exist "%%d\\ffmpeg-*\\bin\\ffmpeg.exe" for /d %%f in ("%%d\\ffmpeg-*") do set "PATH=%%f\\bin;%PATH%"\r
            )\r
        )\r
    )\r
)\r
where ffmpeg >nul 2>&1\r
if %ERRORLEVEL% NEQ 0 (\r
    if not exist "%TEMP_DIR%\\ffmpeg.exe" (\r
        echo [INFO] Pripravuji nastroj FFmpeg pro konverzi zvuku do cisteho MP3...\r
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $z = '%TEMP_DIR%\\ff.zip'; try { Invoke-WebRequest -Uri 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' -OutFile $z; Expand-Archive -Path $z -DestinationPath '%TEMP_DIR%\\ffpkg' -Force; Get-ChildItem -Path '%TEMP_DIR%\\ffpkg' -Recurse -Filter 'ffmpeg.exe' | Copy-Item -Destination '%TEMP_DIR%\\ffmpeg.exe'; Remove-Item -Recurse -Force '%TEMP_DIR%\\ffpkg', $z } catch {}" 2>nul\r
    )\r
    if exist "%TEMP_DIR%\\ffmpeg.exe" set "PATH=%TEMP_DIR%;%PATH%"\r
)\r

\r
echo [1/4] Zkousim prime stahovani...\r
"%YTDLP_EXE%" ${dlArgs}\r
if %ERRORLEVEL% EQU 0 goto hotovo\r
\r
echo [2/4] Zkousim stahovani se sezenim z Google Chrome...\r
"%YTDLP_EXE%" --cookies-from-browser chrome ${dlArgs}\r
if %ERRORLEVEL% EQU 0 goto hotovo\r
\r
echo [3/4] Zkousim stahovani se sezenim z prohlizece Edge...\r
"%YTDLP_EXE%" --cookies-from-browser edge ${dlArgs}\r
if %ERRORLEVEL% EQU 0 goto hotovo\r
\r
echo [4/4] Zkousim stahovani se sezenim z Firefoxu...\r
"%YTDLP_EXE%" --cookies-from-browser firefox ${dlArgs}\r
if %ERRORLEVEL% EQU 0 goto hotovo\r
\r
echo.\r
echo ===============================================================================\r
echo [UPOZORNENI] Stahovani selhalo. Sluzba muze vyzadovat aktivni relaci nebo prihlaseni.\r
echo.\r
echo Reseni:\r
echo 1. Otevrete video v prohlizeci Chrome nebo Edge, aby existovala aktivni relace.\r
echo 2. Pripadne nainstalujte JavaScript modul Deno:\r
echo    Spustte v PowerShellu: winget install --id DenoLand.Deno\r
echo ===============================================================================\r
pause\r
exit /b 1\r
\r
:hotovo\r
echo.\r
echo ===============================================================================\r
echo   HOTOVO! Soubor byl uspesne sloucen a ulozen do slozky Downloads.\r
echo   Format je 100%% kompatibilni se vsemi prehravaci (Windows Media Player, TV, mobil).\r
echo ===============================================================================\r
echo.\r
pause\r
explorer.exe "%USERPROFILE%\\Downloads"\r
exit /b 0\r
`;
}

/**
 * Generates single-line yt-dlp terminal command for Windows PowerShell / Mac / Linux
 */
export function generateYtDlpCommand(options: {
  url: string;
  format: DownloadFormat;
  quality: string;
  trimStart?: string;
  trimEnd?: string;
  audioBoost?: AudioBoostOption;
  platform?: MediaPlatform;
}): string {
  const { url, format, quality, trimStart, trimEnd, audioBoost, platform } = options;
  const isAudio = format === 'mp3';
  const effectivePlatform = platform || detectMediaPlatform(url);
  const isYouTube = effectivePlatform === 'youtube';
  const extractorArg = isYouTube ? '--extractor-args "youtube:player_client=android,web" ' : '';

  let af = '';
  if (audioBoost === 'boost3') af = 'volume=1.41';
  else if (audioBoost === 'boost6') af = 'volume=2.0';
  else if (audioBoost === 'normalize') af = 'loudnorm=I=-16:TP=-1.5:LRA=11';

  let timeArgs = '';
  if (trimStart && trimEnd) {
    timeArgs = `-ss ${trimStart} -to ${trimEnd}`;
  } else if (trimStart) {
    timeArgs = `-ss ${trimStart}`;
  } else if (trimEnd) {
    timeArgs = `-to ${trimEnd}`;
  }

  let postArgs = '';
  if (timeArgs && af) {
    postArgs = `--postprocessor-args "ffmpeg:${timeArgs} -filter:a ${af}" `;
  } else if (timeArgs) {
    postArgs = `--postprocessor-args "ffmpeg:${timeArgs}" `;
  } else if (af) {
    postArgs = isAudio 
      ? `--postprocessor-args "ExtractAudio:-filter:a ${af}" `
      : `--postprocessor-args "FFmpeg:-filter:a ${af}" `;
  }

  if (isAudio) {
    return `yt-dlp ${extractorArg}-x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata ${postArgs}-o "~/Downloads/%(title)s.%(ext)s" "${url}"`;
  }
  return `yt-dlp ${extractorArg}-S "res:${quality},ext:mp4:m4a" -f "bestvideo[height<=${quality}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best" --merge-output-format mp4 ${postArgs}-o "~/Downloads/%(title)s.%(ext)s" "${url}"`;
}

/**
 * Triggers browser download of generated text / script file
 */
export function triggerFileDownload(filename: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  const isBatch = filename.endsWith('.bat') || filename.endsWith('.cmd');
  const normalizedContent = isBatch ? content.replace(/\r?\n/g, '\r\n') : content;
  const blob = new Blob([normalizedContent], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
  notifyDownloadTriggered();
}

/**
 * Parses relative human-readable or ISO date string into elapsed seconds for chronological sorting
 */
export function parseRelativeTimeToSeconds(text?: string): number {
  if (!text) return Infinity;
  const lower = text.toLowerCase().trim();

  // If date string (e.g. 2026-09-27 or 2026-09-27T...)
  if (/^\d{4}-\d{2}-\d{2}/.test(lower)) {
    const t = Date.parse(lower);
    if (!isNaN(t)) return Math.max(0, (Date.now() - t) / 1000);
  }

  const numMatch = lower.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1], 10) : 1;

  if (lower.includes('sekund') || lower.includes('sec') || lower.includes('vteřin')) {
    return num;
  }
  if (lower.includes('minut') || lower.includes('min')) {
    return num * 60;
  }
  if (lower.includes('hodin') || lower.includes('h') || lower.includes('hour')) {
    return num * 3600;
  }
  if (lower.includes('dn') || lower.includes('day') || lower.includes('včera') || lower.includes('yesterday')) {
    return (lower.includes('včera') || lower.includes('yesterday')) ? 86400 : num * 86400;
  }
  if (lower.includes('týd') || lower.includes('week')) {
    return num * 7 * 86400;
  }
  if (lower.includes('měs') || lower.includes('month')) {
    return num * 30 * 86400;
  }
  if (lower.includes('let') || lower.includes('rok') || lower.includes('year') || lower.includes('r.')) {
    return num * 365 * 86400;
  }

  return Infinity;
}

/**
 * Parses a duration string (e.g. "10:53", "1:17:00", "45", "3:10:03") into total seconds.
 * Returns -1 if duration is missing or unparseable.
 */
export function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr || durationStr === 'Neznámá' || durationStr === 'Unknown') return -1;
  const parts = durationStr.trim().split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return -1;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return -1;
}

/**
 * Checks whether a video matches the given DurationFilter range.
 * Supported ranges (in minutes):
 * - 'all': all videos
 * - '0-4': 0 to 4 minutes (< 240s)
 * - '4-8': 4 to 8 minutes (>= 240s and < 480s)
 * - '8-16': 8 to 16 minutes (>= 480s and < 960s)
 * - '16-50': 16 to 50 minutes (>= 960s and < 3000s)
 * - '50+': 50 minutes and longer (>= 3000s)
 */
export function matchesDurationFilter(
  video: { duration?: string; durationSeconds?: number },
  filter: DurationFilter = 'all'
): boolean {
  if (filter === 'all') return true;

  const sec = typeof video.durationSeconds === 'number' && video.durationSeconds > 0
    ? video.durationSeconds
    : parseDurationToSeconds(video.duration);

  // If specific duration filter is active but video duration is unknown, exclude it
  if (sec < 0) return false;

  switch (filter) {
    case '0-4':
      return sec < 4 * 60;
    case '4-8':
      return sec >= 4 * 60 && sec < 8 * 60;
    case '8-16':
      return sec >= 8 * 60 && sec < 16 * 60;
    case '16-50':
      return sec >= 16 * 60 && sec < 50 * 60;
    case '50+':
      return sec >= 50 * 60;
    default:
      return true;
  }
}

/**
 * Searches YouTube videos via ASP.NET Core backend /api/search
 */
export async function searchYouTubeVideos(
  query: string,
  continuation?: string | null,
  sortBy: 'date' | 'relevance' = 'date',
  lang: string = 'cs'
): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed && !continuation) {
    return { results: [], continuation: null };
  }

  const params = new URLSearchParams();
  if (trimmed) params.append('q', trimmed);
  if (continuation) params.append('continuation', continuation);
  params.append('sortBy', sortBy);
  params.append('hl', lang);
  const paramStr = params.toString();

  try {
    const res = await fetch(`/api/search?${paramStr}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        let results: VideoSearchResult[] = data.results;
        if (sortBy === 'date') {
          results = results.slice().sort((a, b) => {
            const timeA = parseRelativeTimeToSeconds(a.publishedTime || a.uploadDate);
            const timeB = parseRelativeTimeToSeconds(b.publishedTime || b.uploadDate);
            return timeA - timeB;
          });
        }

        return {
          results,
          continuation: data.continuation || null,
          sortBy: data.sortBy || sortBy,
        };
      }
    }
  } catch (err: unknown) {
    throw err instanceof Error ? err : new Error(String(err));
  }

  throw new Error('Nepodařilo se vyhledat videa na YouTube. Zkontrolujte připojení.');
}

/**
 * Fetches real-time YouTube search suggestions cleanly via backend /api/suggest without CORS issues
 */
export async function fetchSearchSuggestions(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const qEnc = encodeURIComponent(trimmed);

  try {
    const res = await fetch(`/api/suggest?q=${qEnc}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.suggestions)) {
        return data.suggestions;
      }
    }
  } catch {
    // ignore network/abort errors silently
  }

  return [];
}

/**
 * Generates a full Windows batch (.bat) script for downloading all or selected tracks of a playlist
 * into a dedicated folder inside Downloads, with sequential numbering, ID3 tags & cover art.
 */
export function generatePlaylistWindowsBatchScript(options: {
  playlist: PlaylistInfo;
  selectedVideoIds: string[];
  format: DownloadFormat;
  quality: string;
}): string {
  const { playlist, selectedVideoIds, format, quality } = options;
  const isAudio = format === 'mp3';
  const extension = isAudio ? 'mp3' : 'mp4';

  const cleanTitle = (playlist.title || 'YouTube Playlist')
    .replace(/[/\\?%*:|"<>]/g, ' ')
    .replace(/[&^`!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'YouTube Playlist';

  const selectedVideos = playlist.videos.filter(v => selectedVideoIds.includes(v.id));
  const isAllSelected = selectedVideos.length === playlist.videos.length && playlist.videos.length > 0;

  // For audio, use highest audio quality with ID3 tags & cover art
  const dlArgs = isAudio
    ? `--extractor-args "youtube:player_client=android,web" -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata`
    : `--extractor-args "youtube:player_client=android,web" -S "res:${quality},ext:mp4:m4a" -f "bestvideo[height<=${quality}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best" --merge-output-format mp4`;

  let linksBlock = '';
  if (isAllSelected) {
    linksBlock = `set "PLAYLIST_URL=${playlist.url}"\nset "TARGET_CMD=%YTDLP_EXE% ${dlArgs} -o "%DEST_DIR%\\%%(playlist_index)02d - %%(title)s.%%(ext)s" "%PLAYLIST_URL%""`;
  } else {
    // Generate commands for selected URLs
    linksBlock = `set "LINKS_FILE=%TEMP_DIR%\\playlist_selected.txt"
(
${selectedVideos.map(v => `echo ${v.url}`).join('\r\n')}
) > "%LINKS_FILE%"
set "TARGET_CMD=%YTDLP_EXE% ${dlArgs} -a "%LINKS_FILE%" -o "%DEST_DIR%\\%%(autonumber)02d - %%(title)s.%%(ext)s""`;
  }

  return `@echo off
chcp 65001 >nul
title YouTube Downloader pro PC - Playlist: ${cleanTitle}
color 0b

echo ===============================================================================
echo        YouTube Playlist Stahovac - ${cleanTitle}
echo ===============================================================================
echo.
echo Playlist: ${cleanTitle}
echo Autor: ${playlist.author}
echo Vybrano polozek: ${selectedVideos.length} z ${playlist.videoCount}
echo Format: ${extension.toUpperCase()} (${isAudio ? `${quality} kbps s ID3 tagy a obalem` : `${quality}p H.264 / AAC`})
echo Cilova podslozka: %%USERPROFILE%\\Downloads\\${cleanTitle}
echo.

set "TEMP_DIR=%TEMP%\\yt_downloader_pc"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
set "DEST_DIR=%USERPROFILE%\\Downloads\\${cleanTitle}"
if not exist "%DEST_DIR%" mkdir "%DEST_DIR%"

set "YTDLP_EXE=yt-dlp"
where yt-dlp >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set "YTDLP_EXE=%TEMP_DIR%\\yt-dlp.exe"
    if not exist "%TEMP_DIR%\\yt-dlp.exe" (
        echo [INFO] Stahuji prenosny yt-dlp.exe z GitHubu...
        curl -L -k "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -o "%TEMP_DIR%\\yt-dlp.exe" 2>nul
        if not exist "%TEMP_DIR%\\yt-dlp.exe" (
            powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '%TEMP_DIR%\\yt-dlp.exe'"
        )
    )
)

where ffmpeg >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if exist "%LOCALAPPDATA%\\Microsoft\\WinGet\\Packages" (
        for /d %%d in ("%LOCALAPPDATA%\\Microsoft\\WinGet\\Packages\\*ffmpeg*") do (
            if exist "%%d\\bin\\ffmpeg.exe" set "PATH=%%d\\bin;%PATH%"
            if exist "%%d\\ffmpeg-*\\bin\\ffmpeg.exe" for /d %%f in ("%%d\\ffmpeg-*") do set "PATH=%%f\\bin;%PATH%"
        )
    )
)

${linksBlock}

echo [1/4] Zahajuji stahovani playlistu...
%TARGET_CMD%
if %ERRORLEVEL% EQU 0 goto hotovo

echo [2/4] Zkousim stahovani se sezenim z Google Chrome...
%TARGET_CMD% --cookies-from-browser chrome
if %ERRORLEVEL% EQU 0 goto hotovo

echo [3/4] Zkousim stahovani se sezenim z prohlizece Edge...
%TARGET_CMD% --cookies-from-browser edge
if %ERRORLEVEL% EQU 0 goto hotovo

echo.
echo ===============================================================================
echo [UPOZORNENI] Nektere skladby se nepodarilo stahnout (ochrana YouTube).
echo ===============================================================================
pause
exit /b 1

:hotovo
echo.
echo ===============================================================================
echo   HOTOVO! Vsechny vybrane skladby z playlistu byly uspesne stazeny!
echo   Slozka: "%DEST_DIR%"
echo ===============================================================================
echo.
pause
explorer.exe "%DEST_DIR%"
exit /b 0
`;
}

/**
 * Generates single-line PowerShell command to download playlist
 */
export function generatePlaylistPowerShellCommand(options: {
  playlist: PlaylistInfo;
  format: DownloadFormat;
  quality: string;
}): string {
  const { playlist, format, quality } = options;
  const isAudio = format === 'mp3';
  const cleanTitle = (playlist.title || 'YouTube Playlist')
    .replace(/[/\\?%*:|"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (isAudio) {
    return `$d="$HOME\\Downloads\\${cleanTitle}"; if(!(Test-Path $d)){mkdir $d}; yt-dlp --extractor-args "youtube:player_client=android,web" -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata -o "$d/%(playlist_index)02d - %(title)s.%(ext)s" "${playlist.url}"`;
  }
  return `$d="$HOME\\Downloads\\${cleanTitle}"; if(!(Test-Path $d)){mkdir $d}; yt-dlp --extractor-args "youtube:player_client=android,web" -S "res:${quality},ext:mp4:m4a" -f "bestvideo[height<=${quality}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best" --merge-output-format mp4 -o "$d/%(playlist_index)02d - %(title)s.%(ext)s" "${playlist.url}"`;
}

/**
 * Generates a Windows batch script to split a video by chapters/tracklist into individual MP3 or MP4 files
 * into a dedicated folder inside Downloads, with numbering, cover art, and ID3 tags.
 */
export function generateSplitChaptersBatchScript(options: {
  video: VideoInfo;
  format: DownloadFormat;
  quality: string;
}): string {
  const { video, format, quality } = options;
  const isAudio = format === 'mp3';
  const extension = isAudio ? 'mp3' : 'mp4';
  const chapters = video.chapters || [];

  const safeVideoTitle = (video.title || 'Video')
    .replace(/[/\\?%*:|"<>]/g, ' ')
    .replace(/[&^`!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const folderName = `${safeVideoTitle} (Skladby)`;

  const dlArgs = isAudio
    ? `--extractor-args "youtube:player_client=android,web" -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata`
    : `--extractor-args "youtube:player_client=android,web" -S "res:${quality},ext:mp4:m4a" -f "bestvideo[height<=${quality}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best" --merge-output-format mp4`;

  let downloadCommands = '';
  if (chapters.length > 0) {
    downloadCommands = chapters.map((ch, idx) => {
      const num = (idx + 1).toString().padStart(2, '0');
      const safeChTitle = ch.title.replace(/[/\\?%*:|"<>]/g, ' ').replace(/[&^`!]/g, ' ').trim();
      return `echo [${num}/${chapters.length}] Stahuji: ${safeChTitle} (${ch.startTimeFormatted} - ${ch.endTimeFormatted})
"%YTDLP_EXE%" ${dlArgs} --download-sections "*${ch.startTimeFormatted}-${ch.endTimeFormatted}" -o "%DEST_DIR%\\${num} - ${safeChTitle}.%(ext)s" "${video.url}"`;
    }).join('\r\n\r\n');
  } else {
    downloadCommands = `echo Rozdeluji video podle kapitol...
"%YTDLP_EXE%" ${dlArgs} --split-chapters -o "chapter:%DEST_DIR%\\%(section_number)02d - %(section_title)s.%(ext)s" "${video.url}"`;
  }

  return `@echo off
chcp 65001 >nul
title YouTube Rozdelovac Kapitol - ${safeVideoTitle}
color 0b

echo ===============================================================================
echo        YouTube Rozdelovac Kapitol / Skladeb - ${safeVideoTitle}
echo ===============================================================================
echo.
echo Video: ${safeVideoTitle}
echo Pocet kapitol / skladeb: ${chapters.length > 0 ? chapters.length : 'Automaticka detekce'}
echo Format: ${extension.toUpperCase()} (${isAudio ? `${quality} kbps s ID3 tagy a obalem` : `${quality}p H.264 / AAC`})
echo Cilova slozka: %%USERPROFILE%\\Downloads\\${folderName}
echo.

set "TEMP_DIR=%TEMP%\\yt_downloader_pc"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
set "DEST_DIR=%USERPROFILE%\\Downloads\\${folderName}"
if not exist "%DEST_DIR%" mkdir "%DEST_DIR%"

set "YTDLP_EXE=yt-dlp"
where yt-dlp >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set "YTDLP_EXE=%TEMP_DIR%\\yt-dlp.exe"
    if not exist "%TEMP_DIR%\\yt-dlp.exe" (
        echo [INFO] Stahuji prenosny yt-dlp.exe z GitHubu...
        curl -L -k "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -o "%TEMP_DIR%\\yt-dlp.exe" 2>nul
        if not exist "%TEMP_DIR%\\yt-dlp.exe" (
            powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '%TEMP_DIR%\\yt-dlp.exe'"
        )
    )
)

where ffmpeg >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if exist "%LOCALAPPDATA%\\Microsoft\\WinGet\\Packages" (
        for /d %%d in ("%LOCALAPPDATA%\\Microsoft\\WinGet\\Packages\\*ffmpeg*") do (
            if exist "%%d\\bin\\ffmpeg.exe" set "PATH=%%d\\bin;%PATH%"
            if exist "%%d\\ffmpeg-*\\bin\\ffmpeg.exe" for /d %%f in ("%%d\\ffmpeg-*") do set "PATH=%%f\\bin;%PATH%"
        )
    )
)

${downloadCommands}

echo.
echo ===============================================================================
echo   HOTOVO! Vsechny skladby z videa byly uspesne rozdeleny a ulozeny!
echo   Slozka: "%DEST_DIR%"
echo ===============================================================================
echo.
pause
explorer.exe "%DEST_DIR%"
exit /b 0
`;
}

/**
 * Generates a Windows batch script to download a single specific chapter of a video
 */
export function generateSingleChapterBatchScript(options: {
  video: VideoInfo;
  chapter: VideoChapter;
  chapterIndex: number;
  format: DownloadFormat;
  quality: string;
}): string {
  const { video, chapter, chapterIndex, format, quality } = options;
  const num = (chapterIndex + 1).toString().padStart(2, '0');
  const safeChapterTitle = chapter.title.replace(/[/\\?%*:|"<>]/g, ' ').replace(/[&^`!]/g, ' ').trim();

  return generateWindowsBatchScript({
    url: video.url,
    title: `${num} - ${safeChapterTitle}`,
    format,
    quality,
    trimStart: chapter.startTimeFormatted,
    trimEnd: chapter.endTimeFormatted,
  });
}

/**
 * Generates single-line PowerShell command to split video into chapters
 */
export function generateSplitChaptersPowerShellCommand(options: {
  video: VideoInfo;
  format: DownloadFormat;
  quality: string;
}): string {
  const { video, format, quality } = options;
  const isAudio = format === 'mp3';
  const cleanTitle = (video.title || 'Video')
    .replace(/[/\\?%*:|"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (isAudio) {
    return `$d="$HOME\\Downloads\\${cleanTitle} (Skladby)"; if(!(Test-Path $d)){mkdir $d}; yt-dlp --extractor-args "youtube:player_client=android,web" -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata --split-chapters -o "chapter:$d/%(section_number)02d - %(section_title)s.%(ext)s" "${video.url}"`;
  }
  return `$d="$HOME\\Downloads\\${cleanTitle} (Skladby)"; if(!(Test-Path $d)){mkdir $d}; yt-dlp --extractor-args "youtube:player_client=android,web" -S "res:${quality},ext:mp4:m4a" -f "bestvideo[height<=${quality}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best" --merge-output-format mp4 --split-chapters -o "chapter:$d/%(section_number)02d - %(section_title)s.%(ext)s" "${video.url}"`;
}

/**
 * Triggers direct browser download for subtitles (.srt or .vtt)
 */
export async function downloadSubtitlesFile(options: {
  url: string;
  lang: string;
  format: 'srt' | 'vtt';
  title?: string;
  isAuto?: boolean;
}): Promise<void> {
  const { url, lang, format, title, isAuto } = options;
  const endpoint = `/api/subtitles?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang)}&format=${format}&isAuto=${isAuto ? 'true' : 'false'}`;

  const cleanTitle = (title || 'titulky')
    .replace(/[/\\?%*:|"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const filename = `${cleanTitle}_${lang}.${format}`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error(`Chyba serveru (${res.status})`);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch {
    // If blob fetch fails, fallback to direct navigation trigger
    const link = document.createElement('a');
    link.href = endpoint;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Generates a Windows Batch script to download subtitles (.srt or .vtt) to Downloads
 */
export function generateSubtitlesBatchScript(options: {
  video: VideoInfo;
  lang: string;
  format: 'srt' | 'vtt';
}): string {
  const { video, lang, format } = options;
  const cleanTitle = (video.title || 'Video')
    .replace(/[/\\?%*:|"<>]/g, ' ')
    .replace(/[&^`!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return `@echo off
chcp 65001 >nul
title Stazeni Titulku - ${cleanTitle}
color 0b

echo ===============================================================================
echo               YouTube Stahovac Titulku (.${format.toUpperCase()}) pro PC
echo ===============================================================================
echo.
echo Nazev: ${cleanTitle}
echo Jazyk: ${lang}
echo Format: .${format.toUpperCase()}
echo Cilova slozka: Vase slozka Stazene soubory (Downloads)
echo.

set "TEMP_DIR=%TEMP%\\yt_downloader_pc"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
set "YTDLP_EXE=yt-dlp"

where yt-dlp >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set "YTDLP_EXE=%TEMP_DIR%\\yt-dlp.exe"
    if not exist "%TEMP_DIR%\\yt-dlp.exe" (
        echo [INFO] Stahuji prenosny yt-dlp.exe z GitHubu...
        curl -L -k "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -o "%TEMP_DIR%\\yt-dlp.exe" 2>nul
        if not exist "%TEMP_DIR%\\yt-dlp.exe" (
            powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', '%TEMP_DIR%\\yt-dlp.exe')"
        )
    )
)

for /f "tokens=*" %%i in ('powershell -NoProfile -Command "[Environment]::GetFolderPath('UserProfile') + '\\Downloads'"') do set "DEST_DIR=%%i"
if "%DEST_DIR%"=="" set "DEST_DIR=%USERPROFILE%\\Downloads"

echo [1/1] Stahuji a prevadim titulky (${lang} -> .${format})...
"%YTDLP_EXE%" --no-check-certificates --skip-download --write-sub --write-auto-sub --sub-lang "${lang}" --convert-subs "${format}" -o "%DEST_DIR%\\%(title)s.%(ext)s" "${video.url}"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [POZOR] Zkousim stahnout titulky s autentizaci z prohlizece...
    for %%B in (edge chrome firefox brave) do (
        echo [*] Zkousim prohlizec %%B...
        "%YTDLP_EXE%" --cookies-from-browser %%B --no-check-certificates --skip-download --write-sub --write-auto-sub --sub-lang "${lang}" --convert-subs "${format}" -o "%DEST_DIR%\\%(title)s.%(ext)s" "${video.url}"
        if !ERRORLEVEL! EQU 0 goto :done
    )
)

:done
echo.
echo ===============================================================================
echo [HOTOVO] Titulky byly uspesne ulozeny do slozky Downloads!
echo ===============================================================================
echo.
pause
explorer.exe "%DEST_DIR%"
exit /b 0
`;
}

/**
 * Generates single-line PowerShell command to download subtitles
 */
export function generateSubtitlesPowerShellCommand(options: {
  video: VideoInfo;
  lang: string;
  format: 'srt' | 'vtt';
}): string {
  const { video, lang, format } = options;
  return `$url="${video.url}"; $o="$HOME\\Downloads\\%(title)s.%(ext)s"; yt-dlp --skip-download --write-sub --write-auto-sub --sub-lang "${lang}" --convert-subs "${format}" -o $o $url`;
}




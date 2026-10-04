import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { AudioBoostOption } from '../types';

export interface MemoryEstimate {
  isHeavy: boolean;
  estimatedVideoMb: number;
  estimatedAudioMb: number;
  totalEstimatedMb: number;
  recommendedOption: 'optionA' | 'optionC' | 'bat';
  reason?: string;
  deviceRamGb?: number;
}

/**
 * Estimates whether in-browser WebAssembly merging is safe or could cause an out-of-memory error.
 */
export function estimateMemoryRequirements(durationSeconds?: number, quality = '1080'): MemoryEstimate {
  const sec = durationSeconds && durationSeconds > 0 ? durationSeconds : 240;

  // Approximate bitrates based on YouTube DASH stream metrics:
  // 1080p AVC: ~4.5 - 6 Mbps -> ~35-40 MB per min
  // 720p: ~2.5 Mbps -> ~18-20 MB per min
  // 480p: ~1.2 Mbps -> ~10 MB per min
  // 4K (2160p): ~15-20 Mbps -> ~120 MB per min
  let mbPerMin = 36;
  if (quality === '2160') mbPerMin = 120;
  else if (quality === '1440') mbPerMin = 70;
  else if (quality === '720') mbPerMin = 20;
  else if (quality === '480') mbPerMin = 10;
  else if (quality === '360') mbPerMin = 6;

  const estimatedVideoMb = Math.round((sec / 60) * mbPerMin);
  const estimatedAudioMb = Math.round((sec / 60) * 1.5);
  const totalEstimatedMb = estimatedVideoMb + estimatedAudioMb;

  // WebAssembly in-browser requires holding:
  // 1. Input video array buffer
  // 2. Input audio array buffer
  // 3. Output video array buffer
  // Total browser RAM needed is ~2.5x to 3x total file size
  const ramNeededMb = Math.round(totalEstimatedMb * 2.8);

  const nav = typeof navigator !== 'undefined' ? (navigator as any) : {};
  const deviceRamGb = nav.deviceMemory || 4;
  const isLowRamDevice = deviceRamGb <= 4;

  // Threshold:
  // If required RAM in browser exceeds ~350 MB or video is longer than 15 minutes,
  // in-memory WebAssembly might cause the browser tab to freeze or crash (OOM).
  const isHeavy = totalEstimatedMb > 120 || sec > 900 || (isLowRamDevice && totalEstimatedMb > 70);

  let recommendedOption: 'optionA' | 'optionC' | 'bat' = 'optionA';
  let reason: string | undefined;

  if (totalEstimatedMb > 300 || sec > 1800) {
    recommendedOption = 'bat';
    reason = `Video je příliš velké (${Math.round(sec / 60)} minut, odhad ~${totalEstimatedMb} MB). Pro takto velká videa doporučujeme 1-klik .bat skript na PC, který má neomezenou paměť.`;
  } else if (isHeavy) {
    recommendedOption = 'optionC';
    reason = `Délka videa (${Math.round(sec / 60)} min) a odhadovaná velikost (~${totalEstimatedMb} MB) vyžadují v paměti prohlížeče cca ${ramNeededMb} MB volné RAM. Pro bezpečný chod bez pádu záložky doporučujeme Záložní slučovač (Možnost C) nebo .bat skript.`;
  }

  return {
    isHeavy,
    estimatedVideoMb,
    estimatedAudioMb,
    totalEstimatedMb,
    recommendedOption,
    reason,
    deviceRamGb,
  };
}

let ffmpegInstance: FFmpeg | null = null;
let isCoreLoaded = false;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Lazily loads the single-threaded FFmpeg WebAssembly core from Cloudflare CDN.
 * Single-threaded core does NOT require Cross-Origin-Opener-Policy headers,
 * making it universally compatible with any static hosting or shared environment.
 */
export async function getFFmpeg(onProgressMsg?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && isCoreLoaded) {
    return ffmpegInstance;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const ffmpeg = new FFmpeg();
      ffmpegInstance = ffmpeg;

      ffmpeg.on('log', ({ message }) => {
        if (onProgressMsg) onProgressMsg(message);
      });

      onProgressMsg?.('Načítám WebAssembly jádro FFmpeg do prohlížeče...');
      
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      isCoreLoaded = true;
      return ffmpeg;
    } catch (err) {
      loadPromise = null;
      isCoreLoaded = false;
      ffmpegInstance = null;
      throw new Error(`Nepodařilo se inicializovat WebAssembly slučovač: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();

  return loadPromise;
}

/**
 * Merges a video Blob/File and audio Blob/File into a unified MP4 file in browser memory
 * using ultra-fast lossless container multiplexing (-c copy).
 */
export async function mergeVideoAndAudioBlobs(
  videoBlobOrFile: Blob | File,
  audioBlobOrFile: Blob | File,
  onProgress?: (progressPct: number, stageMessage: string) => void,
  audioBoost: AudioBoostOption = 'none'
): Promise<Blob> {
  onProgress?.(5, 'Inicializuji WebAssembly slučovač v prohlížeči...');
  const ffmpeg = await getFFmpeg((msg) => {
    // Detect frame/time progress if available
    if (msg.includes('time=')) {
      onProgress?.(65, 'Zapisuji synchronizované stopy do MP4...');
    }
  });

  onProgress?.(20, 'Připravuji video stopu v paměti...');
  const videoData = await fetchFile(videoBlobOrFile);

  onProgress?.(40, 'Připravuji audio stopu v paměti...');
  const audioData = await fetchFile(audioBlobOrFile);

  const videoName = videoBlobOrFile instanceof File ? videoBlobOrFile.name.toLowerCase() : '';
  const audioName = audioBlobOrFile instanceof File ? audioBlobOrFile.name.toLowerCase() : '';

  const isVideoWebm = videoBlobOrFile.type.includes('webm') || videoName.endsWith('.webm');
  const isAudioWebm = audioBlobOrFile.type.includes('webm') || audioName.endsWith('.webm');
  const isAudioMp3 = audioBlobOrFile.type.includes('mpeg') || audioBlobOrFile.type.includes('mp3') || audioName.endsWith('.mp3');

  const vExt = isVideoWebm ? 'webm' : 'mp4';
  const aExt = isAudioWebm ? 'webm' : (isAudioMp3 ? 'mp3' : 'm4a');

  const inVideo = `in_video.${vExt}`;
  const inAudio = `in_audio.${aExt}`;
  const outVideo = 'merged_output.mp4';

  await ffmpeg.writeFile(inVideo, videoData);
  await ffmpeg.writeFile(inAudio, audioData);

  let execResult = -1;

  if (audioBoost && audioBoost !== 'none') {
    let af = 'volume=1.41';
    if (audioBoost === 'boost6') af = 'volume=2.0';
    else if (audioBoost === 'normalize') af = 'loudnorm=I=-16:TP=-1.5:LRA=11';

    onProgress?.(60, `Aplikuji úpravu hlasitosti (${audioBoost}) a slučuji stopy...`);
    execResult = await ffmpeg.exec([
      '-i', inVideo,
      '-i', inAudio,
      '-c:v', 'copy',
      '-af', af,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outVideo
    ]);
  } else {
    onProgress?.(60, 'Slučuji obraz a zvuk do jednoho souboru (lossless copy)...');
    execResult = await ffmpeg.exec([
      '-i', inVideo,
      '-i', inAudio,
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outVideo
    ]);

    if (execResult !== 0) {
      // If strict copy fails due to codec packaging or container mismatch, transcode audio to aac
      onProgress?.(70, 'Optimalizuji stopu pro Windows Media Player...');
      execResult = await ffmpeg.exec([
        '-i', inVideo,
        '-i', inAudio,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-strict', 'experimental',
        '-movflags', '+faststart',
        outVideo
      ]);
    }
  }

  onProgress?.(90, 'Generuji finální MP4 soubor...');
  const outputData = await ffmpeg.readFile(outVideo);

  // Clean virtual filesystem
  try {
    await ffmpeg.deleteFile(inVideo);
    await ffmpeg.deleteFile(inAudio);
    await ffmpeg.deleteFile(outVideo);
  } catch {
    // Ignore cleanup errors
  }

  onProgress?.(100, 'Sloučení úspěšně dokončeno!');
  return new Blob([outputData as unknown as BlobPart], { type: 'video/mp4' });
}

/**
 * Boosts or normalizes audio volume of an audio Blob using WebAssembly FFmpeg
 */
export async function boostAudioOnlyBlob(
  audioBlobOrFile: Blob | File,
  boost: AudioBoostOption,
  onProgress?: (progressPct: number, stageMessage: string) => void
): Promise<Blob> {
  if (boost === 'none') return audioBlobOrFile;

  onProgress?.(10, 'Připravuji zvukovou stopu v paměti...');
  const ffmpeg = await getFFmpeg();
  const audioData = await fetchFile(audioBlobOrFile);

  let af = 'volume=1.41';
  if (boost === 'boost6') af = 'volume=2.0';
  else if (boost === 'normalize') af = 'loudnorm=I=-16:TP=-1.5:LRA=11';

  const inAudio = 'in_boost_audio.mp3';
  const outAudio = 'out_boost_audio.mp3';

  await ffmpeg.writeFile(inAudio, audioData);
  onProgress?.(40, `Zpracovávám úpravu hlasitosti (${boost})...`);

  await ffmpeg.exec([
    '-i', inAudio,
    '-af', af,
    '-c:a', 'libmp3lame',
    '-b:a', '320k',
    outAudio
  ]);

  onProgress?.(90, 'Generuji upravený zvukový soubor...');
  const outputData = await ffmpeg.readFile(outAudio);

  try {
    await ffmpeg.deleteFile(inAudio);
    await ffmpeg.deleteFile(outAudio);
  } catch {}

  onProgress?.(100, 'Hlasitost byla úspěšně upravena!');
  return new Blob([outputData as unknown as BlobPart], { type: 'audio/mpeg' });
}

export interface ExtractAudioOptions {
  bitrate?: string;
  audioBoost?: AudioBoostOption;
  trimStart?: string;
  trimEnd?: string;
  onProgress?: (progressPct: number, stageMessage: string) => void;
}

/**
 * Extracts pure audio from any media Blob (video or audio) and converts it to 100% video-free MP3 using WebAssembly FFmpeg.
 */
export async function extractAudioToMp3(
  sourceBlobOrFile: Blob | File,
  options: ExtractAudioOptions = {}
): Promise<Blob> {
  const { bitrate = '320', audioBoost = 'none', trimStart, trimEnd, onProgress } = options;

  onProgress?.(10, 'Inicializuji WebAssembly audio procesor...');
  const ffmpeg = await getFFmpeg((msg) => {
    if (msg.includes('time=')) {
      onProgress?.(60, 'Převádím zvukovou stopu do čistého MP3...');
    }
  });

  onProgress?.(25, 'Načítám data stopy do virtuální paměti...');
  const mediaData = await fetchFile(sourceBlobOrFile);

  const isWebm = sourceBlobOrFile.type.includes('webm');
  const inExt = isWebm ? 'webm' : 'mp4';
  const timestamp = Date.now();
  const inMedia = `in_media_${timestamp}.${inExt}`;
  const outAudio = `out_pure_${timestamp}.mp3`;

  await ffmpeg.writeFile(inMedia, mediaData);

  const ffmpegArgs: string[] = [];

  // Trimming parameters before input
  if (trimStart && trimStart.trim()) {
    ffmpegArgs.push('-ss', trimStart.trim());
  }
  if (trimEnd && trimEnd.trim()) {
    ffmpegArgs.push('-to', trimEnd.trim());
  }

  ffmpegArgs.push('-i', inMedia);

  // Strictly strip video track (-vn)
  ffmpegArgs.push('-vn');

  // Audio filter if boost requested
  if (audioBoost && audioBoost !== 'none') {
    let af = 'volume=1.41';
    if (audioBoost === 'boost6') af = 'volume=2.0';
    else if (audioBoost === 'normalize') af = 'loudnorm=I=-16:TP=-1.5:LRA=11';
    ffmpegArgs.push('-af', af);
  }

  // Pure MP3 audio encoding with exact Constant Bitrate (CBR)
  const targetBitrate = `${bitrate || '320'}k`;
  ffmpegArgs.push('-c:a', 'libmp3lame', '-b:a', targetBitrate, outAudio);

  onProgress?.(50, `Kóduji čisté MP3 (${targetBitrate}, bez obrazové stopy)...`);
  let execResult = await ffmpeg.exec(ffmpegArgs);

  if (execResult !== 0) {
    // Fallback attempt without -q:a
    onProgress?.(70, 'Zkouším univerzální MP3 kódování...');
    execResult = await ffmpeg.exec([
      '-i', inMedia,
      '-vn',
      '-b:a', targetBitrate,
      outAudio
    ]);
  }

  if (execResult !== 0) {
    throw new Error('Převod audia do MP3 selhal v modulu WebAssembly.');
  }

  onProgress?.(90, 'Generuji finální MP3 soubor...');
  const outputData = await ffmpeg.readFile(outAudio);

  try {
    await ffmpeg.deleteFile(inMedia);
    await ffmpeg.deleteFile(outAudio);
  } catch {}

  onProgress?.(100, 'Čisté MP3 je připraveno ke stažení!');
  return new Blob([outputData as unknown as BlobPart], { type: 'audio/mpeg' });
}


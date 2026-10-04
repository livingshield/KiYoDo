import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = process.platform === 'win32';
const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Prepare temporary directory for downloads
const DOWNLOADS_DIR = path.join(os.tmpdir(), 'yt_downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  try {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  } catch (err) {
    console.error('Could not create temp downloads dir:', err);
  }
}

// Local binary path
const LOCAL_BIN_DIR = path.join(__dirname, 'bin');
const binName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const YTDLP_BIN = path.join(LOCAL_BIN_DIR, binName);

function ensureYtDlpBinary() {
  if (fs.existsSync(YTDLP_BIN)) {
    try {
      if (!isWindows) fs.chmodSync(YTDLP_BIN, 0o755);
      return YTDLP_BIN;
    } catch {
      // ignore
    }
  }

  // Check if system has yt-dlp in PATH
  try {
    const cmd = isWindows ? 'where yt-dlp' : 'which yt-dlp';
    const sysPath = execSync(cmd, { encoding: 'utf-8' }).trim().split(/\r?\n/)[0];
    if (sysPath && fs.existsSync(sysPath)) return sysPath;
  } catch {
    // not in path
  }

  // Check /tmp or temp dir
  const tempFallback = path.join(os.tmpdir(), binName);
  if (fs.existsSync(tempFallback)) {
    try {
      if (!fs.existsSync(LOCAL_BIN_DIR)) fs.mkdirSync(LOCAL_BIN_DIR, { recursive: true });
      fs.copyFileSync(tempFallback, YTDLP_BIN);
      if (!isWindows) fs.chmodSync(YTDLP_BIN, 0o755);
      return YTDLP_BIN;
    } catch {
      return tempFallback;
    }
  }

  // Fallback to /tmp/yt-dlp on Linux
  if (!isWindows && fs.existsSync('/tmp/yt-dlp')) {
    return '/tmp/yt-dlp';
  }

  // Download standalone binary
  try {
    if (!fs.existsSync(LOCAL_BIN_DIR)) fs.mkdirSync(LOCAL_BIN_DIR, { recursive: true });
    if (isWindows) {
      execSync(`curl -L -k "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -o "${YTDLP_BIN}"`);
    } else {
      execSync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${YTDLP_BIN}" && chmod +x "${YTDLP_BIN}"`);
    }
    return YTDLP_BIN;
  } catch (e) {
    console.error('Failed to download yt-dlp:', e);
    return isWindows ? 'yt-dlp.exe' : 'yt-dlp';
  }
}

const activeYtDlpPath = ensureYtDlpBinary();
console.log('yt-dlp binary ready at:', activeYtDlpPath);

// Job tracking
interface Job {
  id: string;
  status: 'queued' | 'downloading' | 'converting' | 'completed' | 'error';
  percent: number;
  message: string;
  filename?: string;
  filePath?: string;
  fileSize?: number;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

// Clean up old jobs after 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 30 * 60 * 1000) {
      if (job.filePath && fs.existsSync(job.filePath)) {
        try {
          fs.unlinkSync(job.filePath);
        } catch {
          // ignore
        }
      }
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

function formatSeconds(totalSec: number): string {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseChaptersFromText(text?: string, totalDuration: number = 0): Array<{
  title: string;
  startTime: number;
  endTime: number;
  startTimeFormatted: string;
  endTimeFormatted: string;
}> {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const regex = /(?:^|\s)(?:\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?)\s*[-–—:]?\s*(.+)$/;
  const parsed: Array<{
    title: string;
    startTime: number;
    endTime: number;
    startTimeFormatted: string;
    endTimeFormatted: string;
  }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(regex);
    if (match) {
      const timeStr = match[1];
      const title = match[2].trim().replace(/^[-–—:]\s*/, '');
      const parts = timeStr.split(':').map(Number);
      let sec = 0;
      if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
      parsed.push({ title, startTime: sec, endTime: 0, startTimeFormatted: timeStr, endTimeFormatted: '' });
    }
  }

  if (parsed.length === 0) return [];

  for (let i = 0; i < parsed.length; i++) {
    if (i < parsed.length - 1) {
      parsed[i].endTime = parsed[i + 1].startTime;
    } else {
      parsed[i].endTime = totalDuration || (parsed[i].startTime + 180);
    }
    parsed[i].endTimeFormatted = formatSeconds(parsed[i].endTime);
  }

  return parsed;
}

// API 1: Extract Video Info
app.get('/api/info', async (req, res) => {
  const videoUrl = req.query.url as string;
  if (!videoUrl) {
    return res.status(400).json({ error: 'URL videa je povinná' });
  }

  const cleanUrl = videoUrl.trim().replace(/["\r\n\t]/g, '');

  // Extract YouTube ID if present
  const idMatch = cleanUrl.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  const videoId = idMatch ? idMatch[1] : null;

  // 1. Official YouTube oEmbed & Rich HTML metadata extraction (views, upload date, duration)
  if (videoId || cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
    try {
      const effectiveId = videoId || 'video';
      let title = 'YouTube Video';
      let author = 'YouTube';
      let thumbnailUrl = effectiveId !== 'video'
        ? `https://i.ytimg.com/vi/${effectiveId}/hqdefault.jpg`
        : '';
      let duration: string | undefined = undefined;
      let durationSeconds: number | undefined = undefined;
      let viewCount: string | undefined = undefined;
      let uploadDate: string | undefined = undefined;

      // Parallel fetch: oEmbed + Watch page HTML
      const oembedPromise = fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }
      ).then(async (r) => (r.ok ? r.json() : null)).catch(() => null);

      const htmlPromise = effectiveId && effectiveId !== 'video'
        ? fetch(`https://www.youtube.com/watch?v=${effectiveId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          }).then(async (r) => (r.ok ? r.text() : '')).catch(() => '')
        : Promise.resolve('');

      const [oembedData, html] = await Promise.all([oembedPromise, htmlPromise]);

      if (oembedData) {
        title = oembedData.title || title;
        author = oembedData.author_name || author;
        if (oembedData.thumbnail_url && !thumbnailUrl) {
          thumbnailUrl = oembedData.thumbnail_url;
        }
      }

      let description = '';
      let chapters: any[] = [];
      let subtitles: any[] = [];

      if (html) {
        // Extract views count
        const viewsMatch = html.match(/"viewCount":"(\d+)"/) || html.match(/<meta itemprop="interactionCount" content="(\d+)"/);
        if (viewsMatch && viewsMatch[1]) {
          viewCount = Number(viewsMatch[1]).toLocaleString('cs-CZ');
        }

        // Extract upload date
        const dateMatch = html.match(/"uploadDate":"([^"]+)"/) || html.match(/<meta itemprop="uploadDate" content="([^"]+)"/) || html.match(/"publishDate":"([^"]+)"/);
        if (dateMatch && dateMatch[1]) {
          uploadDate = dateMatch[1].split('T')[0];
        }

        // Extract duration
        const durSecondsMatch = html.match(/"lengthSeconds":"(\d+)"/);
        if (durSecondsMatch && durSecondsMatch[1]) {
          const totalSec = parseInt(durSecondsMatch[1], 10);
          durationSeconds = totalSec;
          duration = formatSeconds(totalSec);
        }

        // Extract shortDescription
        const descMatch = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
        if (descMatch && descMatch[1]) {
          try {
            description = JSON.parse(`"${descMatch[1]}"`);
            chapters = parseChaptersFromText(description, durationSeconds || 0);
          } catch {
            // ignore
          }
        }

        // Extract captionTracks
        const captionMatch = html.match(/"captionTracks":(\[.*?\])/);
        if (captionMatch && captionMatch[1]) {
          try {
            const rawCaps = JSON.parse(captionMatch[1]);
            subtitles = rawCaps.map((c: any) => ({
              code: c.languageCode || '',
              name: (c.name && c.name.simpleText) ? c.name.simpleText : (c.languageCode || ''),
              isAutoGenerated: (c.vssId || '').startsWith('a.'),
              url: c.baseUrl || '',
            })).filter((c: any) => c.code);
          } catch {
            // ignore
          }
        }
      }

      let maxQuality: string | undefined = undefined;
      let availableQualities: string[] = ['1080', '720', '480', '360'];
      let rawMaxHeight: number | undefined = undefined;

      if (html) {
        const qualityMatches = [...html.matchAll(/"qualityLabel":"(\d+)p/g)].map(m => parseInt(m[1], 10));
        const heightMatches = [...html.matchAll(/"height":(\d+)/g)].map(m => parseInt(m[1], 10));
        const allHeights = [...new Set([...qualityMatches, ...heightMatches])].filter(h => h >= 144 && h <= 4320);

        if (allHeights.length > 0) {
          rawMaxHeight = Math.max(...allHeights);
          const std = ['1080', '720', '480', '360'];
          const filtered = std.filter(q => parseInt(q, 10) <= rawMaxHeight!);
          availableQualities = filtered.length > 0 ? filtered : ['360'];
          maxQuality = availableQualities[0];
        }
      }

      if (oembedData || html) {
        return res.json({
          id: effectiveId,
          title,
          author,
          thumbnailUrl,
          duration,
          durationSeconds,
          viewCount,
          uploadDate,
          description,
          chapters,
          subtitles,
          maxQuality,
          availableQualities,
          rawMaxHeight,
        });
      }
    } catch {
      // Fall through to secondary extractors
    }
  }

  // 2. Secondary fallback using yt-dlp (safely executed with stderr ignored)
  try {
    const output = execSync(
      `"${activeYtDlpPath}" --no-check-certificates --dump-json --no-playlist --skip-download "${cleanUrl}"`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 8000, stdio: ['pipe', 'pipe', 'ignore'] }
    );
    const data = JSON.parse(output);

    let maxQuality: string | undefined = undefined;
    let availableQualities: string[] = ['1080', '720', '480', '360'];
    let rawMaxHeight = data.height;
    if (data.formats && Array.isArray(data.formats)) {
      const fHeights = data.formats.map((f: any) => f.height).filter((h: any) => typeof h === 'number' && h >= 144);
      if (fHeights.length > 0) {
        rawMaxHeight = Math.max(...fHeights);
      }
    }
    if (rawMaxHeight) {
      const std = ['1080', '720', '480', '360'];
      const filtered = std.filter((q: string) => parseInt(q, 10) <= rawMaxHeight);
      availableQualities = filtered.length > 0 ? filtered : ['360'];
      maxQuality = availableQualities[0];
    }

    let chapters: any[] = [];
    if (data.chapters && Array.isArray(data.chapters) && data.chapters.length > 0) {
      chapters = data.chapters.map((ch: any) => ({
        title: ch.title || 'Kapitola',
        startTime: ch.start_time || 0,
        endTime: ch.end_time || 0,
        startTimeFormatted: formatSeconds(ch.start_time || 0),
        endTimeFormatted: formatSeconds(ch.end_time || 0),
      }));
    } else if (data.description) {
      chapters = parseChaptersFromText(data.description, data.duration || 0);
    }

    const subtitles: any[] = [];
    if (data.subtitles && typeof data.subtitles === 'object') {
      for (const [code, formats] of Object.entries(data.subtitles)) {
        subtitles.push({
          code,
          name: code,
          isAutoGenerated: false,
        });
      }
    }
    if (data.automatic_captions && typeof data.automatic_captions === 'object') {
      for (const [code, formats] of Object.entries(data.automatic_captions)) {
        if (!subtitles.some(s => s.code === code)) {
          subtitles.push({
            code,
            name: `${code} (auto)`,
            isAutoGenerated: true,
          });
        }
      }
    }

    return res.json({
      id: data.id,
      title: data.title || 'Neznámý název',
      author: data.uploader || data.channel || 'Neznámý autor',
      duration: data.duration_string || (data.duration ? formatSeconds(data.duration) : undefined),
      durationSeconds: data.duration,
      thumbnailUrl: data.thumbnail || (data.id ? `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg` : ''),
      viewCount: data.view_count ? Number(data.view_count).toLocaleString('cs-CZ') : undefined,
      uploadDate: data.upload_date ? `${data.upload_date.slice(0, 4)}-${data.upload_date.slice(4, 6)}-${data.upload_date.slice(6, 8)}` : undefined,
      description: data.description || '',
      chapters,
      subtitles,
      maxQuality,
      availableQualities,
      rawMaxHeight,
      directDownloadUrl: data.url || (data.formats && Array.isArray(data.formats) ? (data.formats.find((f: any) => f.url && f.ext === 'mp4')?.url || data.formats.slice(-1)[0]?.url) : undefined),
      authorUrl: data.uploader_url || data.channel_url || undefined,
    });
  } catch {
    // Graceful fallback if videoId is known
    if (videoId) {
      return res.json({
        id: videoId,
        title: `YouTube Video (${videoId})`,
        author: 'YouTube',
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      });
    }

    return res.status(500).json({ error: 'Nepodařilo se načíst informace o videu. Zkontrolujte prosím odkaz.' });
  }
});

// API: Stream Audio Only (Direct Audio Stream for Data Saver Mode)
app.get('/api/audio-stream', async (req, res) => {
  const videoUrl = req.query.url as string;
  if (!videoUrl) {
    return res.status(400).json({ error: 'URL videa je povinná' });
  }

  const cleanUrl = videoUrl.trim().replace(/["\r\n\t]/g, '');

  try {
    const streamUrl = execSync(
      `"${activeYtDlpPath}" --no-check-certificates -g -f "ba/b" --no-playlist "${cleanUrl}"`,
      { encoding: 'utf-8', timeout: 8000, stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim().split(/\r?\n/)[0];

    if (streamUrl && (streamUrl.startsWith('http://') || streamUrl.startsWith('https://'))) {
      return res.redirect(streamUrl);
    }

    return res.status(404).json({ error: 'Audio stopa nebyla nalezena.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Chyba při extrakci audia: ' + (err.message || 'Neznámá chyba') });
  }
});

// API: Download Subtitles (.srt / .vtt)
app.get('/api/subtitles', async (req, res) => {
  const videoUrl = (req.query.url || req.query.videoId) as string;
  const lang = ((req.query.lang as string) || 'cs').toLowerCase();
  const format = ((req.query.format as string) || 'srt').toLowerCase();

  if (!videoUrl) {
    return res.status(400).json({ error: 'URL nebo videoId je povinné' });
  }

  const idMatch = videoUrl.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/|\/shorts\/|^)([a-zA-Z0-9_-]{11})/);
  const videoId = idMatch ? idMatch[1] : videoUrl;

  try {
    // 1. Zkusit stáhnout z YouTube timedtext přímo
    const timedTextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=vtt`;
    const subRes = await fetch(timedTextUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (subRes.ok) {
      const vttText = await subRes.text();
      if (vttText && vttText.includes('-->')) {
        let outputContent = vttText;
        let contentType = 'text/vtt; charset=utf-8';
        let fileExt = 'vtt';

        if (format === 'srt') {
          fileExt = 'srt';
          contentType = 'application/x-subrip; charset=utf-8';
          const lines = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          const srtLines: string[] = [];
          let srtIdx = 1;
          let inHeader = true;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (inHeader) {
              if (line.trim() === 'WEBVTT' || line.startsWith('Kind:') || line.startsWith('Language:')) {
                continue;
              }
              if (line.trim() === '') {
                inHeader = false;
                continue;
              }
            }

            if (line.includes('-->')) {
              srtLines.push(String(srtIdx++));
              const srtTime = line.replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, '$1,$2');
              srtLines.push(srtTime);
            } else {
              srtLines.push(line);
            }
          }
          outputContent = srtLines.join('\r\n');
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${videoId}_${lang}.${fileExt}"`);
        return res.send(outputContent);
      }
    }

    // 2. Fallback přes yt-dlp
    const tempDir = path.join(os.tmpdir(), `ytsub_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
      execSync(
        `"${activeYtDlpPath}" --skip-download --write-sub --write-auto-sub --sub-lang "${lang}" --convert-subs "${format}" -o "${tempDir}/sub.%(ext)s" "https://www.youtube.com/watch?v=${videoId}"`,
        { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'ignore'] }
      );
      const subFiles = fs.readdirSync(tempDir);
      const targetSub = subFiles.find(f => f.endsWith(`.${format}`) || f.endsWith('.srt') || f.endsWith('.vtt'));
      if (targetSub) {
        const fullPath = path.join(tempDir, targetSub);
        const subData = fs.readFileSync(fullPath);
        res.setHeader('Content-Type', format === 'vtt' ? 'text/vtt; charset=utf-8' : 'application/x-subrip; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${videoId}_${lang}.${format}"`);
        return res.send(subData);
      }
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }

    return res.status(404).json({ error: 'Titulky pro zadaný jazyk nebyly nalezeny.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Chyba při stahování titulků: ' + err.message });
  }
});

// API: Extract Playlist Info
app.get('/api/playlist', async (req, res) => {
  const playlistUrl = req.query.url as string;
  if (!playlistUrl) {
    return res.status(400).json({ error: 'URL playlistu je povinná' });
  }

  const cleanUrl = playlistUrl.trim().replace(/["\r\n\t]/g, '');
  const listMatch = cleanUrl.match(/[?&]list=([a-zA-Z0-9_-]+)/) || cleanUrl.match(/^(?:PL|UU|LL|FL|RD|OLAK5uy_)[a-zA-Z0-9_-]+$/);
  const playlistId = listMatch ? (listMatch[1] || listMatch[0]) : null;

  if (!playlistId) {
    return res.status(400).json({ error: 'Neplatná adresa playlistu (chybí parametr list=)' });
  }

  const standardUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

  // 1. Primary: yt-dlp flat-playlist extraction
  try {
    const output = execSync(
      `"${activeYtDlpPath}" --no-check-certificates --flat-playlist --dump-single-json --skip-download "${standardUrl}"`,
      { encoding: 'utf-8', maxBuffer: 30 * 1024 * 1024, timeout: 25000, stdio: ['pipe', 'pipe', 'ignore'] }
    );
    const data = JSON.parse(output);

    const videos = (data.entries || []).map((e: any, index: number) => {
      const vid = e.id;
      const totalSec = typeof e.duration === 'number' ? e.duration : 0;
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const durationStr = hrs > 0 
        ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins}:${secs.toString().padStart(2, '0')}`;

      const thumb = (e.thumbnails && Array.isArray(e.thumbnails) && e.thumbnails.length > 0)
        ? e.thumbnails[e.thumbnails.length - 1].url
        : (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : '');

      return {
        id: vid,
        url: `https://www.youtube.com/watch?v=${vid}`,
        title: e.title || `Video ${index + 1}`,
        author: e.uploader || e.channel || data.uploader || 'YouTube',
        duration: durationStr,
        durationSeconds: totalSec,
        thumbnailUrl: thumb,
      };
    }).filter((v: any) => v.id);

    const playlistThumb = (data.thumbnails && Array.isArray(data.thumbnails) && data.thumbnails.length > 0)
      ? data.thumbnails[data.thumbnails.length - 1].url
      : (videos[0]?.thumbnailUrl || '');

    return res.json({
      id: data.id || playlistId,
      url: standardUrl,
      title: data.title || 'YouTube Playlist',
      author: data.uploader || data.channel || 'YouTube',
      thumbnailUrl: playlistThumb,
      videoCount: videos.length,
      videos,
    });
  } catch {
    // 2. Fallback: Parse web HTML ytInitialData
    try {
      const response = await fetch(standardUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'cs,en;q=0.9',
        },
      });

      if (response.ok) {
        const html = await response.text();
        const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s) || html.match(/var ytInitialData\s*=\s*({.+?});/);
        if (match) {
          const data = JSON.parse(match[1]);
          const metaTitle = data.metadata?.playlistMetadataRenderer?.title || 'YouTube Playlist';
          const metaAuthor = data.header?.playlistHeaderRenderer?.ownerText?.runs?.[0]?.text || 'YouTube';

          const videos: Array<{
            id: string;
            url: string;
            title: string;
            author: string;
            duration: string;
            durationSeconds: number;
            thumbnailUrl: string;
          }> = [];

          function walk(obj: any) {
            if (!obj || typeof obj !== 'object') return;
            if (obj.playlistVideoRenderer && obj.playlistVideoRenderer.videoId) {
              const pv = obj.playlistVideoRenderer;
              const vid = pv.videoId;
              const title = pv.title?.runs?.[0]?.text || pv.title?.simpleText || 'Video';
              const author = pv.shortBylineText?.runs?.[0]?.text || metaAuthor;
              const duration = pv.lengthText?.simpleText || 'Neznámá';
              const durationSeconds = pv.lengthSeconds ? parseInt(pv.lengthSeconds, 10) : 0;
              const thumb = pv.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;

              videos.push({
                id: vid,
                url: `https://www.youtube.com/watch?v=${vid}`,
                title,
                author,
                duration,
                durationSeconds,
                thumbnailUrl: thumb,
              });
            }
            for (const k of Object.keys(obj)) {
              walk(obj[k]);
            }
          }

          walk(data);

          if (videos.length > 0) {
            return res.json({
              id: playlistId,
              url: standardUrl,
              title: metaTitle,
              author: metaAuthor,
              thumbnailUrl: videos[0]?.thumbnailUrl || '',
              videoCount: videos.length,
              videos,
            });
          }
        }
      }
    } catch {
      // ignore
    }

    return res.status(500).json({ error: 'Nepodařilo se načíst playlist. Zkontrolujte prosím odkaz.' });
  }
});


// Helper to parse relative date into seconds for sorting
function parseRelativeTimeToSeconds(text?: string): number {
  if (!text) return Infinity;
  const lower = text.toLowerCase().trim();

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

// API: Search YouTube Videos
app.get('/api/search', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const sortBy = req.query.sortBy === 'relevance' ? 'relevance' : 'date';
  if (!query) {
    return res.json({ results: [] });
  }

  try {
    const spParam = sortBy === 'date' ? '&sp=CAISAhAB' : '';
    const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${spParam}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'cs,en;q=0.9',
      },
    });

    if (!response.ok) {
      return res.json({ results: [] });
    }

    const html = await response.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s) || html.match(/var ytInitialData\s*=\s*({.+?});/);
    if (!match) {
      return res.json({ results: [] });
    }

    const data = JSON.parse(match[1]);
    const items: Array<{
      id: string;
      url: string;
      title: string;
      author: string;
      duration?: string;
      viewCount?: string;
      publishedTime?: string;
      thumbnailUrl: string;
    }> = [];
    const seen = new Set<string>();

    // Recursively walk tree to find videoRenderers
    function walk(obj: any) {
      if (!obj || typeof obj !== 'object') return;
      if (obj.videoRenderer && obj.videoRenderer.videoId) {
        const v = obj.videoRenderer;
        if (!seen.has(v.videoId)) {
          seen.add(v.videoId);
          items.push({
            id: v.videoId,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
            title: v.title?.runs?.[0]?.text || v.title?.simpleText || 'YouTube Video',
            author: v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || 'YouTube',
            duration: v.lengthText?.simpleText || undefined,
            viewCount: v.viewCountText?.simpleText || v.shortViewCountText?.simpleText || undefined,
            publishedTime: v.publishedTimeText?.simpleText || undefined,
            thumbnailUrl: v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
          });
        }
      }
      for (const k of Object.keys(obj)) {
        walk(obj[k]);
      }
    }

    walk(data);

    let finalItems = items;
    if (sortBy === 'date') {
      finalItems = items.slice().sort((a, b) => {
        return parseRelativeTimeToSeconds(a.publishedTime) - parseRelativeTimeToSeconds(b.publishedTime);
      });
    }

    return res.json({ results: finalItems.slice(0, 30) });
  } catch (err) {
    console.error('Search error:', err);
    return res.json({ results: [] });
  }
});

// API: Search Autocomplete Suggestions
app.get('/api/suggest', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) {
    return res.json({ suggestions: [] });
  }

  try {
    const response = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'cs,en;q=0.9',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return res.json({ suggestions: data[1] });
      }
    }
  } catch {
    // ignore
  }

  return res.json({ suggestions: [] });
});

// API 2: Start Conversion Job
app.post('/api/convert', (req, res) => {
  const { url, format = 'mp3', quality = '320', trimStart, trimEnd } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL videa je povinná' });
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const isAudio = format === 'mp3';
  const ext = isAudio ? 'mp3' : 'mp4';
  const outputTemplate = path.join(DOWNLOADS_DIR, `${jobId}.%(ext)s`);

  const job: Job = {
    id: jobId,
    status: 'queued',
    percent: 0,
    message: 'Příprava stahovače...',
    createdAt: Date.now(),
  };
  jobs.set(jobId, job);

  // Build command args with visionos client (bypasses datacenter bot block without PO token)
  const args: string[] = [
    '--newline',
    '--no-playlist',
    '--no-check-certificates',
    '--extractor-args',
    'youtube:player_client=visionos,android',
    '--js-runtimes',
    'node',
  ];

  if (trimStart || trimEnd) {
    let rangeArg = '*';
    if (trimStart) rangeArg += trimStart;
    rangeArg += '-';
    if (trimEnd) rangeArg += trimEnd;
    args.push('--download-sections', rangeArg);
  }

  if (isAudio) {
    args.push('-x', '--audio-format', 'mp3');
    // Map quality
    const qMap: Record<string, string> = {
      '320': '0',
      '256': '2',
      '192': '4',
      '128': '6',
    };
    args.push('--audio-quality', qMap[quality] || '0');
    args.push('--embed-thumbnail', '--add-metadata');
  } else {
    const height = parseInt(quality, 10) || 1080;
    args.push('-f', `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`);
    args.push('--merge-output-format', 'mp4');
  }

  args.push('-o', outputTemplate, url);

  console.log(`Starting job ${jobId}: ${activeYtDlpPath} ${args.join(' ')}`);

  const proc = spawn(activeYtDlpPath, args);

  job.status = 'downloading';
  job.message = 'Stahuji video z YouTube...';

  const stderrChunks: string[] = [];

  proc.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    // Parse progress: [download]  45.2% of  15.20MiB
    const match = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
    if (match) {
      const pct = parseFloat(match[1]);
      job.percent = Math.min(95, Math.max(job.percent, Math.floor(pct)));
      job.message = `Stahuji do serveru: ${job.percent}%`;
    }

    if (text.includes('[ExtractAudio]') || text.includes('[ffmpeg]') || text.includes('[Merger]')) {
      job.status = 'converting';
      job.percent = 90;
      job.message = isAudio ? 'Převádím audio do MP3 (ffmpeg)...' : 'Slučuji video a zvuk do MP4...';
    }

    if (text.includes('[download] 100%')) {
      job.percent = 95;
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stderrChunks.push(text);
  });

  proc.on('close', (code) => {
    if (code === 0) {
      // Find created file
      const expectedFile = path.join(DOWNLOADS_DIR, `${jobId}.${ext}`);
      if (fs.existsSync(expectedFile)) {
        const stat = fs.statSync(expectedFile);
        job.status = 'completed';
        job.percent = 100;
        job.message = 'Hotovo! Soubor je připraven k uložení.';
        job.filePath = expectedFile;
        job.fileSize = stat.size;
        job.filename = `yt_${isAudio ? 'audio' : 'video'}_${jobId.slice(-6)}.${ext}`;
      } else {
        // Look for any file matching jobId
        const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(jobId));
        if (files.length > 0) {
          const found = path.join(DOWNLOADS_DIR, files[0]);
          const stat = fs.statSync(found);
          job.status = 'completed';
          job.percent = 100;
          job.message = 'Hotovo! Soubor je připraven k uložení.';
          job.filePath = found;
          job.fileSize = stat.size;
          job.filename = files[0];
        } else {
          job.status = 'error';
          job.error = 'Výstupní soubor nebyl nalezen po dokončení konverze.';
        }
      }
    } else {
      job.status = 'error';
      const fullStderr = stderrChunks.join('\n');
      if (fullStderr.includes('Sign in to confirm you’re not a bot') || fullStderr.includes('bot')) {
        job.error = 'YouTube zablokoval cloudový server ochranou proti robotům (Sign in to confirm you’re not a bot). Stáhněte si prosím 1-klik skript (.bat) níže – z vašeho PC proběhne stažení spolehlivě.';
      } else if (fullStderr.includes('Private video')) {
        job.error = 'Toto video je soukromé.';
      } else if (fullStderr.includes('Video unavailable')) {
        job.error = 'Video je nedostupné nebo smazané.';
      } else if (fullStderr.includes('age-restricted') || fullStderr.includes('Sign in to view')) {
        job.error = 'Video vyžaduje ověření věku (Age-restricted). Použijte skript pro PC.';
      } else {
        // Extract error line from stderr if available
        const errLine = fullStderr.split('\n').find(l => l.includes('ERROR:')) || `Chyba stahování (kód: ${code})`;
        job.error = errLine.replace(/ERROR:\s*\[youtube\]\s*/i, '').trim();
      }
    }
  });

  proc.on('error', (err) => {
    job.status = 'error';
    job.error = `Chyba procesu: ${err.message}`;
  });

  res.json({ jobId });
});

// API 3: Get Job Progress
app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Úloha nebyla nalezena nebo expirovala.' });
  }

  res.json({
    id: job.id,
    status: job.status,
    percent: job.percent,
    message: job.message,
    fileSize: job.fileSize,
    error: job.error,
  });
});

// API 4: Download the Resulting File
app.get('/api/download/:jobId', (req, res) => {
  const { jobId } = req.params;
  const customTitle = (req.query.title as string) || '';
  const job = jobs.get(jobId);

  if (!job || !job.filePath || !fs.existsSync(job.filePath)) {
    return res.status(404).send('Soubor vypršel nebo ještě nebyl dokončen.');
  }

  const ext = path.extname(job.filePath).toLowerCase();
  let downloadFilename = job.filename || `youtube_download${ext}`;

  if (customTitle) {
    // Sanitize title for filename
    const clean = customTitle
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/[\r\n\t]/g, ' ')
      .trim();
    if (clean) {
      downloadFilename = `${clean}${ext}`;
    }
  }

  res.download(job.filePath, downloadFilename, (err) => {
    if (err) {
      console.error('Download error:', err);
    }
    // Delete file after 2 minutes to free space
    setTimeout(() => {
      try {
        if (job.filePath && fs.existsSync(job.filePath)) {
          fs.unlinkSync(job.filePath);
        }
      } catch {
        // ignore
      }
    }, 2 * 60 * 1000);
  });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server successfully started at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

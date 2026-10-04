import React, { useState } from 'react';
import { Layers, FileCode, Check, Trash2, Music, Video, Sparkles, AlertCircle } from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { extractYouTubeId, triggerFileDownload } from '../utils/youtube';
import { DownloadFormat, UserPreferences } from '../types';

interface BatchDownloaderProps {
  lang: Language;
  preferences?: UserPreferences;
  initialUrls?: string[];
}

export const BatchDownloader: React.FC<BatchDownloaderProps> = ({ lang, preferences, initialUrls }) => {
  const t = translations[lang];

  const [rawText, setRawText] = useState(() => {
    if (initialUrls && initialUrls.length > 0) {
      return initialUrls.join('\n');
    }
    return 'https://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://www.youtube.com/watch?v=jfKfPfyJRdk';
  });

  React.useEffect(() => {
    if (initialUrls && initialUrls.length > 0) {
      setRawText(initialUrls.join('\n'));
    }
  }, [initialUrls]);

  const [format, setFormat] = useState<DownloadFormat>(preferences?.defaultFormat || 'mp3');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Parse lines to clean URLs
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => Boolean(l));

  const validIds = lines
    .map((line) => ({ line, id: extractYouTubeId(line) }))
    .filter((item) => Boolean(item.id));

  const handleGenerateBatchScript = () => {
    if (validIds.length === 0) return;

    const isAudio = format === 'mp3';
    const scriptHeader = `@echo off
chcp 65001 >nul
title Hromadny YouTube Stahovac pro PC (${validIds.length} souboru)
color 0a

echo ===============================================================================
echo            HROMADNY YOUTUBE STAHOVAC PRO PC - ${isAudio ? 'MP3 HUDBA' : 'MP4 VIDEO'}
echo ===============================================================================
echo Pocet odkazu ke stazeni: ${validIds.length}
echo Cilova slozka: Vaše složka Stazene soubory (Downloads)
echo.

set "TEMP_DIR=%TEMP%\\yt_downloader_pc"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
set "YTDLP_EXE=yt-dlp"

where yt-dlp >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] yt-dlp nebyl nalezen v PATH. Stahuji prenosny nastroj...
    set "YTDLP_EXE=%TEMP_DIR%\\yt-dlp.exe"
    if not exist "%TEMP_DIR%\\yt-dlp.exe" (
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '%TEMP_DIR%\\yt-dlp.exe'"
    )
)

echo.
echo ===============================================================================
echo   Zahajuji stahovani vsech souboru...
echo ===============================================================================
echo.
`;

    const videoQ = preferences?.defaultVideoQuality || '1080';
    const downloadCommands = validIds
      .map((item, index) => {
        const fullUrl = `https://www.youtube.com/watch?v=${item.id}`;
        if (isAudio) {
          return `echo [${index + 1}/${validIds.length}] Stahuji MP3: ${fullUrl}
"%YTDLP_EXE%" --extractor-args "youtube:player_client=android,web" -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata -o "%USERPROFILE%\\Downloads\\%%(title)s.%%(ext)s" "${fullUrl}" || "%YTDLP_EXE%" --cookies-from-browser edge -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata -o "%USERPROFILE%\\Downloads\\%%(title)s.%%(ext)s" "${fullUrl}" || "%YTDLP_EXE%" -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata -o "%USERPROFILE%\\Downloads\\%%(title)s.%%(ext)s" "${fullUrl}"
echo.`;
        } else {
          return `echo [${index + 1}/${validIds.length}] Stahuji MP4 (${videoQ}p): ${fullUrl}
"%YTDLP_EXE%" --extractor-args "youtube:player_client=android,web" -S "res:${videoQ},ext:mp4:m4a" -f "bestvideo[height<=${videoQ}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${videoQ}]+bestaudio/best[height<=${videoQ}]/best" --merge-output-format mp4 -o "%USERPROFILE%\\Downloads\\%%(title)s.%%(ext)s" "${fullUrl}" || "%YTDLP_EXE%" --cookies-from-browser edge -f "bestvideo[height<=${videoQ}]+bestaudio/best" --merge-output-format mp4 -o "%USERPROFILE%\\Downloads\\%%(title)s.%%(ext)s" "${fullUrl}" || "%YTDLP_EXE%" --cookies-from-browser chrome -f "bestvideo[height<=${videoQ}]+bestaudio/best" --merge-output-format mp4 -o "%USERPROFILE%\\Downloads\\%%(title)s.%%(ext)s" "${fullUrl}"
echo.`;
        }
      })
      .join('\n\n');

    const scriptFooter = `
echo ===============================================================================
echo   VSECHNO DOKONCENO! Vsechny soubory jsou ve slozce Downloads.
echo ===============================================================================
pause
explorer.exe "%USERPROFILE%\\Downloads"
exit /b 0
`;

    const fullScript = `${scriptHeader}\n${downloadCommands}\n${scriptFooter}`;
    triggerFileDownload(`Hromadne_Stahovani_${format.toUpperCase()}_${validIds.length}_videi.bat`, fullScript, 'application/x-bat;charset=utf-8');

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderBottomColor: 'var(--panel-border)' }}>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            <Layers className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <span>{t.batchTitle}</span>
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t.batchSubtitle}</p>
        </div>

        {/* Format Selector */}
        <div className="flex items-center gap-2 p-1 border rounded-lg" style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}>
          <button
            type="button"
            onClick={() => setFormat('mp3')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer"
            style={{
              backgroundColor: format === 'mp3' ? 'var(--accent-primary)' : 'transparent',
              color: format === 'mp3' ? 'var(--accent-contrast)' : 'var(--text-muted)'
            }}
          >
            <Music className="w-3.5 h-3.5" />
            <span>MP3 Hudba</span>
          </button>
          <button
            type="button"
            onClick={() => setFormat('mp4')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer"
            style={{
              backgroundColor: format === 'mp4' ? 'var(--accent-primary)' : 'transparent',
              color: format === 'mp4' ? 'var(--accent-contrast)' : 'var(--text-muted)'
            }}
          >
            <Video className="w-3.5 h-3.5" />
            <span>MP4 Video</span>
          </button>
        </div>
      </div>

      {/* Textarea for URLs */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2 text-xs">
          <label className="font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
            Seznam YouTube odkazů (1 na každý řádek):
          </label>
          <div className="flex items-center gap-3">
            <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
              Rozpoznáno:{' '}
              <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>{validIds.length}</strong>{' '}
              {t.batchItemsCount}
            </span>
            {rawText && (
              <button
                type="button"
                onClick={() => setRawText('')}
                className="flex items-center gap-1 transition-colors cursor-pointer hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 className="w-3 h-3" />
                <span>Vymazat</span>
              </button>
            )}
          </div>
        </div>

        <textarea
          rows={6}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={t.batchPlaceholder}
          className="w-full border rounded-xl p-3 text-sm font-mono focus:outline-none"
          style={{
            backgroundColor: 'var(--panel-surface)',
            borderColor: 'var(--panel-border)',
            color: 'var(--text-primary)'
          }}
        />
      </div>

      {/* Validation warning if some lines invalid */}
      {lines.length > validIds.length && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {lines.length - validIds.length} řádků neodpovídá platnému YouTube odkazu a bude přeskočeno.
          </span>
        </div>
      )}

      {/* Batch Action Bar */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t" style={{ borderTopColor: 'var(--panel-border)' }}>
        <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Skript po spuštění na Windows stáhne všech <strong>{validIds.length}</strong> skladeb/videí postupně bez vašeho zásahu přímo do složky <code>Downloads</code>.
        </div>

        <button
          type="button"
          onClick={handleGenerateBatchScript}
          disabled={validIds.length === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-sm shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
          style={{
            backgroundColor: validIds.length === 0 ? 'var(--panel-surface)' : 'var(--accent-primary)',
            color: validIds.length === 0 ? 'var(--text-muted)' : 'var(--accent-contrast)',
            opacity: validIds.length === 0 ? 0.6 : 1,
            borderRadius: 'var(--ui-radius-md)'
          }}
        >
          {downloadSuccess ? (
            <>
              <Check className="w-4 h-4" />
              <span>Skript stažen do PC!</span>
            </>
          ) : (
            <>
              <FileCode className="w-4 h-4" />
              <span>{t.batchGenerateScript}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

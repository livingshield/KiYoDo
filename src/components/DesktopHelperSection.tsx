import React, { useState } from 'react';
import { 
  Monitor, 
  Terminal, 
  Bookmark, 
  Zap, 
  HelpCircle, 
  Check, 
  Copy, 
  ArrowRight,
  FolderDown,
  ShieldCheck,
  FileCode
} from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { triggerFileDownload } from '../utils/youtube';

interface DesktopHelperSectionProps {
  lang: Language;
}

export const DesktopHelperSection: React.FC<DesktopHelperSectionProps> = ({ lang }) => {
  const t = translations[lang];
  const [copiedWinget, setCopiedWinget] = useState(false);
  const [copiedTrick, setCopiedTrick] = useState(false);

  const copyWinget = async () => {
    try {
      await navigator.clipboard.writeText('winget install yt-dlp');
      setCopiedWinget(true);
      setTimeout(() => setCopiedWinget(false), 2500);
    } catch {
      // Ignore
    }
  };

  const copyTrick = async () => {
    try {
      await navigator.clipboard.writeText('youtubepp.com');
      setCopiedTrick(true);
      setTimeout(() => setCopiedTrick(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleDownloadUniversalBat = () => {
    const batContent = `@echo off
chcp 65001 >nul
title Univerzalni YouTube Stahovac do PC
color 0b

echo ===============================================================================
echo            Univerzalni YouTube Stahovac do slozky Downloads
echo ===============================================================================
echo.
set /p YT_URL="Vlozte odkaz na YouTube video nebo playlist: "
if "%YT_URL%"=="" (
    echo [CHYBA] Nebyl zadan zadny odkaz!
    pause
    exit /b 1
)

echo.
echo Vyberte pozadovany format:
echo  [1] MP3 Hudba (nejvyssi kvalita 320 kbps)
echo  [2] MP4 Video (Full HD 1080p se zvukem)
echo.
set /p FORMAT_CHOICE="Vase volba (1 nebo 2): "

set "TEMP_DIR=%TEMP%\\yt_downloader_pc"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
set "YTDLP_EXE=yt-dlp"

where yt-dlp >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Pripravuji prenosny stahovac...
    set "YTDLP_EXE=%TEMP_DIR%\\yt-dlp.exe"
    if not exist "%TEMP_DIR%\\yt-dlp.exe" (
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '%TEMP_DIR%\\yt-dlp.exe'"
    )
)

echo.
echo Zahajuji stahovani primo do slozky Downloads...
echo.

if "%FORMAT_CHOICE%"=="1" (
    "%YTDLP_EXE%" --extractor-args "youtube:player_client=android,web" -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata -o "%USERPROFILE%\\Downloads\\%%(title)s.%%(ext)s" "%YT_URL%"
) else (
    "%YTDLP_EXE%" --extractor-args "youtube:player_client=android,web" -S "res:1080,ext:mp4:m4a" -f "bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best" --merge-output-format mp4 -o "%USERPROFILE%\\Downloads\\%%(title)s.%%(ext)s" "%YT_URL%"
)

echo.
echo ===============================================================================
echo   HOTOVO! Soubor najdete ve slozce Stažené soubory (Downloads).
echo ===============================================================================
pause
explorer.exe "%USERPROFILE%\\Downloads"
exit /b 0
`;

    triggerFileDownload('Univerzalni_YT_Stahovac_pro_PC.bat', batContent, 'application/x-bat;charset=utf-8');
  };

  return (
    <div className="space-y-6">
      {/* 3 Steps Guide Card */}
      <div 
        className="border rounded-2xl p-6 shadow-xl"
        style={{ 
          backgroundColor: 'var(--panel-bg)', 
          borderColor: 'var(--panel-border)',
          borderRadius: 'var(--ui-radius-lg)',
          boxShadow: 'var(--panel-shadow)'
        }}
      >
        <div className="flex items-center gap-2 pb-4 border-b" style={{ borderBottomColor: 'var(--panel-border)' }}>
          <Monitor className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {t.pcGuideTitle}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div 
            className="p-4 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
          >
            <div>
              <div 
                className="w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-sm mb-3"
                style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--accent-primary)' }}
              >
                1
              </div>
              <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                {t.pcGuideStep1Title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t.pcGuideStep1Desc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t flex items-center gap-1.5 text-xs font-medium" style={{ borderTopColor: 'var(--panel-border)', color: 'var(--accent-primary)' }}>
              <FolderDown className="w-3.5 h-3.5" />
              <span>Stažení trvá 1 sekundu</span>
            </div>
          </div>

          <div 
            className="p-4 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
          >
            <div>
              <div 
                className="w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-sm mb-3"
                style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--accent-primary)' }}
              >
                2
              </div>
              <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                {t.pcGuideStep2Title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t.pcGuideStep2Desc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t flex items-center gap-1.5 text-xs font-medium text-emerald-500" style={{ borderTopColor: 'var(--panel-border)' }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Přímo do složky Downloads</span>
            </div>
          </div>

          <div 
            className="p-4 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
          >
            <div>
              <div 
                className="w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-sm mb-3"
                style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--accent-primary)' }}
              >
                3
              </div>
              <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                {t.pcGuideStep3Title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t.pcGuideStep3Desc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t flex items-center gap-1.5 text-xs" style={{ borderTopColor: 'var(--panel-border)', color: 'var(--text-muted)' }}>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Maximální rychlost linky</span>
            </div>
          </div>
        </div>

        {/* Universal Bat Download Button */}
        <div className="mt-6 pt-5 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTopColor: 'var(--panel-border)' }}>
          <div>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Chcete univerzální stahovač pro libovolné video na ploše PC?
            </h4>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Stáhněte si skript, který se vás při každém spuštění zeptá na odkaz a formát (MP3/MP4).
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadUniversalBat}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md whitespace-nowrap cursor-pointer hover:opacity-90"
            style={{ 
              backgroundColor: 'var(--accent-primary)', 
              color: 'var(--accent-contrast)',
              borderRadius: 'var(--ui-radius-md)'
            }}
          >
            <FileCode className="w-4 h-4" />
            <span>Stáhnout univerzální .bat</span>
          </button>
        </div>
      </div>

      {/* URL Trick & Browser Bookmarklet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Magic "pp" Trick */}
        <div 
          className="border rounded-2xl p-6 shadow-xl flex flex-col justify-between"
          style={{ 
            backgroundColor: 'var(--panel-bg)', 
            borderColor: 'var(--panel-border)',
            borderRadius: 'var(--ui-radius-lg)',
            boxShadow: 'var(--panel-shadow)'
          }}
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{t.trickTitle}</h3>
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
              {t.trickDesc}
            </p>

            <div 
              className="p-3 rounded-xl border font-mono text-xs space-y-2"
              style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
            >
              <div className="line-through opacity-60" style={{ color: 'var(--text-muted)' }}>
                https://www.{t.trickExampleBefore}
              </div>
              <div className="font-bold flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                <span>https://www.youtube<strong className="text-amber-500 bg-amber-500/20 px-1 rounded">pp</strong>.com/watch?v=...</span>
              </div>
            </div>

            <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {t.trickResult}
            </p>
          </div>

          <button
            type="button"
            onClick={copyTrick}
            className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer border hover:opacity-90"
            style={{
              backgroundColor: 'var(--panel-surface)',
              borderColor: 'var(--panel-border)',
              color: 'var(--text-primary)'
            }}
          >
            {copiedTrick ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-emerald-500">Zkopírováno "pp"!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Kopírovat trik "youtubepp"</span>
              </>
            )}
          </button>
        </div>

        {/* Terminal & yt-dlp Power Setup */}
        <div 
          className="border rounded-2xl p-6 shadow-xl flex flex-col justify-between"
          style={{ 
            backgroundColor: 'var(--panel-bg)', 
            borderColor: 'var(--panel-border)',
            borderRadius: 'var(--ui-radius-lg)',
            boxShadow: 'var(--panel-shadow)'
          }}
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                Pokročilý nástroj pro Windows (yt-dlp)
              </h3>
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
              Nejrespektovanější otevřený nástroj na světě pro bezztrátové stahování z YouTube. Stačí ho jednou nainstalovat přes Windows Package Manager:
            </p>

            <div 
              className="p-3 rounded-xl border flex items-center justify-between font-mono text-xs"
              style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>winget install yt-dlp</span>
              <button
                type="button"
                onClick={copyWinget}
                className="p-1.5 rounded transition-colors cursor-pointer hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
                title="Kopírovat"
              >
                {copiedWinget ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              Funguje na Windows 10 i 11. Naše .bat skripty výše však fungují i bez nutnosti instalace, protože si přenosnou verzi stáhnou samy!
            </p>
          </div>

          <div className="mt-5 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <HelpCircle className="w-4 h-4 opacity-70 shrink-0" />
            <span>Stahované soubory se automaticky ukládají do složky Downloads.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

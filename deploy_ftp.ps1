$ErrorActionPreference = "Stop"

# Load FTP credentials from local untracked file (JSON or PS1) or environment variables
$jsonCreds = Join-Path $PSScriptRoot "ftp_credentials.local.json"
$psCreds = Join-Path $PSScriptRoot "ftp_credentials.local.ps1"

if (Test-Path $jsonCreds) {
    $cfg = Get-Content $jsonCreds -Raw | ConvertFrom-Json
    $ftpServer = if ($cfg.ftpServer) { $cfg.ftpServer } else { "windows11.aspone.cz" }
    $ftpUser = $cfg.ftpUser
    $ftpPass = $cfg.ftpPass
} elseif (Test-Path $psCreds) {
    . $psCreds
} else {
    $ftpServer = if ($env:FTP_SERVER) { $env:FTP_SERVER } else { "windows11.aspone.cz" }
    $ftpUser = $env:FTP_USER
    $ftpPass = $env:FTP_PASS
}

if ([string]::IsNullOrWhiteSpace($ftpUser) -or [string]::IsNullOrWhiteSpace($ftpPass)) {
    Write-Error "Chybí FTP přihlašovací údaje! Vytvořte soubor ftp_credentials.local.json (viz ftp_credentials.example.json) nebo nastavte proměnné prostředí FTP_USER a FTP_PASS."
    exit 1
}

# 1. Automatic version increment before deployment
$bumpScript = Join-Path $PSScriptRoot "scripts\bump-version.cjs"
if (Test-Path $bumpScript) {
    Write-Host "`n=== Zvyšování verze aplikace (Auto-Increment Version) ===" -ForegroundColor Cyan
    node $bumpScript
}

# 2. TypeScript verification
Write-Host "`n=== Kontrola TypeScript typů (npm run lint) ===" -ForegroundColor Cyan
& cmd /c npm run lint
if ($LASTEXITCODE -ne 0) {
    Write-Error "Chyba při typové kontrole kódu!"
    exit 1
}

# 3. Production build to bake new version into dist/
Write-Host "`n=== Spouštění produkčního buildu (npm run build) ===" -ForegroundColor Cyan
& cmd /c npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Chyba při kompilaci aplikace!"
    exit 1
}

$localDist = Join-Path $PSScriptRoot "dist"
if (!(Test-Path $localDist)) {
    Write-Error "Složka dist neexistuje! Nejprve spusťte npm run build."
    exit 1
}

function Create-FtpDirectorySafe($targetUri) {
    try {
        $req = [System.Net.FtpWebRequest]::Create($targetUri)
        $req.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
        $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
        $req.UseBinary = $true
        $req.KeepAlive = $false
        $resp = $req.GetResponse()
        $resp.Close()
        Write-Host "[DIR CREATED] $targetUri" -ForegroundColor Green
    } catch {
        # Directory likely already exists (550)
        Write-Host "[DIR EXISTS or SKIPPED] $targetUri" -ForegroundColor Gray
    }
}

function Upload-FtpFile($localFile, $remoteUri) {
    if ($localFile -like "*.exe" -or $remoteUri -like "*.exe*") {
        throw "KRITICKÁ CHYBA: Pokus o nahrání .exe souboru na ASPONE FTP ($localFile)! Operace byla zablokována."
    }
    $bytes = [System.IO.File]::ReadAllBytes($localFile)
    $maxRetries = 6
    $attempt = 0
    $success = $false

    while (-not $success -and $attempt -lt $maxRetries) {
        $attempt++
        try {
            $req = [System.Net.FtpWebRequest]::Create($remoteUri)
            $req.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
            $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
            $req.UseBinary = $true
            $req.KeepAlive = $false
            $req.Timeout = 30000
            $req.ReadWriteTimeout = 30000
            $req.ContentLength = $bytes.Length

            $stream = $req.GetRequestStream()
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Close()

            $resp = $req.GetResponse()
            $resp.Close()
            $success = $true
            Write-Host "[UPLOADED] $localFile -> $remoteUri ($($bytes.Length) bytes)" -ForegroundColor Cyan
            Start-Sleep -Milliseconds 150
        } catch {
            if ($attempt -ge $maxRetries) {
                Write-Host "[UPLOAD FAILED after $attempt attempts] $remoteUri - $_" -ForegroundColor Red
                throw $_
            } else {
                $waitSec = $attempt * 2
                Write-Host "[RETRY attempt $attempt] Connection issue, pausing ${waitSec}s before retrying $remoteUri..." -ForegroundColor Yellow
                Start-Sleep -Seconds $waitSec
            }
        }
    }
}

# Target paths for frontend: cover all possible IIS document root configurations on ASPONE
$targetRoots = @("www/wwwroot/KiYoDo", "www/KiYoDo", "wwwroot/KiYoDo", "KiYoDo")

function Delete-FtpFileSafe($remoteUri) {
    try {
        $req = [System.Net.FtpWebRequest]::Create($remoteUri)
        $req.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
        $req.Method = [System.Net.WebRequestMethods+Ftp]::DeleteFile
        $req.KeepAlive = $false
        $resp = $req.GetResponse()
        $resp.Close()
    } catch {}
}

function Upload-FtpText($text, $remoteUri) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $req = [System.Net.FtpWebRequest]::Create($remoteUri)
    $req.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
    $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $req.UseBinary = $true
    $req.KeepAlive = $false
    $req.ContentLength = $bytes.Length
    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
    $resp = $req.GetResponse()
    $resp.Close()
}

# Also ensure backend DLLs in root and /www/ are up-to-date
$publishDir = "C:\Users\janky\.gemini\antigravity\scratch\KikiAI\KikiAI\publish"
if (Test-Path $publishDir) {
    Write-Host "`n=== Syncing Backend DLLs to FTP Root and /www/ ===" -ForegroundColor Magenta

    # Temporarily place app_offline.htm to unlock DLLs in IIS
    try { Upload-FtpText "<html><body>Updating</body></html>" "ftp://$ftpServer/app_offline.htm" } catch {}
    try { Upload-FtpText "<html><body>Updating</body></html>" "ftp://$ftpServer/www/app_offline.htm" } catch {}
    Start-Sleep -Seconds 2

    $backendFiles = @("KikiAI.dll", "YoutubeExplode.dll", "BCrypt.Net-Next.dll", "KikiAI.deps.json")
    foreach ($bf in $backendFiles) {
        $localBf = Join-Path $publishDir $bf
        if (Test-Path $localBf) {
            Upload-FtpFile $localBf "ftp://$ftpServer/$bf"
            Upload-FtpFile $localBf "ftp://$ftpServer/www/$bf"
        }
    }

    # Remove app_offline.htm to resume IIS app
    Delete-FtpFileSafe "ftp://$ftpServer/app_offline.htm"
    Delete-FtpFileSafe "ftp://$ftpServer/www/app_offline.htm"
}

foreach ($targetRoot in $targetRoots) {
    Write-Host "`n=== Deploying to ftp://$ftpServer/$targetRoot ===" -ForegroundColor Yellow
    
    Create-FtpDirectorySafe "ftp://$ftpServer/$targetRoot"
    Create-FtpDirectorySafe "ftp://$ftpServer/$targetRoot/assets"
    Create-FtpDirectorySafe "ftp://$ftpServer/$targetRoot/backgrounds"
    Create-FtpDirectorySafe "ftp://$ftpServer/$targetRoot/api"

    # Upload files in root dist (strictly excluding any .exe)
    Get-ChildItem -Path $localDist -File | Where-Object { $_.Extension -ne ".exe" } | ForEach-Object {
        $destUri = "ftp://$ftpServer/$targetRoot/$($_.Name)"
        Upload-FtpFile $_.FullName $destUri
    }

    # Upload files in dist/assets
    $localAssets = Join-Path $localDist "assets"
    if (Test-Path $localAssets) {
        Get-ChildItem -Path $localAssets -File | Where-Object { $_.Extension -ne ".exe" } | ForEach-Object {
            $destUri = "ftp://$ftpServer/$targetRoot/assets/$($_.Name)"
            Upload-FtpFile $_.FullName $destUri
        }
    }

    # Upload files in dist/backgrounds
    $localBg = Join-Path $localDist "backgrounds"
    if (Test-Path $localBg) {
        Get-ChildItem -Path $localBg -File | Where-Object { $_.Extension -ne ".exe" } | ForEach-Object {
            $destUri = "ftp://$ftpServer/$targetRoot/backgrounds/$($_.Name)"
            Upload-FtpFile $_.FullName $destUri
        }
    }

    # Upload files in dist/api
    $localApi = Join-Path $localDist "api"
    if (Test-Path $localApi) {
        Get-ChildItem -Path $localApi -File | Where-Object { $_.Extension -ne ".exe" } | ForEach-Object {
            $destUri = "ftp://$ftpServer/$targetRoot/api/$($_.Name)"
            Upload-FtpFile $_.FullName $destUri
        }
    }
}

Write-Host "`n=== Nasazení na FTP úspěšně dokončeno! ===" -ForegroundColor Green

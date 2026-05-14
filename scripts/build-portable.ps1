$ErrorActionPreference = "Stop"
$distDir = "$PSScriptRoot\..\dist"
$vendorDir = "$distDir\vendor"

# Ensure TLS 1.2 for downloads
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host "0. Cleaning up previous build directory..."
if (Test-Path $distDir) {
    Remove-Item -Path $distDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $vendorDir -Force | Out-Null

Write-Host "1. Bundling with esbuild..."
node scripts/bundle.js

Write-Host "1.5. Compiling AniStream with pkg..."
Set-Location "$PSScriptRoot\.."

# Explicitly remove the old exe if it exists (to avoid rename locks)
if (Test-Path "dist/AniStream.exe") { 
    Remove-Item "dist/AniStream.exe" -Force -ErrorAction SilentlyContinue 
}

# Fix target to node18-win-x64 for best compatibility
npx pkg dist-bundle/package.json --targets node18-win-x64 --out-path dist/

# Find ANY exe in dist and rename it to AniStream.exe with retries
$maxRetries = 5
$retryCount = 0
$renamed = $false

while (-not $renamed -and $retryCount -lt $maxRetries) {
    try {
        $builtExe = Get-ChildItem "dist/*.exe" | Where-Object { $_.Name -ne "AniStream.exe" } | Select-Object -First 1
        if ($builtExe) { 
            Rename-Item $builtExe.FullName "AniStream.exe" -Force 
            Write-Host "  -> Successfully built: $($builtExe.Name) -> AniStream.exe"
            $renamed = $true
        } else {
            if (Test-Path "dist/AniStream.exe") {
                $renamed = $true # Already there
            } else {
                Write-Error "pkg failed to produce an executable!"
                exit 1
            }
        }
    } catch {
        $retryCount++
        Write-Host "  (!) File locked, retrying in 2 seconds... ($retryCount/$maxRetries)"
        Start-Sleep -Seconds 2
    }
}

# 1.6. Prepare Real App Core
Write-Host "1.6. Preparing AniStream Core..."
if (Test-Path "dist/AniStream.dat") {
    Remove-Item "dist/AniStream.dat" -Force
}
if (Test-Path "dist/AniStream.exe") {
    Move-Item "dist/AniStream.exe" "dist/AniStream.dat" -Force
}

# 1.7. Compile C# Launcher (The Signed Entry Point)
Write-Host "1.7. Compiling Signed Launcher..."
$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$iconPath = "assets\fox_mask.ico"
& $cscPath /target:exe /out:dist\AniStream.exe /win32icon:$iconPath /reference:System.Windows.Forms.dll scripts\Launcher.cs

# 2. Self-signing the Launcher
Write-Host "2. Signing the Launcher..."
Start-Sleep -Seconds 2
& powershell.exe -File scripts/sign.ps1

Write-Host "--- BUILD VERIFICATION ---"
if (Test-Path "dist/AniStream.exe") { Write-Host "  [OK] Launcher built and signed." }
if (Test-Path "dist/AniStream.dat") { Write-Host "  [OK] Core binary ready." }

Write-Host "3. Downloading portable dependencies..."
$apps = @(
    @{ 
        name = "git"
        url = "https://github.com/git-for-windows/git/releases/download/v2.54.0.windows.1/PortableGit-2.54.0-64-bit.7z.exe"
        dest = "$vendorDir\git.exe"
    },
    @{ 
        name = "mpv"
        url = "https://github.com/shinchiro/mpv-winbuild-cmake/releases/download/20260421/mpv-x86_64-20260421-git-5921fe5.7z"
        dest = "$vendorDir\mpv.7z"
    },

    @{ 
        name = "fzf"
        url = "https://github.com/junegunn/fzf/releases/download/v0.72.0/fzf-0.72.0-windows_amd64.zip"
        dest = "$vendorDir\fzf.zip"
    },
    @{
        name = "ffmpeg"
        url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
        dest = "$vendorDir\ffmpeg.zip"
    },
    @{
        name = "ani-cli"
        url = "https://raw.githubusercontent.com/pystardust/ani-cli/master/ani-cli"
        dest = "$vendorDir\ani-cli.tmp"
    }
)

foreach ($app in $apps) {
    Write-Host "Downloading $($app.name)..."
    & curl.exe -L -o "$($app.dest)" "$($app.url)"
}

Write-Host "3. Extracting dependencies..."
# Standalone 7zip for extraction
$7zUrl = "https://www.7-zip.org/a/7zr.exe"
$7zDest = "$vendorDir\7zr.exe"
& curl.exe -L -o "$7zDest" "$7zUrl"

function Extract-App($file, $outDir) {
    if ($file.EndsWith(".zip")) {
        Expand-Archive -Path $file -DestinationPath $outDir -Force
    } else {
        & "$7zDest" x "$file" "-o$outDir" -y | Out-Null
    }
    # Ignore errors during temp file cleanup
    Remove-Item $file -Force -ErrorAction SilentlyContinue
}

Extract-App "$vendorDir\git.exe" "$vendorDir\git"
Extract-App "$vendorDir\mpv.7z" "$vendorDir\mpv"

Extract-App "$vendorDir\fzf.zip" "$vendorDir\fzf"
Extract-App "$vendorDir\ffmpeg.zip" "$vendorDir\ffmpeg_temp"

# Flatten FFmpeg
$ffmpegBin = Get-ChildItem -Path "$vendorDir\ffmpeg_temp" -Filter "bin" -Recurse | Select-Object -First 1
if ($ffmpegBin) {
    New-Item -ItemType Directory -Path "$vendorDir\ffmpeg" -Force | Out-Null
    Move-Item "$($ffmpegBin.FullName)\*" "$vendorDir\ffmpeg" -Force -ErrorAction SilentlyContinue
}
Remove-Item "$vendorDir\ffmpeg_temp" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "4. Trimming Git Bash..."
$gitDir = "$vendorDir\git"
$toDelete = @(
    "$gitDir\mingw64\libexec", 
    "$gitDir\mingw64\share",
    "$gitDir\usr\share",
    "$gitDir\usr\lib\perl5"
)
foreach ($path in $toDelete) {
    if (Test-Path $path) { Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue }
}

# Setup ani-cli
$aniCliDir = "$vendorDir\ani-cli"
New-Item -ItemType Directory -Path $aniCliDir -Force | Out-Null
if (Test-Path "$vendorDir\ani-cli.tmp") {
    Move-Item "$vendorDir\ani-cli.tmp" "$aniCliDir\ani-cli" -Force
}
Set-Content -Path "$aniCliDir\ani-cli.bat" -Value "@echo off`nbash `"%~dp0ani-cli`" %*"

# Cleanup 7zr
Remove-Item $7zDest -Force

Write-Host "5. Generating portable settings.json..."
$settings = @{
    version = 1
    firstRun = $false
    port = 6969
    theme = "dark"
    defaultPlayer = "mpv"
    mpvBinPath = "mpv"
    aniBinPath = "ani-cli.bat"
    defaultQuality = "1080"
    downloadDir = "downloads"
    autoMarkComplete = $true
    autoNextEpisode = $true
}
$settings | ConvertTo-Json | Set-Content "$distDir\settings.json"

Write-Host "6. Generating README.txt..."
$readme = @"
==========================================
                 ANISTREAM
==========================================
Developed by: Pochira
Instagram: @3cstat1c.fl
Email: mrvortex911@gmail.com

HOW TO RUN:
1. Double-click "AniStream.exe".
2. Everything is bundled and portable!

FEATURES:
- 100% Portable: No installation required.
- Zero Prerequisites: Everything is bundled!
- Official MyAnimeList Auto-Sync.
- External MPV and VLC player support.
- Sakura / Twilight Japanese aesthetic UI.
==========================================
"@
Set-Content "$distDir\README.txt" -Value $readme

Write-Host "Portable build complete!"

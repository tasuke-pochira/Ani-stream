#Requires -Version 5.1
<#
.SYNOPSIS
    AniStream portable build script.
    Packages the Node.js app via pkg and bundles all portable dependencies.
.NOTES
    Run from the project root:  .\scripts\build.ps1
    Requires: Node.js 18+, npm, internet connection
#>

# ── Stop on any unhandled error ──────────────────────────────────────────────
$ErrorActionPreference = "Stop"

# BUG 1 FIX: TLS must be set FIRST, before any Invoke-WebRequest call.
# Without this, downloads fail on Windows Server / older Win10 builds.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ── Resolve paths from script location ───────────────────────────────────────
# BUG 2 FIX: Never use Set-Location — it mutates global state and breaks
# $PSScriptRoot-relative paths for the rest of the session.
# $projectRoot is always the folder that contains /scripts/build.ps1
$projectRoot = (Get-Item "$PSScriptRoot\..").FullName
$distDir = "$projectRoot\dist"
$vendorDir = "$distDir\vendor"

# ── Helper: safe download with retry ─────────────────────────────────────────
# BUG 10 FIX: Wrap every download; one bad URL won't silently corrupt state.
function Download-File {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Dest
    )
    Write-Host "  -> Downloading $Name ..."
    $attempt = 0
    while ($attempt -lt 3) {
        try {
            Invoke-WebRequest -Uri $Url -OutFile $Dest -UserAgent "Mozilla/5.0" -UseBasicParsing
            Write-Host "     OK: $Name"
            return
        }
        catch {
            $attempt++
            if ($attempt -ge 3) {
                Write-Error "FAILED to download $Name after 3 attempts: $_"
                throw
            }
            Write-Warning "  Retry $attempt for $Name ..."
            Start-Sleep -Seconds 3
        }
    }
}

# ── Helper: extract archive ───────────────────────────────────────────────────
# BUG 11 FIX: $7zPath must already be downloaded before this function is called.
# Function is declared here but 7zr.exe is fetched in step 3 before any call.
function Expand-Archive7z {
    param(
        [string]$7zPath,
        [string]$File,
        [string]$OutDir
    )
    if ($File.EndsWith(".zip")) {
        Expand-Archive -Path $File -DestinationPath $OutDir -Force
    }
    else {
        # Works for .7z, .7z.exe (self-extracting), .tar.gz etc.
        & "$7zPath" x "$File" "-o$OutDir" -y | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "7zr extraction failed for $File (exit $LASTEXITCODE)" }
    }
    Remove-Item $File -Force
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=========================================="
Write-Host "  AniStream Portable Build"
Write-Host "=========================================="

# ── Step 0: Clean ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[0/6] Cleaning previous build..."
if (Test-Path $distDir) {
    Remove-Item -Path $distDir -Recurse -Force -ErrorAction SilentlyContinue
}
# BUG 12 FIX: Create ALL needed subdirectories upfront so nothing is a file
# when we later try to treat it as a directory.
New-Item -ItemType Directory -Path "$vendorDir\mpv"     -Force | Out-Null
New-Item -ItemType Directory -Path "$vendorDir\vlc"     -Force | Out-Null
New-Item -ItemType Directory -Path "$vendorDir\git"     -Force | Out-Null
New-Item -ItemType Directory -Path "$vendorDir\fzf"     -Force | Out-Null
New-Item -ItemType Directory -Path "$vendorDir\ani-cli" -Force | Out-Null

# ── Step 1: pkg compile ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/6] Compiling AniStream with pkg..."
# FIX: npx on Windows is npx.cmd — not a Win32 .exe — so Start-Process fails.
# Use Push-Location + direct invocation via cmd.exe instead.
# cmd /c properly resolves .cmd extensions that PowerShell's & operator sometimes misses.
Push-Location $projectRoot
try {
    cmd /c "npx pkg . --out-path dist/"
    if ($LASTEXITCODE -ne 0) {
        throw "pkg compilation failed (exit $LASTEXITCODE). Run 'npm install' first."
    }
}
finally {
    Pop-Location  # Always restore location even if pkg throws
}
Write-Host "  -> AniStream.exe built."

# ── Step 2: Download 7zr first (needed to extract everything else) ────────────
Write-Host ""
Write-Host "[2/6] Fetching 7zr (extraction engine)..."
$7zPath = "$vendorDir\7zr.exe"
Download-File -Name "7zr" -Url "https://www.7-zip.org/a/7zr.exe" -Dest $7zPath

# ── Step 3: Download portable dependencies ────────────────────────────────────
Write-Host ""
Write-Host "[3/6] Downloading portable dependencies..."

# ── Versions (update these to bump deps) ─────────────────────────────────────
$gitVersion = "2.44.0"
$gitTag = "v2.44.0.windows.1"
$mpvDate = "20240121"          # BUG 7 FIX: shinchiro tags are dates, not semver
$vlcVersion = "3.0.20"
$fzfVersion = "0.46.1"

$downloads = @(
    @{
        name = "PortableGit"
        # PortableGit .7z.exe is a self-extracting 7z — 7zr can open it directly
        url  = "https://github.com/git-for-windows/git/releases/download/$gitTag/PortableGit-$gitVersion-64-bit.7z.exe"
        dest = "$vendorDir\git.7z.exe"
    },
    @{
        name = "mpv"
        # BUG 7 FIX: correct shinchiro URL — tag IS the date, not the mpv version
        url  = "https://github.com/shinchiro/mpv-winbuild-cmake/releases/download/$mpvDate/mpv-x86_64-v3-$mpvDate.7z"
        dest = "$vendorDir\mpv.7z"
    },
    @{
        name = "VLC"
        url  = "https://get.videolan.org/vlc/$vlcVersion/win64/vlc-$vlcVersion-win64.7z"
        dest = "$vendorDir\vlc.7z"
    },
    @{
        name = "fzf"
        # BUG 6 FIX: fzf GitHub release tag uses "v" prefix — URL without it is a 404
        url  = "https://github.com/junegunn/fzf/releases/download/v$fzfVersion/fzf-$fzfVersion-windows_amd64.zip"
        dest = "$vendorDir\fzf.zip"
    },
    @{
        name = "ani-cli"
        url  = "https://raw.githubusercontent.com/pystardust/ani-cli/master/ani-cli"
        # BUG 3 FIX: download INTO the ani-cli subfolder (which now exists as a directory)
        dest = "$vendorDir\ani-cli\ani-cli"
    }
)

foreach ($app in $downloads) {
    Download-File -Name $app.name -Url $app.url -Dest $app.dest
}

# ── Step 4: Extract archives ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/6] Extracting dependencies..."

Expand-Archive7z -7zPath $7zPath -File "$vendorDir\git.7z.exe" -OutDir "$vendorDir\git"
Expand-Archive7z -7zPath $7zPath -File "$vendorDir\mpv.7z"     -OutDir "$vendorDir\mpv"
Expand-Archive7z -7zPath $7zPath -File "$vendorDir\vlc.7z"     -OutDir "$vendorDir\vlc"
Expand-Archive7z -7zPath $7zPath -File "$vendorDir\fzf.zip"    -OutDir "$vendorDir\fzf"

# 7zr no longer needed
Remove-Item $7zPath -Force

# ── Step 5: Trim and configure ────────────────────────────────────────────────
Write-Host ""
Write-Host "[5/6] Trimming and configuring..."

# -- Git: trim bloat (docs, perl, i18n, tcl) but KEEP the binaries
$gitDir = "$vendorDir\git"
# BUG 5 FIX: Original script deleted git.exe itself! Only delete non-essential folders.
$gitTrim = @(
    "$gitDir\mingw64\libexec\git-core\git-gui*",
    "$gitDir\mingw64\libexec\git-core\git-citool*",
    "$gitDir\mingw64\share",
    "$gitDir\usr\share",
    "$gitDir\usr\lib\perl5",
    "$gitDir\doc",
    "$gitDir\ReleaseNotes.html"
)
foreach ($path in $gitTrim) {
    Get-Item $path -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "  -> Git trimmed."

# -- mpv: flatten nested folder if shinchiro extracts into a subdirectory
#    e.g. vendor\mpv\mpv-x86_64-v3-20240121\ -> vendor\mpv\
$mpvSub = Get-ChildItem "$vendorDir\mpv" -Directory | Select-Object -First 1
if ($mpvSub -and (Test-Path "$($mpvSub.FullName)\mpv.exe")) {
    Get-ChildItem $mpvSub.FullName | Move-Item -Destination "$vendorDir\mpv" -Force
    Remove-Item $mpvSub.FullName -Recurse -Force
    Write-Host "  -> mpv flattened."
}

# BUG 8 FIX: VLC extracts to vlc-3.0.20-win64\ (version-named subfolder).
# Flatten it so vlc.exe is directly in vendor\vlc\.
$vlcSub = Get-ChildItem "$vendorDir\vlc" -Directory | Select-Object -First 1
if ($vlcSub -and (Test-Path "$($vlcSub.FullName)\vlc.exe")) {
    Get-ChildItem $vlcSub.FullName | Move-Item -Destination "$vendorDir\vlc" -Force
    Remove-Item $vlcSub.FullName -Recurse -Force
    Write-Host "  -> VLC flattened."
}

# -- fzf: the zip extracts fzf.exe directly, nothing to flatten
Write-Host "  -> fzf ready."

# BUG 3+4 FIX: ani-cli wrapper batch file.
# Uses the BUNDLED bash.exe from PortableGit so bash is always available,
# regardless of what the user has (or doesn't have) in their system PATH.
$batContent = @"
@echo off
REM AniStream ani-cli launcher — uses bundled PortableGit bash, not system bash
setlocal
set "SCRIPT_DIR=%~dp0"
set "BASH=%SCRIPT_DIR%..\git\usr\bin\bash.exe"
set "ANICLI=%SCRIPT_DIR%ani-cli"
if not exist "%BASH%" (
    echo [ERROR] Bundled bash not found at: %BASH%
    exit /b 1
)
"%BASH%" "%ANICLI%" %*
endlocal
"@
Set-Content -Path "$vendorDir\ani-cli\ani-cli.bat" -Value $batContent -Encoding ASCII
Write-Host "  -> ani-cli.bat wrapper written (uses bundled bash)."

# ── Step 6: Generate config files ────────────────────────────────────────────
Write-Host ""
Write-Host "[6/6] Generating config and README..."

# BUG 9 FIX: paths must be relative to dist\ and include the vendor\ prefix
# so the app can locate them regardless of where dist\ is placed.
$settings = [ordered]@{
    version          = 1
    firstRun         = $false
    port             = 6969
    theme            = "dark"
    defaultPlayer    = "mpv"
    # These are resolved at runtime relative to the exe location
    mpvBinPath       = "vendor\mpv\mpv.exe"
    aniBinPath       = "vendor\ani-cli\ani-cli.bat"
    vlcBinPath       = "vendor\vlc\vlc.exe"
    gitBashPath      = "vendor\git\usr\bin\bash.exe"
    fzfBinPath       = "vendor\fzf\fzf.exe"
    defaultQuality   = "1080"
    defaultAudioType = "sub"
    downloadDir      = "downloads"
    autoMarkComplete = $true
    autoNextEpisode  = $true
    autoNextDelay    = 5
    skipIntro        = $true
    ui               = [ordered]@{
        cardsPerRow           = 6
        showDubBadge          = $true
        continueWatchingLimit = 10
    }
}
$settings | ConvertTo-Json -Depth 5 | Set-Content "$distDir\settings.json" -Encoding UTF8
Write-Host "  -> settings.json written."

# Create downloads folder placeholder
New-Item -ItemType Directory -Path "$distDir\downloads" -Force | Out-Null
Set-Content "$distDir\downloads\.gitkeep" -Value "" | Out-Null

$readme = @"
==========================================
              ANISTREAM
    Local Anime Streaming Platform
==========================================

HOW TO RUN:
  Double-click AniStream.exe.
  Your browser will open to http://localhost:6969 automatically.

FIRST TIME SETUP:
  Everything is bundled — no installs needed.
  On first launch the setup wizard will verify all components.

PORTABLE:
  This entire folder is portable. Move it anywhere.
  User data (history, MAL list) is saved to:
  %%APPDATA%%\AniStream\

BUNDLED DEPENDENCIES:
  - mpv       (video player)
  - VLC       (alternative player)
  - Git/bash  (required by ani-cli)
  - fzf       (fuzzy finder for ani-cli)
  - ani-cli   (stream source)

DEVELOPER:
  Pochira
  Instagram : @3cstat1c.fl
  Email     : mrvortex911@gmail.com

==========================================
"@
Set-Content "$distDir\README.txt" -Value $readme -Encoding UTF8
Write-Host "  -> README.txt written."

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=========================================="
Write-Host "  Build complete!"
Write-Host ""
Write-Host "  Output : $distDir"
Write-Host ""

# Print final size
$totalMB = [math]::Round((Get-ChildItem $distDir -Recurse | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host "  Total size : $totalMB MB"
Write-Host "=========================================="
Write-Host ""
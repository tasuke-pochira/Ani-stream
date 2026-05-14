$ErrorActionPreference = "SilentlyContinue"

Write-Host "Killing processes that might lock the dist folder..."
taskkill /F /IM mpv.exe
taskkill /F /IM vlc.exe
taskkill /F /IM AniStream.exe
taskkill /F /IM 7zr.exe
taskkill /F /IM bash.exe
taskkill /F /IM git.exe
taskkill /F /IM node.exe # Be careful with this one if running from VS Code, but usually fine for terminal

Start-Sleep -Seconds 1

Write-Host "Cleaning dist/ directory..."
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
}

if (Test-Path "dist-bundle") {
    Remove-Item -Path "dist-bundle" -Recurse -Force
}

Write-Host "Cleanup complete."

# 解除安裝下載功能的橋接程式（Windows）。plan 4.8、002 FR-77。
# 移除 install.ps1 建立的所有檔案與登錄機碼：%LOCALAPPDATA%\youtube-extension-host\
# （橋接程式、原生訊息設定檔、狀態與記錄檔），以及 HKCU 中 Chrome 與 Firefox 的機碼。
# 不會移除已經下載的影片，也不會移除 yt-dlp 與 ffmpeg。
#
# 用法：powershell -ExecutionPolicy Bypass -File uninstall.ps1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3

$Name = 'com.chidi0716.youtube_extension'
$AppDir = Join-Path $env:LOCALAPPDATA 'youtube-extension-host'
$Keys = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$Name",
    "HKCU:\Software\Mozilla\NativeMessagingHosts\$Name"
)

foreach ($key in $Keys) {
    if (Test-Path -LiteralPath $key) {
        Remove-Item -LiteralPath $key -Recurse -Force
        Write-Host "Removed: $key"
    }
}

if (Test-Path -LiteralPath $AppDir) {
    try {
        Remove-Item -LiteralPath $AppDir -Recurse -Force
        Write-Host "Removed: $AppDir"
    } catch {
        Write-Host "Error: could not remove $AppDir. Close Chrome and Firefox (a download may be running) and run this script again." -ForegroundColor Red
        exit 1
    }
}

Write-Host 'Done. The download helper has been removed. Downloaded files and yt-dlp/ffmpeg were not touched.'

# 安裝下載功能的橋接程式（Windows，使用者層級，不需要系統管理員權限）。plan 4.8、002 FR-76。
#
#   1. 複製橋接程式到 %LOCALAPPDATA%\youtube-extension-host\；
#   2. 寫入原生訊息設定檔，並在 HKCU 建立 Chrome 與 Firefox 的登錄機碼；
#   3. 檢查 yt-dlp 與 ffmpeg，缺少時提示安裝方式。
#
# 用法（PowerShell 預設不允許執行腳本，所以以 -ExecutionPolicy Bypass 執行這一次）：
#   powershell -ExecutionPolicy Bypass -File install.ps1 [-Binary <橋接程式的路徑>]
# 沒有指定 -Binary 時，依序尋找與本腳本同一個資料夾、以及 repo 的 host\dist\ 中的
# yte-host-windows-amd64.exe。
[CmdletBinding()]
param(
    [string]$Binary
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3

$Name = 'com.chidi0716.youtube_extension'
$AppDir = Join-Path $env:LOCALAPPDATA 'youtube-extension-host'
$HostExe = Join-Path $AppDir 'yte-host.exe'
$RegistryKeys = @(
    @{ Browser = 'Chrome'; Key = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$Name"; Template = 'chrome.json' },
    @{ Browser = 'Firefox'; Key = "HKCU:\Software\Mozilla\NativeMessagingHosts\$Name"; Template = 'firefox.json' }
)

function Fail([string]$Message) {
    Write-Host "Error: $Message" -ForegroundColor Red
    exit 1
}

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Note: this script does not need administrator rights; it installs for the current user only.'
}
if (-not $env:LOCALAPPDATA) {
    Fail 'LOCALAPPDATA is not set.'
}

$BinName = 'yte-host-windows-amd64.exe'
if (-not $Binary) {
    foreach ($candidate in @((Join-Path $PSScriptRoot $BinName), (Join-Path $PSScriptRoot "..\..\host\dist\$BinName"))) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $Binary = $candidate
            break
        }
    }
}
if (-not $Binary -or -not (Test-Path -LiteralPath $Binary -PathType Leaf)) {
    Fail "could not find $BinName. Build it with 'npm run build:host' or pass its path: install.ps1 -Binary C:\path\to\$BinName"
}

$Manifests = $null
foreach ($candidate in @((Join-Path $PSScriptRoot 'manifests'), (Join-Path $PSScriptRoot '..\manifests'))) {
    if ((Test-Path -LiteralPath (Join-Path $candidate 'chrome.json')) -and (Test-Path -LiteralPath (Join-Path $candidate 'firefox.json'))) {
        $Manifests = $candidate
        break
    }
}
if (-not $Manifests) {
    Fail 'could not find the manifest templates (manifests\chrome.json, manifests\firefox.json).'
}

Write-Host "Installing the helper to: $HostExe"
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
try {
    Copy-Item -LiteralPath $Binary -Destination $HostExe -Force
} catch {
    Fail "could not copy the helper. Close Chrome and Firefox (a download may be running) and try again. $($_.Exception.Message)"
}
# 從網路下載的檔案帶有「來自網際網路」標記，移除後 SmartScreen 才不會阻擋。
Unblock-File -LiteralPath $HostExe -ErrorAction SilentlyContinue

$version = & $HostExe --version
if ($LASTEXITCODE -ne 0) {
    Fail "the helper does not run on this computer ($HostExe)."
}
Write-Host "Helper version: $version"

# 原生訊息設定檔中的 path 是 JSON 字串：反斜線要寫成兩個。
$jsonPath = $HostExe.Replace('\', '\\').Replace('"', '\"')
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
foreach ($entry in $RegistryKeys) {
    $template = [System.IO.File]::ReadAllText((Join-Path $Manifests $entry.Template))
    $manifestPath = Join-Path $AppDir "$Name.$($entry.Browser.ToLower()).json"
    [System.IO.File]::WriteAllText($manifestPath, $template.Replace('@HOST_PATH@', $jsonPath), $utf8NoBom)
    New-Item -Path $entry.Key -Force | Out-Null
    Set-ItemProperty -LiteralPath $entry.Key -Name '(Default)' -Value $manifestPath
    Write-Host "Registered for $($entry.Browser): $($entry.Key) -> $manifestPath"
}

# 檢查 yt-dlp 與 ffmpeg（橋接程式也會在 WinGet 的資料夾中尋找）。
function Find-Tool([string]$Tool) {
    $cmd = Get-Command "$Tool.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Path }
    $links = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\$Tool.exe"
    if (Test-Path -LiteralPath $links) { return $links }
    $packages = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    if (Test-Path -LiteralPath $packages) {
        $found = Get-ChildItem -LiteralPath $packages -Recurse -Filter "$Tool.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    return $null
}

$missing = @()
foreach ($tool in @('yt-dlp', 'ffmpeg')) {
    $path = Find-Tool $tool
    if ($path) {
        Write-Host "Found ${tool}: $path"
    } else {
        Write-Host "Missing: $tool" -ForegroundColor Yellow
        $missing += $tool
    }
}

Write-Host ''
if ($missing.Count -gt 0) {
    Write-Host 'Downloads need yt-dlp and ffmpeg. Install them with winget:'
    Write-Host ''
    Write-Host '    winget install yt-dlp.yt-dlp Gyan.FFmpeg'
    Write-Host ''
}
if (-not (Find-Tool 'deno')) {
    Write-Host 'yt-dlp recommends a JavaScript runtime for full YouTube support. If some qualities are missing, run:'
    Write-Host ''
    Write-Host '    winget install DenoLand.Deno'
    Write-Host ''
}
Write-Host 'Done. Restart Chrome or Firefox if it was open, then click "Check again" in the extension''s download panel.'

#!/usr/bin/env bash
# 以官方 PowerShell（Linux 版，解壓到 spikes/stage3/.cache/pwsh/）解析 install/windows/*.ps1，
# 只做語法檢查，不執行腳本（腳本依賴 Windows 的登錄與 LOCALAPPDATA）。
# 下載：https://github.com/PowerShell/PowerShell/releases/download/v7.4.6/powershell-7.4.6-linux-x64.tar.gz
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
cache="$here/.cache"
pwsh="$cache/pwsh/pwsh"

if [ ! -x "$pwsh" ]; then
  mkdir -p "$cache/pwsh"
  python3 -I -c 'import sys, tarfile; tarfile.open(sys.argv[1]).extractall(sys.argv[2], filter="data")' \
    "$cache/pwsh.tar.gz" "$cache/pwsh"
  chmod +x "$pwsh"
fi

"$pwsh" -NoProfile -NonInteractive -File "$here/parse-ps1.ps1" \
  "$repo/install/windows/install.ps1" "$repo/install/windows/uninstall.ps1" \
  "$repo/install/bootstrap/install.ps1"

# 選擇資料夾的 PowerShell 腳本（內嵌在 host/internal/platform/actions.go）也解析一次。
script=$(sed -n '/^const winPickFolderScript = `/,/^`$/p' "$repo/host/internal/platform/actions.go" | sed '1s/^const winPickFolderScript = `//; $d')
"$pwsh" -NoProfile -NonInteractive -File "$here/parse-ps1.ps1" -Script "$script"

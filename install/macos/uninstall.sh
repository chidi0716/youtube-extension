#!/bin/sh
# 解除安裝下載功能的橋接程式（macOS）。plan 4.8、002 FR-77。
# 移除 install.sh 建立的所有檔案：橋接程式與狀態資料夾、Chrome 與 Firefox 的原生訊息設定檔、記錄檔。
# 不會移除已經下載的影片，也不會移除 yt-dlp 與 ffmpeg。
set -eu

NAME="com.chidi0716.youtube_extension"
APP_DIR="$HOME/Library/Application Support/youtube-extension-host"
LOG_DIR="$HOME/Library/Logs/youtube-extension-host"
CHROME_MANIFEST="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/$NAME.json"
FIREFOX_MANIFEST="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts/$NAME.json"

if [ "$(id -u)" = "0" ]; then
  echo "Error: do not run this script with sudo." >&2
  exit 1
fi

remove() {
  if [ -e "$1" ]; then
    rm -rf -- "$1"
    echo "Removed: $1"
  fi
}

remove "$CHROME_MANIFEST"
remove "$FIREFOX_MANIFEST"
remove "$APP_DIR"
remove "$LOG_DIR"

echo "Done. The download helper has been removed. Downloaded files and yt-dlp/ffmpeg were not touched."

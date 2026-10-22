#!/bin/sh
# 安裝下載功能的橋接程式（macOS，使用者層級，不需要 sudo）。plan 4.8、002 FR-76。
#
#   1. 複製橋接程式到 ~/Library/Application Support/youtube-extension-host/，並移除隔離屬性；
#   2. 寫入 Chrome 與 Firefox 的原生訊息設定檔；
#   3. 檢查 yt-dlp 與 ffmpeg，缺少時提示安裝方式。
#
# 用法：sh install.sh [橋接程式的路徑]
# 沒有指定路徑時，依序尋找與本腳本同一個資料夾、以及 repo 的 host/dist/ 中
# 符合這台 Mac 架構的 yte-host-darwin-arm64 或 yte-host-darwin-amd64。
set -eu

NAME="com.chidi0716.youtube_extension"
APP_DIR="$HOME/Library/Application Support/youtube-extension-host"
HOST="$APP_DIR/yte-host"
CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
FIREFOX_DIR="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

if [ "$(id -u)" = "0" ]; then
  fail "do not run this script with sudo; it installs for the current user only."
fi
if [ "$(uname -s)" != "Darwin" ]; then
  fail "this script is for macOS. On Windows, use install/windows/install.ps1."
fi

# Apple Silicon 上即使在 Rosetta 下執行，也安裝 arm64 版本。
if [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ]; then
  ARCH="arm64"
else
  ARCH="amd64"
fi
BIN_NAME="yte-host-darwin-$ARCH"

if [ $# -ge 1 ]; then
  SRC="$1"
else
  SRC=""
  for candidate in "$SCRIPT_DIR/$BIN_NAME" "$SCRIPT_DIR/../../host/dist/$BIN_NAME"; do
    if [ -f "$candidate" ]; then
      SRC="$candidate"
      break
    fi
  done
fi
if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  fail "could not find $BIN_NAME. Build it with 'npm run build:host' or pass its path: sh install.sh /path/to/$BIN_NAME"
fi

MANIFESTS=""
for candidate in "$SCRIPT_DIR/manifests" "$SCRIPT_DIR/../manifests"; do
  if [ -f "$candidate/chrome.json" ] && [ -f "$candidate/firefox.json" ]; then
    MANIFESTS="$candidate"
    break
  fi
done
[ -n "$MANIFESTS" ] || fail "could not find the manifest templates (manifests/chrome.json, manifests/firefox.json)."

case "$HOST" in
  *'
'*) fail "the home folder path contains a line break, which is not supported." ;;
esac

echo "Installing the helper to: $HOST"
mkdir -p "$APP_DIR"
cp -f "$SRC" "$HOST.new"
chmod 755 "$HOST.new"
mv -f "$HOST.new" "$HOST"
# 從網路下載的檔案帶有隔離屬性，Gatekeeper 會阻擋執行（plan 6 R4）。
xattr -d com.apple.quarantine "$HOST" 2>/dev/null || true

if ! "$HOST" --version >/dev/null 2>&1; then
  # 簽章在複製後失效時，重新加上本機（ad-hoc）簽章。
  if command -v codesign >/dev/null 2>&1; then
    codesign --force --sign - "$HOST" >/dev/null 2>&1 || true
  fi
  "$HOST" --version >/dev/null 2>&1 || fail "the helper does not run on this Mac ($HOST)."
fi
echo "Helper version: $("$HOST" --version)"

# 原生訊息設定檔中的 path 是 JSON 字串：跳脫反斜線與引號，再跳脫 sed 的特殊字元。
json_path=$(printf '%s' "$HOST" | sed 's/\\/\\\\/g; s/"/\\"/g')
sed_path=$(printf '%s' "$json_path" | sed 's/[\\&|]/\\&/g')

write_manifest() {
  template="$1"
  dir="$2"
  mkdir -p "$dir"
  sed "s|@HOST_PATH@|$sed_path|" "$template" > "$dir/$NAME.json.new"
  mv -f "$dir/$NAME.json.new" "$dir/$NAME.json"
  echo "Registered: $dir/$NAME.json"
}
write_manifest "$MANIFESTS/chrome.json" "$CHROME_DIR"
write_manifest "$MANIFESTS/firefox.json" "$FIREFOX_DIR"

# 檢查 yt-dlp 與 ffmpeg（橋接程式也會在 /opt/homebrew/bin、/usr/local/bin 中尋找）。
find_tool() {
  for dir in /opt/homebrew/bin /usr/local/bin; do
    if [ -x "$dir/$1" ]; then
      printf '%s\n' "$dir/$1"
      return 0
    fi
  done
  command -v "$1" 2>/dev/null || return 1
}

missing=""
for tool in yt-dlp ffmpeg; do
  if path=$(find_tool "$tool"); then
    echo "Found $tool: $path"
  else
    echo "Missing: $tool"
    missing="$missing $tool"
  fi
done

echo
if [ -n "$missing" ]; then
  echo "Downloads need yt-dlp and ffmpeg. Install them with Homebrew (https://brew.sh):"
  echo
  echo "    brew install yt-dlp ffmpeg"
  echo
fi
if ! find_tool deno >/dev/null 2>&1; then
  echo "yt-dlp recommends a JavaScript runtime for full YouTube support. If some qualities are missing, run:"
  echo
  echo "    brew install deno"
  echo
fi
echo "Done. Restart Chrome or Firefox if it was open, then click \"Check again\" in the extension's download panel."

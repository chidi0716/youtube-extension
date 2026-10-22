#!/usr/bin/env bash
# 階段 3 冒煙測試：用真正的 yt-dlp 對一部短影片執行一次 -J（getInfo 的參數），
# 輸出存到 spikes/stage3/.cache/，用來確認精簡欄位的來源。只執行一次，不下載。
# 遇到 YouTube 的驗證或阻擋就停止，不繞過。
#
# 用法：spikes/stage3/smoke-info.sh <影片 ID>
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
cache="$here/.cache"
id="${1:?video id}"
case "$id" in
  *[!A-Za-z0-9_-]*) echo "bad id" >&2; exit 2 ;;
esac

set +e
timeout 120 "$cache/bin/yt-dlp" --ignore-config -J --no-playlist --ignore-no-formats-error \
  -- "https://www.youtube.com/watch?v=$id" >"$cache/info-$id.json" 2>"$cache/info-$id.err"
echo "exit=$?"
set -e
wc -c "$cache/info-$id.json"
tail -n 5 "$cache/info-$id.err"

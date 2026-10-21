#!/usr/bin/env bash
# T00 實驗：以 headless Firefox 載入暫時附加元件，觀察 MV3 事件頁面在
# connectNative 連線開著時是否被暫停。
#
# 用法：spikes/T00/run.sh <silent|heartbeat|control> [秒數，預設 150]
# Firefox 執行檔：環境變數 FIREFOX，預設 spikes/T00/.cache/ff/firefox/firefox
# 結果：spikes/T00/results/<mode>.host.log（host 記錄）、<mode>.web-ext.log
set -euo pipefail

MODE=${1:?usage: run.sh <silent|heartbeat|control> [seconds]}
DURATION=${2:-150}
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
CACHE=$HERE/.cache
FF=${FIREFOX:-$CACHE/ff/firefox/firefox}

# 把 HOME 與 TMPDIR 指到工作目錄內，Firefox 會從
# $HOME/.mozilla/native-messaging-hosts 讀取原生訊息設定檔，
# 不會碰到真正的家目錄或 /tmp。
export HOME=$CACHE/home-$MODE
export TMPDIR=$CACHE/tmp-$MODE
BUILD=$CACHE/build-$MODE
rm -rf "$HOME" "$TMPDIR" "$BUILD"
mkdir -p "$HOME/.mozilla/native-messaging-hosts" "$TMPDIR" "$HERE/results"

export T00_LOG=$HERE/results/$MODE.host.log
: > "$T00_LOG"

cat > "$HOME/.mozilla/native-messaging-hosts/com.chidi0716.t00_spike.json" <<EOF
{
  "name": "com.chidi0716.t00_spike",
  "description": "T00 spike host",
  "path": "$HERE/host/spike_host.py",
  "type": "stdio",
  "allowed_extensions": ["t00-spike@chidi0716"]
}
EOF

cp -r "$HERE/ext" "$BUILD"
echo "self.T00_MODE = '$MODE';" > "$BUILD/mode.js"

echo "[$MODE] start $(date -u +%FT%TZ), duration ${DURATION}s, firefox: $("$FF" --version)"
timeout --signal=INT "$DURATION" \
  "$ROOT/node_modules/.bin/web-ext" run \
    --source-dir "$BUILD" \
    --firefox "$FF" \
    --arg=--headless \
    --no-reload --no-input --verbose \
  > "$HERE/results/$MODE.web-ext.log" 2>&1 || true
echo "[$MODE] end $(date -u +%FT%TZ)"
cat "$T00_LOG"

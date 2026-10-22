#!/bin/sh
# T26：依序執行全部假頁面測試、端到端測試與 Firefox 冒煙測試，結果寫到 spikes/stage4/.cache/final-*.txt。
# 截圖寫到 spikes/stage4/.cache/shots-reg（不覆蓋 specs/notes/screenshots）。
# 需要先執行 sh spikes/stage4/build-host.sh、npm run build、npm run build:firefox，
# Firefox 冒煙測試另需 bash spikes/T00/fetch-firefox.sh。
#   sh spikes/stage4/run-all-fixtures.sh
root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$root"
out=spikes/stage4/.cache
export SHOTS="$out/shots-reg" PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1
status=0
run() {
  name=$1
  shift
  timeout 1800 node "$@" > "$out/final-$name.txt" 2>&1
  code=$?
  [ $code -ne 0 ] && status=1
  echo "$name exit=$code $(grep -E 'passed' "$out/final-$name.txt" | tail -1)"
  grep '^FAIL' "$out/final-$name.txt" | head -5
}
run viewing spikes/stage1-smoke/viewing-test.mjs
run convenience spikes/stage1-smoke/convenience-test.mjs
run fixture spikes/stage1-smoke/fixture-test.mjs
run downloads spikes/stage1-smoke/downloads-test.mjs
run gallery spikes/stage1-smoke/gallery-shot.mjs
run t08a spikes/T08a/repro.mjs
run e2e spikes/stage4/e2e-test.mjs
run toolbar spikes/stage6/toolbar-test.mjs
run language spikes/stage7/language-test.mjs
run firefox spikes/stage4/firefox-smoke.mjs
exit $status

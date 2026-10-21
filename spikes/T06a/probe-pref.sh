#!/usr/bin/env bash
# T06a 實測：以不同的 PREF cookie 取得 YouTube 首頁，看伺服器輸出的 <html> 標籤是否帶 dark 屬性，
# 以及頁面設定中的主題相關值。每個請求間隔 2 秒，只取首頁一次。
# 用法：spikes/T06a/probe-pref.sh
set -u
for value in "" "f6=400" "f6=80000" "f6=480" "f6=80400" "f6=8" "f6=40000400" "f4=4000000&f6=400&hl=en"; do
  if [ -n "$value" ]; then
    html=$(curl -sS -m 30 -H 'Accept-Language: en-US' -H "Cookie: PREF=$value" 'https://www.youtube.com/')
  else
    html=$(curl -sS -m 30 -H 'Accept-Language: en-US' 'https://www.youtube.com/')
  fi
  tag=$(printf '%s' "$html" | grep -o '<html[^>]*>' | head -1)
  echo "PREF=[$value] $tag"
  sleep 2
done

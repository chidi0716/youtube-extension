#!/usr/bin/env bash
# T06a 實測：比較不同 PREF 下，首頁 HTML 中與主題有關的設定值（只列出名稱含 theme 的鍵）。
# 用法：spikes/T06a/probe-theme-config.sh
set -u
for value in "" "f6=400" "f6=80000"; do
  if [ -n "$value" ]; then
    html=$(curl -sS -m 30 -H 'Accept-Language: en-US' -H "Cookie: PREF=$value" 'https://www.youtube.com/')
  else
    html=$(curl -sS -m 30 -H 'Accept-Language: en-US' 'https://www.youtube.com/')
  fi
  echo "== PREF=[$value]"
  printf '%s' "$html" | grep -oE '"[A-Za-z_]*[Tt][Hh][Ee][Mm][Ee][A-Za-z_]*":[^,}]{0,60}' | sort -u | head -40
  sleep 2
done

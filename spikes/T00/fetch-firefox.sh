#!/usr/bin/env bash
# 從 archive.mozilla.org 下載官方 Firefox（Linux x86_64），驗證 SHA-256 後解壓到
# spikes/T00/.cache/ff/firefox/（已列入 .gitignore）。
# 用法：spikes/T00/fetch-firefox.sh [版本，預設 158.0.1]
set -euo pipefail

VERSION=${1:-158.0.1}
HERE=$(cd "$(dirname "$0")" && pwd)
DL=$HERE/.cache/dl
FF=$HERE/.cache/ff
BASE=https://archive.mozilla.org/pub/firefox/releases/$VERSION
FILE=firefox-$VERSION.tar.xz

mkdir -p "$DL"
rm -rf "$FF"
mkdir -p "$FF"
curl -sS -o "$DL/$FILE" "$BASE/linux-x86_64/en-US/$FILE"
curl -sS -o "$DL/SHA256SUMS" "$BASE/SHA256SUMS"
expected=$(grep " linux-x86_64/en-US/$FILE\$" "$DL/SHA256SUMS" | cut -d' ' -f1)
echo "$expected  $DL/$FILE" | sha256sum -c
tar -xJf "$DL/$FILE" -C "$FF"
"$FF/firefox/firefox" --version

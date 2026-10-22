#!/bin/sh
# T26 最終檢查：建置、型別檢查、單元測試、橋接程式（go vet、go test）、web-ext lint。
# Go 的模組與建置快取放在工作目錄內（spikes/stage4/.cache/go/），不使用家目錄中的快取。
# 假頁面與端到端測試腳本另外執行（見 specs/notes/T26-final-check.md）。
#   sh spikes/stage4/final-check.sh
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
cache="$root/spikes/stage4/.cache"
mkdir -p "$cache/go/mod" "$cache/go/build"
export GOTOOLCHAIN=local GOMODCACHE="$cache/go/mod" GOCACHE="$cache/go/build" GOFLAGS=-modcacherw
cd "$root"
step() { echo "== $*"; }
step compile; npm run --silent compile
step test; npx vitest run 2>&1 | grep -E "Test Files|Tests "
step build; npm run --silent build > /dev/null && echo ok
step build:firefox; npm run --silent build:firefox > /dev/null && echo ok
step build:host; npm run --silent build:host 2>&1 | tail -3
step "go vet"; (cd host && go vet ./... && echo ok)
step "go test"; (cd host && go test ./... 2>&1 | grep -vE "no test files")
step "web-ext lint"; npx web-ext lint -s .output/firefox-mv3 --output json 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log(JSON.stringify(r.summary), r.warnings.map(w=>w.code+' '+w.file).join('; '))})"

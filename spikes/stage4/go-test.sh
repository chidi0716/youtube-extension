#!/bin/sh
# 以工作目錄內的 Go 快取執行橋接程式的測試（不使用家目錄中的快取）。
#   sh spikes/stage4/go-test.sh
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
cache="$root/spikes/stage4/.cache"
mkdir -p "$cache/go/mod" "$cache/go/build"
export GOTOOLCHAIN=local GOMODCACHE="$cache/go/mod" GOCACHE="$cache/go/build" GOFLAGS=-modcacherw
cd "$root/host"
go test ./...

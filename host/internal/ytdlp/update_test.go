package ytdlp

import (
	"context"
	"testing"
)

func TestParseUpdateOutput(t *testing.T) {
	r := ParseUpdateOutput("Current version: stable@2026.09.01 from yt-dlp/yt-dlp\nLatest version: stable@2026.10.21 from yt-dlp/yt-dlp\nCurrent Build Hash: abc\nUpdating to stable@2026.10.21 from yt-dlp/yt-dlp ...\nUpdated yt-dlp to stable@2026.10.21 from yt-dlp/yt-dlp\n")
	if !r.Ran || !r.Updated || r.UpToDate || r.Version != "stable@2026.10.21" {
		t.Errorf("updated: %+v", r)
	}
	r = ParseUpdateOutput("Latest version: stable@2026.10.21 from yt-dlp/yt-dlp\nyt-dlp is up to date (stable@2026.10.21 from yt-dlp/yt-dlp)\n")
	if r.Updated || !r.UpToDate || r.Version != "stable@2026.10.21" {
		t.Errorf("up to date: %+v", r)
	}
}

func TestUpdate(t *testing.T) {
	tools := fakeTools(t)
	r, err := tools.Update(context.Background())
	if err != nil || !r.Ran || !r.UpToDate {
		t.Fatalf("standalone: %+v %v", r, err)
	}
	// Homebrew 安裝：不執行 -U，只回傳更新指令。
	brew := &Tools{Env: fakeEnv("darwin", nil), YtDlp: "/opt/homebrew/bin/yt-dlp"}
	r, err = brew.Update(context.Background())
	if err != nil || r.Ran || r.Manager != "homebrew" || r.Command != "brew upgrade yt-dlp" {
		t.Fatalf("homebrew: %+v %v", r, err)
	}
	win := &Tools{Env: fakeEnv("windows", nil), YtDlp: `C:\Users\me\AppData\Local\Microsoft\WinGet\Links\yt-dlp.exe`}
	r, err = win.Update(context.Background())
	if err != nil || r.Ran || r.Command != "winget upgrade --id yt-dlp.yt-dlp" {
		t.Fatalf("winget: %+v %v", r, err)
	}
	if _, err := (&Tools{Env: fakeEnv("darwin", nil)}).Update(context.Background()); err == nil {
		t.Fatal("missing yt-dlp must fail")
	}
}

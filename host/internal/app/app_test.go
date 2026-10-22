package app

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/chidi0716/youtube-extension/host/internal/errs"
	"github.com/chidi0716/youtube-extension/host/internal/testenv"
	"github.com/chidi0716/youtube-extension/host/internal/ytdlp"
)

func TestMain(m *testing.M) { testenv.Main(m) }

// envWithPath 讓 App 只在 dir 中尋找執行檔（不受測試機器上安裝的程式影響）。
func envWithPath(dir string) ytdlp.Env {
	e := ytdlp.SystemEnv()
	e.GOOS = runtime.GOOS
	e.Getenv = func(k string) string {
		if k == "PATH" {
			return dir
		}
		return os.Getenv(k)
	}
	e.LookPath = func(name string) (string, error) {
		p := filepath.Join(dir, name)
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p, nil
		}
		return "", errors.New("not found")
	}
	e.Glob = func(string) ([]string, error) { return nil, nil }
	e.IsFile = func(string) bool { return false }
	return e
}

func TestStatus(t *testing.T) {
	a := &App{Version: "1.2.3", Env: envWithPath(testenv.FakeToolsDir(t, true))}
	v, err := a.Status(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	s := v.(*StatusResult)
	if !s.Ready || s.HostVersion != "1.2.3" || s.YtDlp.Version != "2026.10.21" || s.FFmpeg.Version != "7.1-fake" {
		t.Fatalf("%+v", s)
	}
	if s.DefaultDir == "" || len(s.NamePresets) != 4 || s.NamePresets[0].ID != "title-id" {
		t.Fatalf("%+v", s)
	}

	a.Env = envWithPath(testenv.FakeToolsDir(t, false))
	v, _ = a.Status(context.Background())
	s = v.(*StatusResult)
	if s.Ready || !s.YtDlp.Found || s.FFmpeg.Found {
		t.Fatalf("without ffmpeg: %+v", s)
	}

	a.Env = envWithPath(t.TempDir())
	v, _ = a.Status(context.Background())
	s = v.(*StatusResult)
	if s.Ready || s.YtDlp.Found || s.FFmpeg.Found {
		t.Fatalf("nothing installed: %+v", s)
	}
}

func TestGetInfo(t *testing.T) {
	a := &App{Version: "x", Env: envWithPath(testenv.FakeToolsDir(t, true))}
	v, err := a.GetInfo(context.Background(), "jNQXAC9IVRw")
	if err != nil {
		t.Fatal(err)
	}
	if info := v.(*ytdlp.Info); info.ID != "jNQXAC9IVRw" || info.Title == "" {
		t.Fatalf("%+v", info)
	}
	a.Env = envWithPath(t.TempDir())
	if _, err := a.GetInfo(context.Background(), "jNQXAC9IVRw"); errs.From(err).Code != errs.YtDlpNotFound {
		t.Fatalf("missing: %v", err)
	}
}

// Package app 把各套件組合成 commands.Backend：指令的實際執行者。
package app

import (
	"context"
	"runtime"
	"sync"

	"github.com/chidi0716/youtube-extension/host/internal/errs"
	"github.com/chidi0716/youtube-extension/host/internal/jobs"
	"github.com/chidi0716/youtube-extension/host/internal/platform"
	"github.com/chidi0716/youtube-extension/host/internal/protocol"
	"github.com/chidi0716/youtube-extension/host/internal/validate"
	"github.com/chidi0716/youtube-extension/host/internal/ytdlp"
)

// App 實作 commands.Backend。
type App struct {
	Version string
	Env     ytdlp.Env
	Manager *jobs.Manager

	// infoSem 限制同時執行的 getInfo 數量。
	infoOnce sync.Once
	infoSem  chan struct{}
}

// New 建立 App。
func New(version string, m *jobs.Manager) *App {
	return &App{Version: version, Env: ytdlp.SystemEnv(), Manager: m}
}

// tools 每次重新尋找 yt-dlp 與 ffmpeg，讓使用者安裝後按「重新檢查」就能生效。
func (a *App) tools() *ytdlp.Tools { return ytdlp.Locate(a.Env) }

// ToolStatus 是 yt-dlp 或 ffmpeg 的狀態。
type ToolStatus struct {
	Found         bool   `json:"found"`
	Path          string `json:"path,omitempty"`
	Version       string `json:"version,omitempty"`
	Error         string `json:"error,omitempty"`         // 找到了但無法執行時的錯誤代碼
	Manager       string `json:"manager,omitempty"`       // homebrew、winget 等（只有 yt-dlp）
	UpdateCommand string `json:"updateCommand,omitempty"` // 由套件管理工具安裝時的更新指令
}

// PresetInfo 是檔名格式（給設定頁顯示）。
type PresetInfo struct {
	ID      string `json:"id"`
	Example string `json:"example"`
}

// StatusResult 是 status 指令的結果（plan 4.3）。
type StatusResult struct {
	HostVersion string       `json:"hostVersion"`
	OS          string       `json:"os"`
	Arch        string       `json:"arch"`
	Ready       bool         `json:"ready"` // yt-dlp 與 ffmpeg 都可以使用
	YtDlp       ToolStatus   `json:"ytDlp"`
	FFmpeg      ToolStatus   `json:"ffmpeg"`
	DefaultDir  string       `json:"defaultDir"`
	NamePresets []PresetInfo `json:"namePresets"`
}

// Status 實作 status 指令。找不到 yt-dlp 或 ffmpeg 不算錯誤，以 found=false 表示。
func (a *App) Status(ctx context.Context) (any, error) {
	t := a.tools()
	res := &StatusResult{
		HostVersion: a.Version,
		OS:          runtime.GOOS,
		Arch:        runtime.GOARCH,
		DefaultDir:  platform.DefaultDownloadDir(),
	}
	for _, p := range validate.NamePresets {
		res.NamePresets = append(res.NamePresets, PresetInfo{ID: p.ID, Example: p.Example})
	}
	var wg sync.WaitGroup
	if t.YtDlp != "" {
		res.YtDlp.Found, res.YtDlp.Path = true, t.YtDlp
		res.YtDlp.Manager = t.ManagerOf()
		res.YtDlp.UpdateCommand = ytdlp.UpdateCommand(a.Env.GOOS, res.YtDlp.Manager)
		wg.Add(1)
		go func() {
			defer wg.Done()
			v, err := t.YtDlpVersion(ctx)
			if err != nil {
				res.YtDlp.Error = string(errs.From(err).Code)
			}
			res.YtDlp.Version = v
		}()
	}
	if t.FFmpeg != "" {
		res.FFmpeg.Found, res.FFmpeg.Path = true, t.FFmpeg
		wg.Add(1)
		go func() {
			defer wg.Done()
			v, err := t.FFmpegVersion(ctx)
			if err != nil {
				res.FFmpeg.Error = string(errs.From(err).Code)
			}
			res.FFmpeg.Version = v
		}()
	}
	wg.Wait()
	res.Ready = res.YtDlp.Found && res.YtDlp.Error == "" && res.FFmpeg.Found && res.FFmpeg.Error == ""
	return res, nil
}

// maxInfoResult 是 getInfo 結果的大小上限，比 1MB 的訊息上限略小，保留外層欄位的空間。
const maxInfoResult = protocol.MaxOutgoing - 4096

// GetInfo 實作 getInfo 指令。
func (a *App) GetInfo(ctx context.Context, videoID string) (any, error) {
	a.infoOnce.Do(func() { a.infoSem = make(chan struct{}, 3) })
	select {
	case a.infoSem <- struct{}{}:
		defer func() { <-a.infoSem }()
	case <-ctx.Done():
		return nil, errs.New(errs.Unknown, "cancelled")
	}
	info, err := a.tools().GetInfo(ctx, videoID)
	if err != nil {
		return nil, err
	}
	return ytdlp.FitInfo(info, maxInfoResult), nil
}

func notYet() (any, error) { return nil, errs.New(errs.Unknown, "not implemented yet") }

// DownloadResult 是 download 與 cancel 指令的結果。
type DownloadResult struct {
	JobID string `json:"jobId"`
	State string `json:"state"`
}

// Download 實作 download 指令：先確認 yt-dlp 與 ffmpeg 可用，再建立工作並啟動執行程序。
func (a *App) Download(ctx context.Context, d *validate.Download) (any, error) {
	t := a.tools()
	if t.YtDlp == "" {
		return nil, errs.New(errs.YtDlpNotFound, "yt-dlp was not found")
	}
	if ytdlp.NeedsFFmpeg(d) && t.FFmpeg == "" {
		return nil, errs.New(errs.FFmpegNotFound, "ffmpeg was not found")
	}
	st, err := a.Manager.Start(d)
	if err != nil {
		return nil, err
	}
	return &DownloadResult{JobID: st.JobID, State: st.State}, nil
}

// Cancel 實作 cancel 指令。
func (a *App) Cancel(ctx context.Context, jobID string) (any, error) {
	st, err := a.Manager.Cancel(ctx, jobID)
	if err != nil {
		return nil, err
	}
	return &DownloadResult{JobID: st.JobID, State: st.State}, nil
}

// JobsResult 是 jobs 指令的結果。
type JobsResult struct {
	Jobs []jobs.JobView `json:"jobs"`
}

// Jobs 實作 jobs 指令：進行中與最近結束的工作（plan 4.3）。
func (a *App) Jobs(ctx context.Context) (any, error) {
	return &JobsResult{Jobs: a.Manager.List()}, nil
}

// Reveal 實作 reveal 指令（T14）。
func (a *App) Reveal(ctx context.Context, jobID string) (any, error) { return notYet() }

// PickFolder 實作 pickFolder 指令（T14）。
func (a *App) PickFolder(ctx context.Context) (any, error) { return notYet() }

// UpdateYtDlp 實作 updateYtDlp 指令（T14）。
func (a *App) UpdateYtDlp(ctx context.Context) (any, error) { return notYet() }

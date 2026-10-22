// Package app 把各套件組合成 commands.Backend：指令的實際執行者。
package app

import (
	"context"
	"runtime"
	"strings"
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
	Actions *platform.Actions

	updateMu sync.Mutex

	// infoSem 限制同時執行的 getInfo 數量。
	infoOnce sync.Once
	infoSem  chan struct{}
}

// New 建立 App。
func New(version string, m *jobs.Manager) *App {
	return &App{Version: version, Env: ytdlp.SystemEnv(), Manager: m, Actions: platform.NewActions()}
}

// tools 每次重新尋找 yt-dlp 與 ffmpeg，讓使用者安裝後按「重新檢查」就能生效。
func (a *App) tools() *ytdlp.Tools { return ytdlp.Locate(a.Env) }

// ToolStatus 是 yt-dlp、ffmpeg 或 deno 的狀態。
type ToolStatus struct {
	Found         bool   `json:"found"`
	Path          string `json:"path,omitempty"`
	Version       string `json:"version,omitempty"`
	Error         string `json:"error,omitempty"`         // 找不到或無法執行時的錯誤代碼（YTDLP_NOT_FOUND、FFMPEG_NOT_FOUND、DENO_NOT_FOUND）
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
	HostVersion string `json:"hostVersion"`
	OS          string `json:"os"`
	Arch        string `json:"arch"`
	// Ready：yt-dlp 與 ffmpeg 都可以使用（可以下載）。
	Ready bool `json:"ready"`
	// Complete：另外 deno 也可以使用（yt-dlp 能取得 YouTube 的完整格式）。
	Complete bool       `json:"complete"`
	YtDlp    ToolStatus `json:"ytDlp"`
	FFmpeg   ToolStatus `json:"ffmpeg"`
	Deno     ToolStatus `json:"deno"`
	// Missing 列出找不到或無法執行的元件（"yt-dlp"、"ffmpeg"、"deno"），依此順序。
	Missing []string `json:"missing"`
	// InstallCommand 是一次安裝全部缺少元件的指令（macOS：brew；Windows：winget），
	// 沒有缺少或其他作業系統時為空字串（002 FR-2）。
	InstallCommand string       `json:"installCommand"`
	DefaultDir     string       `json:"defaultDir"`
	NamePresets    []PresetInfo `json:"namePresets"`
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
	if t.Deno != "" {
		res.Deno.Found, res.Deno.Path = true, t.Deno
		wg.Add(1)
		go func() {
			defer wg.Done()
			v, err := t.DenoVersion(ctx)
			if err != nil {
				res.Deno.Error = string(errs.From(err).Code)
			}
			res.Deno.Version = v
		}()
	}
	wg.Wait()
	res.Missing = []string{}
	for _, c := range []struct {
		name string
		st   *ToolStatus
		code errs.Code
	}{{"yt-dlp", &res.YtDlp, errs.YtDlpNotFound}, {"ffmpeg", &res.FFmpeg, errs.FFmpegNotFound}, {"deno", &res.Deno, errs.DenoNotFound}} {
		if !c.st.Found {
			c.st.Error = string(c.code)
		}
		if c.st.Error != "" {
			res.Missing = append(res.Missing, c.name)
		}
	}
	res.Ready = res.YtDlp.Error == "" && res.FFmpeg.Error == ""
	res.Complete = res.Ready && res.Deno.Error == ""
	res.InstallCommand = InstallCommand(a.Env.GOOS, res.Missing)
	return res, nil
}

// InstallCommand 回傳一次安裝 missing 中全部元件的指令（002 FR-2）。
func InstallCommand(goos string, missing []string) string {
	if len(missing) == 0 {
		return ""
	}
	var pkgs []string
	for _, m := range missing {
		switch goos {
		case "darwin":
			pkgs = append(pkgs, m) // Homebrew 的套件名稱與元件名稱相同
		case "windows":
			pkgs = append(pkgs, map[string]string{"yt-dlp": "yt-dlp.yt-dlp", "ffmpeg": "Gyan.FFmpeg", "deno": "DenoLand.Deno"}[m])
		}
	}
	switch goos {
	case "darwin":
		return "brew install " + strings.Join(pkgs, " ")
	case "windows":
		return "winget install " + strings.Join(pkgs, " ")
	}
	return ""
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

// RevealResult 是 reveal 指令的結果。
type RevealResult struct {
	Path string `json:"path"`
}

// Reveal 實作 reveal 指令：在 Finder／檔案總管中選取已完成的檔案。
// 路徑來自橋接程式自己的工作紀錄，不接受擴充功能傳入路徑。
func (a *App) Reveal(ctx context.Context, jobID string) (any, error) {
	st, err := a.Manager.Get(jobID)
	if err != nil {
		return nil, err
	}
	if st.State != jobs.StateDone || st.Path == "" {
		return nil, errs.New(errs.JobNotFinished, "the download has not finished")
	}
	if err := a.Actions.Reveal(ctx, st.Path); err != nil {
		return nil, err
	}
	return &RevealResult{Path: st.Path}, nil
}

// PickFolder 實作 pickFolder 指令：開啟系統的選擇資料夾視窗（參數固定）。
func (a *App) PickFolder(ctx context.Context) (any, error) {
	return a.Actions.PickFolder(ctx)
}

// UpdateYtDlp 實作 updateYtDlp 指令。
func (a *App) UpdateYtDlp(ctx context.Context) (any, error) {
	if !a.updateMu.TryLock() {
		return nil, errs.New(errs.Busy, "an update is already running")
	}
	defer a.updateMu.Unlock()
	return a.tools().Update(ctx)
}

// yte-host 是本專案的原生訊息橋接程式（plan 第 4 節）。
//
// 兩種執行模式：
//   - 由瀏覽器以原生訊息（Native Messaging）啟動：經由 stdin/stdout 交換
//     「4 位元組長度＋JSON」的訊息，只接受 commands 套件定義的指令；
//   - --run-job <工作 ID>：由橋接程式自己以脫離瀏覽器的方式啟動，執行一個下載工作
//     （參數從狀態資料夾讀取並再驗證一次），讓瀏覽器關閉後下載仍能完成（plan 4.6）。
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/chidi0716/youtube-extension/host/internal/app"
	"github.com/chidi0716/youtube-extension/host/internal/commands"
	"github.com/chidi0716/youtube-extension/host/internal/jobs"
	"github.com/chidi0716/youtube-extension/host/internal/logx"
	"github.com/chidi0716/youtube-extension/host/internal/platform"
	"github.com/chidi0716/youtube-extension/host/internal/protocol"
	"github.com/chidi0716/youtube-extension/host/internal/validate"
	"github.com/chidi0716/youtube-extension/host/internal/ytdlp"
)

// version 在建置時以 -ldflags "-X main.version=..." 覆寫。
var version = "dev"

// 允許呼叫橋接程式的擴充功能（specs/notes/extension-ids.md）。
// 原生訊息設定檔已經限制只有本擴充功能能啟動橋接程式（FR-74），
// 這裡再依瀏覽器傳來的參數檢查一次。
const (
	chromeOrigin = "chrome-extension://bkjlangdjfpllnkcpfpdlajchbginjdj/"
	firefoxID    = "youtube-extension@chidi0716"
)

// WaitAfterDisconnect 是瀏覽器關閉連線後，等待這次連線開始的下載完成的時間上限（plan 4.6）。
const WaitAfterDisconnect = 6 * time.Hour

// identifyCaller 依瀏覽器啟動橋接程式時傳入的參數判斷呼叫者：
//   - Chrome：第一個參數是呼叫者的來源（chrome-extension://<ID>/），
//     Windows 上可能另有 --parent-window=<數字>；
//   - Firefox：第一個參數是原生訊息設定檔的路徑，第二個是附加元件 ID。
func identifyCaller(args []string) (string, bool) {
	if len(args) >= 1 && args[0] == chromeOrigin {
		return "chrome", true
	}
	if len(args) >= 2 && args[1] == firefoxID {
		return "firefox", true
	}
	return "", false
}

func store() *jobs.Store { return &jobs.Store{Dir: filepath.Join(platform.StateDir(), "jobs")} }

func main() {
	args := os.Args[1:]
	if len(args) == 1 && args[0] == "--version" {
		fmt.Println(version)
		return
	}
	if len(args) == 2 && args[0] == jobs.RunJobFlag {
		os.Exit(runJob(args[1]))
	}
	client, ok := identifyCaller(args)
	if !ok {
		fmt.Fprintln(os.Stderr, "yte-host: this program is started by the browser extension; it does not accept command-line arguments")
		os.Exit(2)
	}
	os.Exit(serve(client))
}

// serve 是瀏覽器模式。
func serve(client string) int {
	// 瀏覽器關閉連線後寫入 stdout 會收到 SIGPIPE；改為讓寫入回傳錯誤。
	signal.Notify(make(chan os.Signal, 1), syscall.SIGPIPE)
	log := logx.New(platform.LogDir(), "host")
	log.Printf("start %s (%s)", version, client)

	w := protocol.NewWriter(os.Stdout)
	m := &jobs.Manager{
		Store:  store(),
		Client: client,
		Spawn:  jobs.SpawnSelf,
		Emit:   func(ev *jobs.Event) error { return w.Send(ev) },
		Log:    log,
	}
	m.Init()
	ctx, cancel := context.WithCancel(context.Background())
	go m.Run(ctx)

	d := &commands.Dispatcher{Backend: app.New(version, m), Log: log}
	err := commands.Serve(ctx, os.Stdin, w, d)
	w.Close()
	cancel()
	log.Printf("disconnected")
	// 下載由獨立的執行程序負責；這裡只是等這次連線開始的下載結束再離開（最長 6 小時）。
	m.Wait(WaitAfterDisconnect)
	log.Printf("exit")
	if err != nil {
		return 1
	}
	return 0
}

// runJob 是執行程序模式。
func runJob(id string) int {
	log := logx.New(platform.LogDir(), "job")
	if err := validate.JobID(id); err != nil {
		log.Printf("run-job rejected: invalid id")
		return 2
	}
	r := &jobs.Runner{Store: store(), Tools: ytdlp.Locate(ytdlp.SystemEnv()), Log: log}
	st, err := r.Run(id)
	if err != nil {
		log.Printf("job %s: %v", id, err)
		return 1
	}
	if st.State != jobs.StateDone {
		return 1
	}
	return 0
}

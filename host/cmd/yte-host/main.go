// yte-host 是本專案的原生訊息橋接程式（plan 第 4 節）。
//
// 由瀏覽器以原生訊息（Native Messaging）啟動，經由 stdin/stdout 交換
// 「4 位元組長度＋JSON」的訊息。只接受 commands 套件定義的指令。
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/chidi0716/youtube-extension/host/internal/app"
	"github.com/chidi0716/youtube-extension/host/internal/commands"
	"github.com/chidi0716/youtube-extension/host/internal/protocol"
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

func main() {
	args := os.Args[1:]
	if len(args) == 1 && args[0] == "--version" {
		fmt.Println(version)
		return
	}
	if _, ok := identifyCaller(args); !ok {
		fmt.Fprintln(os.Stderr, "yte-host: this program is started by the browser extension; it does not accept command-line arguments")
		os.Exit(2)
	}
	// 瀏覽器關閉連線後寫入 stdout 會收到 SIGPIPE；改為讓寫入回傳錯誤。
	signal.Notify(make(chan os.Signal, 1), syscall.SIGPIPE)

	w := protocol.NewWriter(os.Stdout)
	d := &commands.Dispatcher{Backend: app.New(version)}
	if err := commands.Serve(context.Background(), os.Stdin, w, d); err != nil {
		os.Exit(1)
	}
}

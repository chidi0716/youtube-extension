// yte-host 是本專案的原生訊息橋接程式（plan 第 4 節）。
//
// T01 階段只有進入點，讓交叉編譯流程可以先跑起來；
// 通訊協定與指令從 T11 開始實作。
package main

import (
	"fmt"
	"os"
)

// version 在建置時以 -ldflags "-X main.version=..." 覆寫。
var version = "dev"

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--version" {
		fmt.Println(version)
		return
	}
	fmt.Fprintln(os.Stderr, "yte-host: native messaging protocol is not implemented yet")
	os.Exit(1)
}

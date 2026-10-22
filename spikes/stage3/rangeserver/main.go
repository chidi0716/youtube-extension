// 冒煙測試用的本機檔案伺服器：支援 Range（python http.server 不支援，ffmpeg 裁切需要）。
// 只綁定 127.0.0.1。用法：rangeserver <port> <dir>
package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	log.Fatal(http.ListenAndServe("127.0.0.1:"+os.Args[1], http.FileServer(http.Dir(os.Args[2]))))
}

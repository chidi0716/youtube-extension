// Package testenv 只給測試使用：讓 t.TempDir() 等暫存檔落在 repo 內的
// host/.testtmp/（已列入 .gitignore），不寫到系統的暫存資料夾。
package testenv

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// HostDir 回傳 host/ 資料夾的絕對路徑。
func HostDir() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
}

// Main 在 TestMain 中呼叫：設定暫存資料夾後執行測試。
func Main(m *testing.M) {
	dir := filepath.Join(HostDir(), ".testtmp")
	if err := os.MkdirAll(dir, 0o755); err == nil {
		tmp, err := os.MkdirTemp(dir, "run-")
		if err == nil {
			os.Setenv("TMPDIR", tmp)
			os.Setenv("TMP", tmp)
			os.Setenv("TEMP", tmp)
			code := m.Run()
			os.RemoveAll(tmp)
			os.Exit(code)
		}
	}
	os.Exit(m.Run())
}

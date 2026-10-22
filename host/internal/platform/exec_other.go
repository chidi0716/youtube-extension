//go:build !windows

package platform

import "os/exec"

// HideConsole 讓子程序不顯示主控台視窗（只有 Windows 需要）。
func HideConsole(cmd *exec.Cmd) {}

// knownDownloadsDir 只在 Windows 上查詢已知資料夾。
func knownDownloadsDir() string { return "" }

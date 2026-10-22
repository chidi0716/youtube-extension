//go:build !windows

package platform

import "os/exec"

// HideConsole 讓子程序不顯示主控台視窗（只有 Windows 需要）。
func HideConsole(cmd *exec.Cmd) {}

// setCmdLine 只在 Windows 上指定原始命令列。
func setCmdLine(cmd *exec.Cmd, line string) {}

// knownDownloadsDir 只在 Windows 上查詢已知資料夾。
func knownDownloadsDir() string { return "" }

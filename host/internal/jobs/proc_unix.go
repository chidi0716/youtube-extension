//go:build !windows

package jobs

import (
	"errors"
	"os"
	"os/exec"
	"syscall"
	"time"
)

// procTree 是 yt-dlp 與它啟動的 ffmpeg 等子程序（macOS：同一個程序群組）。
type procTree struct {
	pgid int
}

// startTree 讓 cmd 在自己的程序群組中執行，取消時可以一次結束整個群組（plan 4.6）。
func startTree(cmd *exec.Cmd) (*procTree, error) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.Setpgid = true
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return &procTree{pgid: cmd.Process.Pid}, nil
}

// terminate 先送 SIGTERM 給整個群組，exited 在 grace 內沒有關閉就改送 SIGKILL。
func (t *procTree) terminate(exited <-chan struct{}, grace time.Duration) {
	syscall.Kill(-t.pgid, syscall.SIGTERM)
	select {
	case <-exited:
	case <-time.After(grace):
	}
	syscall.Kill(-t.pgid, syscall.SIGKILL)
}

// killRemaining 結束群組中還留著的程序（例如 yt-dlp 結束後仍在執行的 ffmpeg）。
func (t *procTree) killRemaining() {
	syscall.Kill(-t.pgid, syscall.SIGKILL)
}

// close 釋放資源（Unix 不需要）。
func (t *procTree) close() {}

// spawnDetached 以脫離瀏覽器的方式啟動執行程序：新的工作階段（setsid），
// 瀏覽器結束橋接程式或關閉時不會一併結束下載。
func spawnDetached(exe string, args []string) (int, error) {
	cmd := exec.Command(exe, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	devnull, err := os.Open(os.DevNull)
	if err == nil {
		cmd.Stdin = devnull
		defer devnull.Close()
	}
	if err := cmd.Start(); err != nil {
		return 0, err
	}
	pid := cmd.Process.Pid
	go cmd.Wait() // 回收子程序，避免留下殭屍程序
	return pid, nil
}

// processAlive 回傳 PID 對應的程序是否還在。
func processAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	err := syscall.Kill(pid, 0)
	return err == nil || errors.Is(err, syscall.EPERM)
}

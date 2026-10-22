//go:build windows

package jobs

import (
	"errors"
	"fmt"
	"os/exec"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// procTree 是 yt-dlp 與它啟動的 ffmpeg 等子程序（Windows：Job Object）。
// Job 設定 JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE：執行程序結束（包括被強制結束）時，
// 作業系統會一併結束 Job 中的所有程序。
type procTree struct {
	job windows.Handle
}

// startTree 以暫停狀態建立 yt-dlp、加入 Job 後再恢復執行，
// 確保它啟動的任何子程序都在 Job 之中（plan 4.6）。
func startTree(cmd *exec.Cmd) (*procTree, error) {
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return nil, fmt.Errorf("CreateJobObject: %w", err)
	}
	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{
		BasicLimitInformation: windows.JOBOBJECT_BASIC_LIMIT_INFORMATION{
			LimitFlags: windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
		},
	}
	if _, err := windows.SetInformationJobObject(job, windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)), uint32(unsafe.Sizeof(info))); err != nil {
		windows.CloseHandle(job)
		return nil, fmt.Errorf("SetInformationJobObject: %w", err)
	}
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.CreationFlags |= windows.CREATE_SUSPENDED
	if err := cmd.Start(); err != nil {
		windows.CloseHandle(job)
		return nil, err
	}
	pid := uint32(cmd.Process.Pid)
	t := &procTree{job: job}
	ph, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, pid)
	if err == nil {
		err = windows.AssignProcessToJobObject(job, ph)
		windows.CloseHandle(ph)
	}
	if err != nil {
		cmd.Process.Kill()
		windows.CloseHandle(job)
		return nil, fmt.Errorf("AssignProcessToJobObject: %w", err)
	}
	if err := resumeProcess(pid); err != nil {
		t.killRemaining()
		t.close()
		return nil, err
	}
	return t, nil
}

// resumeProcess 恢復以 CREATE_SUSPENDED 建立的程序的所有執行緒。
func resumeProcess(pid uint32) error {
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPTHREAD, 0)
	if err != nil {
		return fmt.Errorf("CreateToolhelp32Snapshot: %w", err)
	}
	defer windows.CloseHandle(snap)
	var te windows.ThreadEntry32
	te.Size = uint32(unsafe.Sizeof(te))
	resumed := 0
	for err = windows.Thread32First(snap, &te); err == nil; err = windows.Thread32Next(snap, &te) {
		if te.OwnerProcessID != pid {
			continue
		}
		th, err := windows.OpenThread(windows.THREAD_SUSPEND_RESUME, false, te.ThreadID)
		if err != nil {
			continue
		}
		windows.ResumeThread(th)
		windows.CloseHandle(th)
		resumed++
	}
	if resumed == 0 {
		return errors.New("could not resume the yt-dlp process")
	}
	return nil
}

// terminate 結束 Job 中的所有程序。Windows 沒有可以讓程序自行收尾的訊號，直接結束。
func (t *procTree) terminate(exited <-chan struct{}, grace time.Duration) {
	windows.TerminateJobObject(t.job, 1)
	select {
	case <-exited:
	case <-time.After(grace):
	}
}

// killRemaining 結束 Job 中還留著的程序。
func (t *procTree) killRemaining() { windows.TerminateJobObject(t.job, 1) }

// close 關閉 Job（KILL_ON_JOB_CLOSE 會結束剩下的程序）。
func (t *procTree) close() {
	if t.job != 0 {
		windows.CloseHandle(t.job)
		t.job = 0
	}
}

// spawnDetached 以脫離瀏覽器的方式啟動執行程序：沒有主控台、新的程序群組，
// 並嘗試脫離瀏覽器的 Job（瀏覽器不允許時改為不脫離）。
func spawnDetached(exe string, args []string) (int, error) {
	start := func(flags uint32) (int, error) {
		cmd := exec.Command(exe, args...)
		cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: flags, HideWindow: true}
		if err := cmd.Start(); err != nil {
			return 0, err
		}
		pid := cmd.Process.Pid
		go cmd.Wait()
		return pid, nil
	}
	base := uint32(windows.CREATE_NEW_PROCESS_GROUP | windows.DETACHED_PROCESS)
	pid, err := start(base | windows.CREATE_BREAKAWAY_FROM_JOB)
	if err != nil {
		pid, err = start(base)
	}
	return pid, err
}

// processAlive 回傳 PID 對應的程序是否還在。
func processAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
	if err != nil {
		return false
	}
	defer windows.CloseHandle(h)
	var code uint32
	if err := windows.GetExitCodeProcess(h, &code); err != nil {
		return false
	}
	const stillActive = 259
	return code == stillActive
}

package installer

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// StateFileName 記錄安裝資料夾中各工具是依哪個清單版本安裝的（install-state.json）。
// deno 與 ffmpeg 的版本與清單不同時才重新下載（plan 4.9）；yt-dlp 安裝後由 yt-dlp -U 自己更新。
const StateFileName = "install-state.json"

// State 是 install-state.json 的內容。
type State struct {
	Tools map[string]string `json:"tools"` // 工具名稱 → 清單中的版本
}

// LoadState 讀取狀態；不存在或格式錯誤時回傳空的狀態。
func LoadState(installDir string) *State {
	s := &State{}
	if b, err := os.ReadFile(filepath.Join(installDir, StateFileName)); err == nil {
		json.Unmarshal(b, s)
	}
	if s.Tools == nil {
		s.Tools = map[string]string{}
	}
	return s
}

// Save 以「寫暫存檔再改名」的方式寫入狀態。
func (s *State) Save(installDir string) error {
	return writeJSONAtomic(filepath.Join(installDir, StateFileName), s)
}

func writeJSONAtomic(path string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp := path + ".tmp-" + randomSuffix()
	if err := os.WriteFile(tmp, append(b, '\n'), 0o644); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		os.Remove(tmp)
		return err
	}
	return nil
}

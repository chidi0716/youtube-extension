// Package release 定義本專案發佈清單 components.json 的格式、Ed25519 簽章驗證、
// 內建公鑰，以及小幫手與安裝流程可以連線的網址（plan 4.9、constitution 第 2 點）。
//
// 小幫手與安裝腳本只會連到這個檔案列出的網域；release 套件的測試會掃描原始碼，
// 確認沒有其他網域。
package release

import (
	"net/url"
	"strings"
)

// Repo 是本專案在 GitHub 上的位置。
const Repo = "chidi0716/youtube-extension"

// LatestBase 是最新正式版本的下載位置（不含預先發行版本）。
// 自動更新從這裡取得 components.json 與 components.json.sig。
const LatestBase = "https://github.com/" + Repo + "/releases/latest/download/"

// ManifestName、SignatureName 是發佈清單與簽章在 Release 中的檔名。
const (
	ManifestName  = "components.json"
	SignatureName = "components.json.sig"
)

// allowedPrefixes 是可以下載的網址前綴（https）。github.com 只允許指定專案的 Release；
// Release 的檔案會轉址到 GitHub 的檔案主機，那兩個主機只會出現在轉址中。
var allowedPrefixes = []string{
	"https://github.com/" + Repo + "/releases/",         // 本專案：小幫手、components.json
	"https://github.com/yt-dlp/yt-dlp/releases/",        // yt-dlp 官方
	"https://github.com/denoland/deno/releases/",        // deno 官方
	"https://github.com/yt-dlp/FFmpeg-Builds/releases/", // ffmpeg（Windows，yt-dlp 官方維護）
	"https://github.com/BtbN/FFmpeg-Builds/releases/",   // ffmpeg（Windows 的備用來源，plan 4.9）
	"https://ffmpeg.martin-riedl.de/download/",          // ffmpeg（macOS）
	"https://objects.githubusercontent.com/",            // GitHub Release 檔案的轉址目的地
	"https://release-assets.githubusercontent.com/",     // GitHub Release 檔案的轉址目的地（2025 年起）
}

// AllowedHosts 列出所有允許的網域（給文件與測試使用）。
func AllowedHosts() []string {
	seen := map[string]bool{}
	var out []string
	for _, p := range allowedPrefixes {
		u, _ := url.Parse(p)
		if !seen[u.Host] {
			seen[u.Host] = true
			out = append(out, u.Host)
		}
	}
	return out
}

// AllowedURL 回傳 u 是否是允許下載的網址：必須是 https、沒有帳號密碼與非標準連接埠，
// 且符合 allowedPrefixes 之一。路徑中的「..」一律拒絕。
func AllowedURL(u *url.URL) bool {
	if u == nil || u.Scheme != "https" || u.User != nil || u.Port() != "" || u.Opaque != "" {
		return false
	}
	if strings.Contains(u.Path, "..") || strings.Contains(u.EscapedPath(), "%2e%2e") || strings.Contains(strings.ToLower(u.EscapedPath()), "%2f") {
		return false
	}
	s := "https://" + strings.ToLower(u.Host) + u.EscapedPath()
	for _, p := range allowedPrefixes {
		if strings.HasPrefix(s, p) {
			return true
		}
	}
	return false
}

// AllowedURLString 是 AllowedURL 的字串版本。
func AllowedURLString(s string) bool {
	u, err := url.Parse(s)
	return err == nil && AllowedURL(u)
}

// ProjectDownloadURL 回傳本專案某個版本標籤的 Release 檔案網址。
func ProjectDownloadURL(tag, name string) string {
	return "https://github.com/" + Repo + "/releases/download/" + tag + "/" + name
}

// IsProjectReleaseURL 回傳 s 是否是本專案 Release 的固定版本檔案網址（不是 latest）。
func IsProjectReleaseURL(s string) bool {
	return strings.HasPrefix(s, "https://github.com/"+Repo+"/releases/download/") && AllowedURLString(s)
}

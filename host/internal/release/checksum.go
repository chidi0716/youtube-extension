package release

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"regexp"
	"strings"
)

var (
	gnuLineRe   = regexp.MustCompile(`^([0-9A-Fa-f]{64})\s+\*?(.+)$`)
	bsdLineRe   = regexp.MustCompile(`^SHA256 ?\((.+)\) ?= ?([0-9A-Fa-f]{64})$`)
	psHashRe    = regexp.MustCompile(`(?m)^\s*Hash\s*:\s*([0-9A-Fa-f]{64})\s*$`)
	psPathRe    = regexp.MustCompile(`(?m)^\s*Path\s*:\s*(.+?)\s*$`)
	bareHashRe  = regexp.MustCompile(`^\s*([0-9A-Fa-f]{64})\s*$`)
	psAlgoSHARe = regexp.MustCompile(`(?m)^\s*Algorithm\s*:\s*SHA256\s*$`)
)

// baseName 取路徑最後一段（同時接受 / 與 \）。
func baseName(p string) string {
	p = strings.TrimSpace(p)
	if i := strings.LastIndexAny(p, `/\`); i >= 0 {
		p = p[i+1:]
	}
	return p
}

// ParseChecksums 從官方公布的檢查碼檔案中找出 name 的 SHA256（小寫十六進位）。
// 支援的格式：
//
//   - sha256sum：`<hex>  <檔名>` 或 `<hex> *<檔名>`（yt-dlp 的 SHA2-256SUMS、FFmpeg-Builds 的
//     checksums.sha256、deno 的 macOS .sha256sum、ffmpeg.martin-riedl.de 的 .sha256）
//   - BSD：`SHA256 (<檔名>) = <hex>`
//   - PowerShell Get-FileHash 的輸出（deno 的 Windows .sha256sum）
//   - 整個檔案只有一個 SHA256
//
// 檔名只比對最後一段，不分大小寫。
func ParseChecksums(text, name string) (string, error) {
	want := strings.ToLower(baseName(name))
	for _, line := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n") {
		line = strings.TrimSpace(line)
		if m := gnuLineRe.FindStringSubmatch(line); m != nil && strings.ToLower(baseName(m[2])) == want {
			return strings.ToLower(m[1]), nil
		}
		if m := bsdLineRe.FindStringSubmatch(line); m != nil && strings.ToLower(baseName(m[1])) == want {
			return strings.ToLower(m[2]), nil
		}
	}
	if h := psHashRe.FindStringSubmatch(text); h != nil && psAlgoSHARe.MatchString(text) {
		if p := psPathRe.FindStringSubmatch(text); p != nil && strings.ToLower(baseName(p[1])) == want {
			return strings.ToLower(h[1]), nil
		}
	}
	if m := bareHashRe.FindStringSubmatch(text); m != nil {
		return strings.ToLower(m[1]), nil
	}
	return "", fmt.Errorf("no SHA256 for %s in the checksum file", name)
}

// HashReader 計算 r 的 SHA256（小寫十六進位）與長度。
func HashReader(r io.Reader) (string, int64, error) {
	h := sha256.New()
	n, err := io.Copy(h, r)
	if err != nil {
		return "", n, err
	}
	return hex.EncodeToString(h.Sum(nil)), n, nil
}

// HashBytes 計算 b 的 SHA256（小寫十六進位）。
func HashBytes(b []byte) string {
	s := sha256.Sum256(b)
	return hex.EncodeToString(s[:])
}

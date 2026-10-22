package ytdlp

import (
	"bufio"
	"io"
	"regexp"
	"strings"
)

var (
	vttTagRe    = regexp.MustCompile(`<[^>]*>`)
	vttEntities = strings.NewReplacer(
		"&amp;", "&", "&lt;", "<", "&gt;", ">", "&quot;", `"`, "&#39;", "'", "&apos;", "'",
		"&nbsp;", " ", "&lrm;", "", "&rlm;", "",
	)
)

// VTTToText 把 WebVTT 字幕轉成純文字（002 FR-41 的 TXT）：
// 去掉檔頭、NOTE／STYLE／REGION 區塊、時間碼、cue 識別碼與標籤，
// 並移除連續重複的行（YouTube 自動字幕會把上一行重複放在下一個 cue 中）。
func VTTToText(r io.Reader) (string, error) {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 64*1024), 4*1024*1024)

	var blocks [][]string
	var cur []string
	for sc.Scan() {
		line := strings.TrimRight(sc.Text(), "\r")
		line = strings.TrimPrefix(line, "\uFEFF") // 檔頭的 BOM
		if strings.TrimSpace(line) == "" {
			if len(cur) > 0 {
				blocks = append(blocks, cur)
				cur = nil
			}
			continue
		}
		cur = append(cur, line)
	}
	if err := sc.Err(); err != nil {
		return "", err
	}
	if len(cur) > 0 {
		blocks = append(blocks, cur)
	}

	var out []string
	for _, b := range blocks {
		// 只處理含有時間碼的區塊（cue）；檔頭、NOTE、STYLE、REGION 都沒有「-->」。
		timing := -1
		for i, l := range b {
			if strings.Contains(l, "-->") {
				timing = i
				break
			}
		}
		if timing < 0 {
			continue
		}
		for _, l := range b[timing+1:] {
			text := vttEntities.Replace(vttTagRe.ReplaceAllString(l, ""))
			text = strings.Join(strings.Fields(text), " ")
			if text == "" || (len(out) > 0 && out[len(out)-1] == text) {
				continue
			}
			out = append(out, text)
		}
	}
	if len(out) == 0 {
		return "", nil
	}
	return strings.Join(out, "\n") + "\n", nil
}

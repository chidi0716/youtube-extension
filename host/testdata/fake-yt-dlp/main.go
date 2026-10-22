// fake-yt-dlp 是測試用的假 yt-dlp：測試時編譯成 yt-dlp（Windows 為 yt-dlp.exe），
// 依環境變數模擬各種情境，並以與真正 yt-dlp 相同的格式輸出進度與最終路徑
// （依橋接程式傳入的 --progress-template 與 --print 範本代換）。
// 同一個執行檔以 ffmpeg 為檔名時，則模擬 ffmpeg -version。
//
// 環境變數：
//
//	FAKE_YTDLP_SCENARIO  ok（預設）、slow、login、bot、network、diskfull、outdated、
//	                     format、nosubs、unavailable、live、crash
//	FAKE_YTDLP_LOG       每次執行時把參數以 JSON 一行附加到這個檔案
//	FAKE_YTDLP_CHILD_PID slow 情境中，模擬 ffmpeg 的子程序 PID 寫到這個檔案
//	FAKE_YTDLP_VERSION   --version 的輸出（預設 2026.10.21）
package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

//go:embed info.json
var infoJSON string

const (
	title   = "測試影片: Fake/Video?"
	channel = "Fake Channel"
)

func main() {
	args := os.Args[1:]
	// 同一個執行檔複製成 ffmpeg 時，模擬 ffmpeg -version。
	if strings.HasPrefix(strings.ToLower(filepath.Base(os.Args[0])), "ffmpeg") {
		fmt.Println("ffmpeg version 7.1-fake Copyright (c) 2000-2024 the FFmpeg developers")
		return
	}
	if len(args) == 2 && args[0] == "--fake-child" {
		// 模擬 ffmpeg：一直睡到被結束為止。
		time.Sleep(120 * time.Second)
		return
	}
	if p := os.Getenv("FAKE_YTDLP_LOG"); p != "" {
		b, _ := json.Marshal(args)
		f, err := os.OpenFile(p, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
		if err == nil {
			f.Write(append(b, '\n'))
			f.Close()
		}
	}
	scenario := os.Getenv("FAKE_YTDLP_SCENARIO")
	opts := parse(args)

	switch {
	case opts.has("--version"):
		v := os.Getenv("FAKE_YTDLP_VERSION")
		if v == "" {
			v = "2026.10.21"
		}
		fmt.Println(v)
		return
	case opts.has("-U"):
		fmt.Println("Latest version: stable@2026.10.21 from yt-dlp/yt-dlp")
		fmt.Println("yt-dlp is up to date (stable@2026.10.21 from yt-dlp/yt-dlp)")
		return
	}

	if opts.url == "" || !strings.HasPrefix(opts.url, "https://www.youtube.com/watch?v=") {
		fail("ERROR: fake-yt-dlp expects a YouTube watch URL after --")
	}
	id := strings.TrimPrefix(opts.url, "https://www.youtube.com/watch?v=")

	switch scenario {
	case "login":
		fail("ERROR: [youtube] " + id + ": Sign in to confirm your age. This video may be inappropriate for some users.")
	case "bot":
		fail("ERROR: [youtube] " + id + ": Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication.")
	case "network":
		fail("ERROR: [youtube] " + id + ": Unable to download webpage: <urlopen error [Errno 8] nodename nor servname provided, or not known>")
	case "outdated":
		fail("ERROR: [youtube] " + id + ": Signature extraction failed: Some formats may be missing; please report this issue on https://github.com/yt-dlp/yt-dlp/issues")
	case "unavailable":
		fail("ERROR: [youtube] " + id + ": Video unavailable. This video has been removed by the uploader")
	case "crash":
		fmt.Fprintln(os.Stderr, "Traceback (most recent call last):")
		os.Exit(1)
	case "live":
		// 真正的 yt-dlp 在 --match-filters 不符時安靜地略過，結束代碼為 0。
		return
	}

	if opts.has("-J") {
		fmt.Println(strings.ReplaceAll(infoJSON, "FAKEVIDEOID", id))
		return
	}

	if scenario == "format" {
		fail("ERROR: [youtube] " + id + ": Requested format is not available. Use --list-formats for a list of available formats")
	}
	home := opts.value("-P")
	if home == "" {
		fail("ERROR: fake-yt-dlp expects -P")
	}
	if err := os.MkdirAll(home, 0o755); err != nil {
		fail("ERROR: unable to create directory " + err.Error())
	}
	base := expand(opts.value("-o"), id)

	if opts.has("--skip-download") {
		if scenario == "nosubs" {
			fmt.Fprintln(os.Stderr, "WARNING: There are no subtitles for the requested languages")
			return
		}
		lang := opts.value("--sub-langs")
		ext := "vtt"
		if opts.value("--convert-subs") == "srt" {
			ext = "srt"
		}
		name := strings.TrimSuffix(base, ".%(ext)s") + "." + lang + "." + ext
		content := sampleVTT
		if ext == "srt" {
			content = sampleSRT
		}
		os.WriteFile(filepath.Join(home, name), []byte(content), 0o644)
		return
	}

	ext := "mp4"
	switch {
	case opts.has("-x"):
		ext = opts.value("--audio-format")
	case opts.value("--merge-output-format") != "":
		ext = opts.value("--merge-output-format")
	}
	final := filepath.Join(home, strings.ReplaceAll(base, "%(ext)s", ext))
	parts := strings.Split(opts.value("-f"), "+")
	if opts.has("-x") {
		parts = []string{"251"}
	}

	progress := opts.template("--progress-template", "download:")
	post := opts.template("--progress-template", "postprocess:")

	if scenario == "slow" {
		part := final + ".part"
		os.WriteFile(part, []byte("partial"), 0o644)
		os.WriteFile(filepath.Join(home, "fragment.ytdl"), []byte("x"), 0o644)
		self, _ := os.Executable()
		child := exec.Command(self, "--fake-child", "x")
		if err := child.Start(); err == nil {
			if p := os.Getenv("FAKE_YTDLP_CHILD_PID"); p != "" {
				os.WriteFile(p, []byte(strconv.Itoa(child.Process.Pid)), 0o644)
			}
		}
		for i := 0; i < 600; i++ {
			emitProgress(progress, parts[0], "downloading", float64(i), 1000)
			time.Sleep(100 * time.Millisecond)
		}
		fail("ERROR: slow scenario timed out")
	}

	if scenario == "diskfull" {
		emitProgress(progress, parts[0], "downloading", 10, 100)
		os.WriteFile(final+".part", []byte("partial"), 0o644)
		fail("ERROR: unable to write data: [Errno 28] No space left on device")
	}

	for _, f := range parts {
		for _, n := range []float64{0, 25, 50, 75, 100} {
			status := "downloading"
			if n == 100 {
				status = "finished"
			}
			emitProgress(progress, f, status, n*10, 1000)
		}
	}
	for _, pp := range []string{"Merger", "Metadata", "MoveFiles"} {
		emitPost(post, pp, "started")
		emitPost(post, pp, "finished")
	}
	if err := os.WriteFile(final, []byte("fake media for "+id), 0o644); err != nil {
		fail("ERROR: unable to write file: " + err.Error())
	}
	if pt := opts.value("--print"); pt != "" {
		pt = strings.TrimPrefix(pt, "after_move:")
		b, _ := json.Marshal(final)
		fmt.Println(strings.ReplaceAll(pt, "%(filepath)j", string(b)))
	}
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, msg)
	os.Exit(1)
}

var progressFieldsRe = regexp.MustCompile(`%\(progress\.\{[^}]*\}\)j`)

func emitProgress(tmpl, formatID, status string, done, total float64) {
	if tmpl == "" {
		return
	}
	p, _ := json.Marshal(map[string]any{
		"status": status, "downloaded_bytes": done, "total_bytes": total, "speed": 1234.5, "eta": 3,
	})
	f, _ := json.Marshal(formatID)
	s := progressFieldsRe.ReplaceAllLiteralString(tmpl, string(p))
	fmt.Println(strings.ReplaceAll(s, "%(info.format_id)j", string(f)))
}

func emitPost(tmpl, name, status string) {
	if tmpl == "" {
		return
	}
	n, _ := json.Marshal(name)
	st, _ := json.Marshal(status)
	s := strings.ReplaceAll(tmpl, "%(progress.postprocessor)j", string(n))
	fmt.Fprintln(os.Stderr, strings.ReplaceAll(s, "%(progress.status)j", string(st)))
}

// expand 代換橋接程式內建檔名格式用到的欄位，並模擬 --windows-filenames。
func expand(tmpl, id string) string {
	safe := strings.NewReplacer(":", "：", "/", "⧸", "?", "？").Replace(title)
	r := strings.NewReplacer(
		"%(title)s", safe,
		"%(id)s", id,
		"%(channel,uploader|Unknown)s", channel,
		"%(upload_date>%Y-%m-%d|Unknown)s", "2024-01-02",
	)
	return r.Replace(tmpl)
}

type options struct {
	flags  map[string][]string
	url    string
	single map[string]bool
}

// 會帶值的選項（其他都當作開關）。
var withValue = map[string]bool{
	"-P": true, "-o": true, "-f": true, "--progress-template": true, "--print": true,
	"--match-filters": true, "--ffmpeg-location": true, "--merge-output-format": true,
	"--download-sections": true, "--audio-format": true, "--audio-quality": true,
	"--sub-langs": true, "--sub-format": true, "--convert-subs": true,
}

func parse(args []string) options {
	o := options{flags: map[string][]string{}, single: map[string]bool{}}
	for i := 0; i < len(args); i++ {
		a := args[i]
		if a == "--" {
			if i+1 < len(args) {
				o.url = args[i+1]
			}
			break
		}
		if withValue[a] && i+1 < len(args) {
			o.flags[a] = append(o.flags[a], args[i+1])
			i++
			continue
		}
		o.single[a] = true
	}
	return o
}

func (o options) has(flag string) bool { return o.single[flag] }

func (o options) value(flag string) string {
	v := o.flags[flag]
	if len(v) == 0 {
		return ""
	}
	return v[len(v)-1]
}

func (o options) template(flag, prefix string) string {
	for _, v := range o.flags[flag] {
		if strings.HasPrefix(v, prefix) {
			return strings.TrimPrefix(v, prefix)
		}
	}
	return ""
}

const sampleVTT = `WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:02.000
Hello <c>world</c>

00:00:02.000 --> 00:00:04.000
Hello world
second line &amp; more
`

const sampleSRT = `1
00:00:00,000 --> 00:00:02,000
Hello world
`

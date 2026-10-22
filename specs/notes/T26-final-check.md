# T26 最終檢查

日期：2026-10-22　負責：實作方　檢查的版本：階段 4b（T18a、T15b）與階段 5（T24、T25）提交之後

## 1. 權限（plan 3.2）

`npm run build`、`npm run build:firefox` 產生的兩份 manifest：

| | Chrome（`.output/chrome-mv3`） | Firefox（`.output/firefox-mv3`） | plan 3.2 |
|---|---|---|---|
| `permissions` | `storage`、`downloads`、`notifications`、`nativeMessaging` | 同左 | 同左 |
| `host_permissions` | `*://*.youtube.com/*`、`https://i.ytimg.com/*` | 同左 | 同左 |
| `optional_permissions` | 無 | 無 | — |
| 內容腳本 `matches` | `*://*.youtube.com/*`（`tidy.js`、`youtube-page.js`〔MAIN world〕、`youtube.js`） | 同左 | 內容腳本使用 youtube.com 主機權限 |
| `web_accessible_resources`、`externally_connectable`、自訂 `content_security_policy` | 無 | 無 | — |

結果：與 plan 3.2 **完全一致**；沒有 `tabs`、`scripting`、`webRequest`、`<all_urls>`、`cookies`。
（`m.youtube.com` 與 YouTube Music 由內容腳本依主機名稱判斷不顯示工具列，001 FR-3a。）

## 2. 程式碼搜尋

範圍：`entrypoints/`、`components/`、`features/`、`utils/`、`public/` 的 `.ts`、`.tsx`、`.html`、`.css`（不含單元測試），以及建置結果 `.output/chrome-mv3`、`.output/firefox-mv3`。

| 項目 | 結果 |
|---|---|
| `eval(`、`new Function` | 原始碼與建置結果都沒有 |
| 字串形式的 `setTimeout`／`setInterval` | 沒有 |
| `dangerouslySetInnerHTML`、`innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write` | 原始碼沒有（只有 `components/icons.tsx` 說明「不使用 innerHTML」的註解）。建置結果中 Preact 本身含 `innerHTML` 指派，即 `lint-exceptions.md` 的既有例外，執行時不會走到 |
| 外部腳本或樣式網址 | 沒有。HTML 只載入擴充功能內的 `/chunks/*.js`、`/assets/*.css`；CSS 沒有 `@import` 或外部字型 |
| 分析或追蹤程式碼（analytics、gtag、sentry、telemetry 等） | 沒有 |
| 程式中的網址 | `https://www.youtube.com`（字幕網址解析）、`https://i.ytimg.com/vi/…`（縮圖）、`https://youtu.be/`（複製連結）、`https://github.com/chidi0716/youtube-extension#install-the-helper`（安裝說明連結）。建置結果另有 SVG／MathML 命名空間與 WXT 錯誤訊息中的文件網址（`wxt.dev`、`github.com/wxt-dev`、`developer.mozilla.org`），都只是字串，不會被請求 |

## 3. 橋接程式執行的外部程式

搜尋 `host/` 中所有 `exec.Command`／`exec.CommandContext`（測試與 `testdata` 除外）：

| 位置 | 執行的程式 | 用途 |
|---|---|---|
| `internal/ytdlp/run.go` | yt-dlp | `--version`、`-J`（getInfo）、下載、`-U`（updateYtDlp） |
| `internal/ytdlp/run.go` | ffmpeg | `-version`（status） |
| `internal/ytdlp/run.go` | deno | `--version`（status） |
| `internal/jobs/proc_unix.go`、`proc_windows.go` | 橋接程式自己（`os.Executable()` 加 `--run-job <id>`） | 脫離瀏覽器的下載執行程序（Q35） |
| `internal/platform/actions.go` | macOS：`/usr/bin/open -R`、`/usr/bin/osascript`；Windows：`%SystemRoot%\explorer.exe /select,`、`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe` | reveal、pickFolder（T14） |

結果：只有 yt-dlp、ffmpeg、deno、橋接程式本身，以及 T14 列出的系統指令。ffmpeg 由 yt-dlp 呼叫（`--ffmpeg-location`）。
橋接程式沒有 `net.Listen`、`net.Dial` 或 HTTP 用戶端（002 FR-75）。

## 4. 建置與測試

| 項目 | 結果 |
|---|---|
| `npm run compile` | 通過（0 個錯誤） |
| `npm test` | 29 個測試檔、334 項通過 |
| `npm run build`、`npm run build:firefox` | 通過 |
| `npm run build:host` | 通過（`host/dist/youtube-extension-host-macos`、`…-windows`） |
| `cd host && GOTOOLCHAIN=local go vet ./...` | 通過 |
| `cd host && GOTOOLCHAIN=local go test ./...` | 通過（app、commands、e2e、jobs、logx、platform、protocol、validate、ytdlp、cmd/yte-host） |
| `npx web-ext lint -s .output/firefox-mv3` | 0 個錯誤、0 個 notice、2 個警告（皆為 `lint-exceptions.md` 的既有例外） |
| `spikes/stage1-smoke/viewing-test.mjs` | 110/110 |
| `spikes/stage1-smoke/convenience-test.mjs` | 72/72 |
| `spikes/stage1-smoke/fixture-test.mjs` | 10/10 |
| `spikes/stage1-smoke/downloads-test.mjs` | 41/41 |
| `spikes/stage1-smoke/gallery-shot.mjs` | 8/8 |
| `spikes/T08a/repro.mjs` | 正常結束（浮動播放器後開劇院模式，播放器維持原位） |
| `spikes/stage4/e2e-test.mjs`（真正的橋接程式＋假 yt-dlp） | 73/73（另有 1 項 SKIP：headless 無法點擊系統通知） |
| `spikes/stage4/firefox-smoke.mjs`（官方 Firefox 158.0.1） | 9/9（通知在 headless Firefox 無法確認，列為 SKIP） |

重現方式：`sh spikes/stage4/final-check.sh`（建置、單元測試、橋接程式、lint；Go 快取放在工作目錄內），
`sh spikes/stage4/build-host.sh && sh spikes/stage4/run-all-fixtures.sh`（全部假頁面、端到端與 Firefox 測試）。

## 5. 仍需專案擁有者實測的項目

完整清單見 [`specs/e2e-checklist.md`](../e2e-checklist.md)（「自動化」欄為「—」或「部分」的項目）。重點如下：

| 項目 | 原因 | 對照 |
|---|---|---|
| 深色模式在已登入、未登入、「使用裝置主題」三種狀態 | 本環境無法登入；Zen 已登入的深色→淺色已確認（2026-10-22 實測紀錄），其他狀態與 Chrome 未確認 | QUESTIONS Q15（已由 T06d 取代做法，但三種起始狀態仍待確認） |
| 劇院模式在 Chrome 的真實頁面 | Zen 已確認（Q19），Chrome 未實測 | Q19 |
| 首頁 Shorts 區塊、播完後推薦畫面的選擇器 | 本環境看不到登入後的首頁與播完畫面 | Q30 |
| 字幕直接下載是否常被 YouTube 擋下 | 只能在真實環境觀察 | Q32 |
| Zen 是否讀取 Mozilla 位置的原生訊息設定檔 | 本環境沒有 Zen | Q41 |
| 擴充功能正式名稱 | 專案擁有者尚未決定 | Q4 |
| 安裝與解除安裝腳本、Gatekeeper、Windows 登錄機碼 | 只在 Linux 上以模擬方式測試 | T15 筆記 |
| 點通知在 Finder／檔案總管顯示檔案、「顯示檔案」、pickFolder 的系統視窗（含「控制其他 App」權限提示） | Linux 上回應 UNSUPPORTED_PLATFORM；headless 無法點擊通知 | T16–T23 筆記 |
| 真實 yt-dlp 的下載結果：有聲音、可播放、封面與章節、裁切開頭與聲音同步、MP3 長度與位元率、WEBM 嵌入不失敗、AV1 4K 的播放相容性 | 端到端測試使用假 yt-dlp，只驗證參數與檔名 | 002、004 驗收條件 |
| 「更新 yt-dlp」在 Homebrew／winget 安裝時顯示指令 | 假 yt-dlp 不在套件管理工具的路徑 | 002 FR-60 |
| 瀏覽器重新啟動後補發完成通知、取消後沒有殘留的 yt-dlp／ffmpeg 程序 | 已在 Linux 自動化驗證；macOS（程序群組）與 Windows（Job Object）需實測 | Q35、Q44 |
| Firefox／Zen 上的工具列、觀看輔助與頁面整理 | 假頁面測試只用 Chromium；Firefox 只驗證了背景腳本與設定頁 | 001–005「Chrome、Firefox 上都符合以上各項」 |
| 子母畫面 | headless 無法開啟原生子母畫面 | 003 FR-30 至 FR-33 |

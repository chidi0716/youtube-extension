# youtube-extension

[English](./README.md) | **繁體中文**

一個 YouTube 瀏覽器擴充功能，在影片播放器下方加入一條看起來像 YouTube 原生介面的工具列，提供下載與觀看輔助功能。使用 [WXT](https://wxt.dev) + TypeScript 開發，支援 Chrome 與 Firefox（Zen 等以 Firefox 為基礎的瀏覽器比照 Firefox）。

> **狀態：**規劃的功能已全部完成，待在 macOS、Windows、Chrome 與 Firefox／Zen 上實測（見[實測檢查清單](./specs/e2e-checklist.md)）。

## 功能

影片觀看頁的播放器與標題之間會出現一條工具列，顏色跟著 YouTube 的淺色或深色外觀；按 ✕ 可以隱藏（從擴充功能的彈出視窗重新開啟），每個面板都可以釘選。可以自訂要顯示哪些工具與順序（「更多」→「編輯工具列」，或在設定頁），隱藏的工具仍可以從「更多」選單使用。

**下載工具**

- **影片**：由高到低的畫質清單（標示 8K／4K／2K／1080／HD）與檔案大小，預設為 MP4，「顯示更多格式」可選 WEBM。2K 以上 YouTube 沒有 H.264 版本，改以 AV1（或 VP9）合併成 MP4，並標示「部分播放器可能無法播放」。
- **MP3**：64–320 kbps（記住上次選擇）。
- 影片與 MP3 都可以設定**時間範圍**，只下載其中一段：區間滑桿、開始／結束輸入框、「與播放器同步」與「設為目前時間」。
- 自動在影片與 MP3 中嵌入封面、標題、頻道、上傳日期、網址與章節（可以關閉）。
- 工具列按鈕顯示進度，面板顯示速度與剩餘時間，可以取消、重試，錯誤訊息易懂；完成時顯示通知（點通知會顯示檔案）；關閉分頁或瀏覽器，下載仍會完成。
- **縮圖**（只列出實際存在的尺寸）、**字幕**（上傳的與自動產生的，SRT／VTT／TXT）與目前畫面的**截圖**不需要橋接程式，存到瀏覽器的下載位置；字幕直接下載失敗時改用 yt-dlp。
- 經由 yt-dlp 下載的影片、MP3 與字幕存到設定頁指定的資料夾，檔名格式可以選擇。

影片與 MP3 下載經由一個小型橋接程式，使用你電腦上的 [yt-dlp](https://github.com/yt-dlp/yt-dlp)、[ffmpeg](https://ffmpeg.org) 與 [deno](https://deno.com)；見[安裝下載功能](#install-the-helper)。

**觀看輔助**

- 深色模式（切換 YouTube 自己的外觀設定）、劇院模式（播放器與工具列以外變暗）、子母畫面
- 捲動時的浮動播放器（可拖到任一角落）、片段循環或重複 N 次
- 切換分頁時自動暫停、自動播放開關、純音訊模式、滑鼠滾輪調音量、隱藏留言
- 鎖定畫質（例如一律 1080p，手動改畫質時尊重你的選擇）
- 複製帶或不帶目前時間的 `youtu.be` 連結，或 Markdown 格式

**頁面整理**（在設定頁開關，於 YouTube 所有頁面作用，工具列隱藏時也有效）

- 永遠使用原始語音（不播放 AI 配音）；隱藏片尾推薦卡片與結尾畫面
- 自動關閉「要繼續觀看嗎？」；停用縮圖自動預覽
- Shorts 改用一般播放器；隱藏 Shorts；顯示完整影片標題

## 隱私與安全

- 不收集任何使用資料，只與 YouTube 及本機的橋接程式溝通。
- 不執行遠端程式碼：所有程式都打包在擴充功能內，不從 CDN 載入腳本，不使用 `eval`。
- 只申請必要的權限，內容腳本只在 `youtube.com` 執行。
- 影片在你的電腦上處理，不會上傳到任何第三方服務。

完整原則見 [`specs/constitution.md`](./specs/constitution.md)。

## 下載功能的運作方式

瀏覽器擴充功能無法直接執行 yt-dlp，所以會在你的電腦上安裝一支小型橋接程式（以 Go 撰寫），透過瀏覽器的原生訊息（Native Messaging）機制連線：

```
YouTube 上的工具列  →  擴充功能背景腳本  →  本機橋接程式  →  yt-dlp  →  ffmpeg
```

安裝方式見[安裝下載功能（橋接程式）](#install-the-helper)，只需安裝一次。縮圖、截圖、字幕與所有觀看輔助功能不需要橋接程式。

<a id="install-the-helper"></a>

## 安裝下載功能（橋接程式）

影片、MP3 下載（以及直接下載失敗時的字幕下載）需要在電腦上安裝四個程式：本專案的**橋接程式**、[yt-dlp](https://github.com/yt-dlp/yt-dlp)、[ffmpeg](https://ffmpeg.org) 與 [deno](https://deno.com)（yt-dlp 取得 YouTube 完整格式所需的 JavaScript 執行環境）。縮圖、截圖、字幕與所有觀看輔助功能不需要它們。全部只安裝給目前的使用者，不需要系統管理員權限或 `sudo`。

### 1. 建置橋接程式

目前還沒有預先建置好的下載檔。安裝 [Go](https://go.dev/dl/) 1.24 以上與 Node.js 後，在本 repo 中執行：

```bash
npm run build:host
```

會產生兩個可以直接使用的資料夾：`host/dist/youtube-extension-host-macos/` 與 `host/dist/youtube-extension-host-windows/`（內含橋接程式、安裝與解除安裝腳本、原生訊息設定檔範本）。

### 2a. macOS（Apple Silicon 與 Intel）

1. 以 [Homebrew](https://brew.sh) 安裝 yt-dlp、ffmpeg 與 deno：
   ```bash
   brew install yt-dlp ffmpeg deno
   ```
2. 執行安裝腳本（不要加 `sudo`）：
   ```bash
   sh host/dist/youtube-extension-host-macos/install.sh
   ```
   腳本會把橋接程式複製到 `~/Library/Application Support/youtube-extension-host/`、移除隔離屬性（避免被 Gatekeeper 阻擋）、為 Chrome（`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`）與 Firefox（`~/Library/Application Support/Mozilla/NativeMessagingHosts/`）註冊，並檢查 yt-dlp、ffmpeg 與 deno。
3. 重新啟動 Chrome 或 Firefox，打開 YouTube 影片，在「影片」或「MP3」面板按「重新檢查」。

### 2b. Windows 10/11（x64）

1. 以 [winget](https://learn.microsoft.com/windows/package-manager/winget/) 安裝 yt-dlp、ffmpeg 與 deno：
   ```powershell
   winget install yt-dlp.yt-dlp Gyan.FFmpeg DenoLand.Deno
   ```
2. 在 PowerShell 中執行安裝腳本（`-ExecutionPolicy Bypass` 只允許這一次執行腳本，不會改變你的設定）：
   ```powershell
   powershell -ExecutionPolicy Bypass -File host\dist\youtube-extension-host-windows\install.ps1
   ```
   腳本會把橋接程式複製到 `%LOCALAPPDATA%\youtube-extension-host\`、在同一個資料夾寫入原生訊息設定檔、建立登錄機碼 `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chidi0716.youtube_extension` 與 `HKCU\Software\Mozilla\NativeMessagingHosts\com.chidi0716.youtube_extension`，並檢查 yt-dlp、ffmpeg 與 deno。
3. 重新啟動 Chrome 或 Firefox，打開 YouTube 影片，在「影片」或「MP3」面板按「重新檢查」。

終端機不在 repo 資料夾時，請輸入腳本的完整路徑。執行 `npm run build:host` 後，也可以直接執行 repo 中的 `install/macos/install.sh` 或 `install/windows/install.ps1`。

### 更新

- **yt-dlp**：YouTube 經常改版，請保持 yt-dlp 為最新版本。在擴充功能設定頁按「更新 yt-dlp」；若 yt-dlp 是以 Homebrew 或 winget 安裝，按鈕會改為顯示要執行的指令（`brew upgrade yt-dlp` 或 `winget upgrade --id yt-dlp.yt-dlp`）。
- **橋接程式**：重新建置後再執行一次安裝腳本即可取代舊版。若有下載正在進行，請先關閉瀏覽器。

### 解除安裝

```bash
sh host/dist/youtube-extension-host-macos/uninstall.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File host\dist\youtube-extension-host-windows\uninstall.ps1
```

會移除橋接程式、原生訊息設定檔與登錄機碼、狀態與記錄檔。已下載的檔案、yt-dlp 與 ffmpeg 不受影響。

### 疑難排解

- **按「重新檢查」仍顯示找不到橋接程式**：安裝後請重新啟動瀏覽器。Zen 等以 Firefox 為基礎的瀏覽器使用 Firefox 的註冊。
- **顯示「yt-dlp 版本過舊」或缺少部分畫質**：更新 yt-dlp（見上方），並確認已安裝 deno（設定頁會顯示是否找到）。
- **macOS 顯示無法打開橋接程式**：再執行一次安裝腳本（會移除隔離屬性），或自行從原始碼建置。
- **記錄檔**：`~/Library/Logs/youtube-extension-host/host.log`（macOS）或 `%LOCALAPPDATA%\youtube-extension-host\logs\host.log`（Windows）。只記錄指令名稱與錯誤訊息，不含 cookie 或帳號資訊。
- 關閉 YouTube 分頁或瀏覽器後，下載仍會繼續。未完成的檔案放在下載資料夾中隱藏的 `.yte-tmp-…` 資料夾，下載完成、失敗或取消時會刪除。

**橋接程式能做的事**：只有擴充功能需要的固定指令（檢查狀態、讀取影片資訊、下載、取消、列出下載、顯示檔案、選擇資料夾、更新 yt-dlp）。只有本擴充功能能啟動它（設定檔中的 `allowed_origins`／`allowed_extensions`）。它只接受 YouTube 影片 ID，不接受網址或命令列選項，不開啟任何網路連接埠；只有 yt-dlp 會連到 YouTube（以及你更新 yt-dlp 時連到 GitHub）。

## 常見問題

**下載突然失敗，顯示「YouTube 有變動，請更新 yt-dlp」**
YouTube 經常改版，yt-dlp 會很快跟上。在面板或設定頁按「更新 yt-dlp」；若 yt-dlp 是以 Homebrew 或 winget 安裝，請執行畫面上顯示的指令（`brew upgrade yt-dlp` 或 `winget upgrade --id yt-dlp.yt-dlp`）。

**面板顯示只缺 deno，還能下載嗎？**
可以。沒有 deno 時，yt-dlp 可能取得不到部分 YouTube 格式（常見的是最高畫質）。以 `brew install deno` 或 `winget install DenoLand.Deno` 安裝後按「重新檢查」。

**macOS 顯示橋接程式「無法打開」或「來自未識別的開發者」（Gatekeeper）**
再執行一次安裝腳本（`sh host/dist/youtube-extension-host-macos/install.sh`），它會移除 Gatekeeper 檢查的隔離屬性；不要加 `sudo`。若仍出現，請以 `npm run build:host` 自行建置後再安裝。

**Zen（或其他以 Firefox 為基礎的瀏覽器）找不到橋接程式**
安裝腳本為 Firefox 註冊橋接程式，Zen 通常會讀取同一個位置。安裝後請完全結束 Zen 再開啟，並按「重新檢查」。若仍顯示尚未連接，請開 issue 回報 Zen 版本、macOS 或 Windows 版本，以及 `~/Library/Application Support/Mozilla/NativeMessagingHosts/com.chidi0716.youtube_extension.json`（macOS）是否存在；擴充功能主控台（`about:debugging` 中找到本擴充功能，按「檢查」）裡 `[youtube-extension]` 開頭的訊息也很有幫助。

**下載失敗，顯示「無法寫入下載資料夾」**
設定頁選擇的資料夾被移動或刪除、磁碟已滿，或資料夾沒有寫入權限。請在設定頁改選其他資料夾或按「使用預設」。macOS 上「桌面」「文件」等資料夾可能需要授權：出現詢問是否允許存取時請允許。

**Firefox 重新啟動後擴充功能不見了**
從 `about:debugging` 載入的是暫時附加元件，Firefox 重新啟動後會被移除。請改用簽署過的 `.xpi` 安裝（見[手動載入擴充功能](#手動載入擴充功能)）。

## 開發

```bash
npm install
npm run dev           # Chrome，會自動重新載入
npm run dev:firefox   # Firefox
```

## 建置

```bash
npm run compile         # 型別檢查
npm test                # 單元測試（Vitest）
npm run build           # Chrome  → .output/chrome-mv3
npm run build:firefox   # Firefox → .output/firefox-mv3
npm run build:host      # 本機橋接程式 → host/dist/（macOS arm64/amd64、Windows amd64；需要 Go）
npm run zip
npm run zip:firefox
npm run sign:firefox    # Firefox → 簽署後的 .xpi，輸出到 .output/firefox-signed（見下方）
```

## 手動載入擴充功能

- **Chrome**：開啟 `chrome://extensions`，打開「開發人員模式」，點「載入未封裝項目」，選擇 `.output/chrome-mv3`。
- **Firefox（開發用）**：開啟 `about:debugging#/runtime/this-firefox`，點「載入臨時附加元件」，選擇 `.output/firefox-mv3/manifest.json`。臨時附加元件在 Firefox 重新啟動後會被移除。
- **Firefox（永久安裝，Firefox 140 以上，含 Zen）**：正式版 Firefox 只能安裝經 Mozilla 簽署的附加元件，因此本擴充功能以 addons.mozilla.org 的「不公開（unlisted）」頻道簽署，不在 AMO 網站上架。用 Firefox 開啟簽署後的 `.xpi` 檔（或拖進 Firefox 視窗），在安裝提示中確認即可。

### 簽署 Firefox 版（維護者）

1. 在 <https://addons.mozilla.org/developers/addon/api/key/> 建立 API 金鑰。
2. 以環境變數提供金鑰（不得提交進 repo，也不要寫進任何設定檔）：
   ```bash
   export WEB_EXT_API_KEY=user:12345:67
   export WEB_EXT_API_SECRET=...
   ```
3. 先 commit 所有變更，再執行 `npm run sign:firefox`。它會建置 `.output/firefox-mv3`、以 `git archive` 把目前 commit 的原始碼打包成 `.output/firefox-sources.zip`（不含 `node_modules`、`.output`、`host/dist`、`spikes`），再執行 `web-ext sign --channel unlisted --upload-source-code`。簽署後的 `.xpi` 存到 `.output/firefox-signed/`。加上 `-- --dry-run` 會產生原始碼壓縮檔並印出指令，但不送出。

### 從原始碼建置（給附加元件審查者）

Firefox 版由 [WXT](https://wxt.dev)／Vite 打包並壓縮。從上傳的原始碼重現建置：

- 環境：Linux、macOS 或 Windows，Node.js 22（npm 10）。擴充功能本身不需要其他工具。
- 指令：
  ```bash
  npm ci
  npm run build:firefox
  ```
- 輸出：`.output/firefox-mv3/`，與送審的套件內容相同。

## 專案文件

本專案採用規格驅動開發（SDD）與 clean-room 流程：

| 文件 | 內容 |
|---|---|
| [`specs/constitution.md`](./specs/constitution.md) | 專案原則 |
| [`specs/CLEANROOM.md`](./specs/CLEANROOM.md) | Clean-room 流程與紀錄 |
| [`specs/001-toolbar`](./specs/001-toolbar/spec.md) | 工具列外框 |
| [`specs/002-downloads`](./specs/002-downloads/spec.md) | 下載功能 |
| [`specs/003-viewing-tools`](./specs/003-viewing-tools/spec.md) | 觀看輔助功能 |
| [`specs/004-convenience`](./specs/004-convenience/spec.md) | 便利功能：鎖定畫質、嵌入資訊、時間範圍下載、複製連結 |
| [`specs/005-page-tidy`](./specs/005-page-tidy/spec.md) | 頁面整理（設定頁） |
| [`specs/006-toolbar-customization`](./specs/006-toolbar-customization/spec.md) | 自訂工具列（顯示哪些工具與順序） |
| [`specs/plan.md`](./specs/plan.md)／[`specs/tasks.md`](./specs/tasks.md) | 技術計畫與任務拆解 |
| [`specs/ROADMAP.md`](./specs/ROADMAP.md) | 後續擴充方向 |
| [`specs/BACKLOG.md`](./specs/BACKLOG.md) | 可新增功能清單 |
| [`specs/e2e-checklist.md`](./specs/e2e-checklist.md) | 實測檢查清單 |

## 免責聲明

下載 YouTube 內容可能違反 YouTube 服務條款。請只下載你有權下載的內容，並僅供個人使用。由於 Chrome 線上應用程式商店不允許 YouTube 下載工具，本擴充功能需要手動載入。

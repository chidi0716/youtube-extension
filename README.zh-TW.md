# youtube-extension

[English](./README.md) | **繁體中文**

一個 YouTube 瀏覽器擴充功能，在影片播放器下方加入一條看起來像 YouTube 原生介面的工具列，提供下載與觀看輔助功能。使用 [WXT](https://wxt.dev) + TypeScript 開發，支援 Chrome 與 Firefox（Zen 等以 Firefox 為基礎的瀏覽器比照 Firefox）。

> **狀態：**開發中。以下功能是 [`specs/`](./specs) 中規劃的內容，尚未全部完成。

## 功能（規劃中）

**下載工具**（由你電腦上的 [yt-dlp](https://github.com/yt-dlp/yt-dlp) 與 [ffmpeg](https://ffmpeg.org) 執行）

- 影片：選擇畫質（8K／4K／2K／1080p／HD…），並顯示檔案大小
- MP3：選擇位元率，可裁切時間範圍
- 縮圖與字幕（SRT／VTT／TXT）
- 擷取目前畫面

**觀看輔助**

- 深色模式、劇院模式（播放器以外變暗）、子母畫面
- 捲動時的浮動播放器、片段循環／重複 N 次
- 切換分頁時自動暫停、自動播放開關、純音訊模式、滑鼠滾輪調音量、隱藏留言
- 鎖定畫質（例如一律 1080p）；複製目前時間的 `youtu.be` 連結，也可以是 Markdown 格式

**頁面整理**（在設定頁開關，於 YouTube 所有頁面作用）

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

之後會提供 macOS 與 Windows 的安裝腳本。縮圖、截圖與所有觀看輔助功能不需要橋接程式。

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
| [`specs/plan.md`](./specs/plan.md)／[`specs/tasks.md`](./specs/tasks.md) | 技術計畫與任務拆解 |
| [`specs/ROADMAP.md`](./specs/ROADMAP.md) | 後續擴充方向 |
| [`specs/BACKLOG.md`](./specs/BACKLOG.md) | 可新增功能清單 |

## 免責聲明

下載 YouTube 內容可能違反 YouTube 服務條款。請只下載你有權下載的內容，並僅供個人使用。由於 Chrome 線上應用程式商店不允許 YouTube 下載工具，本擴充功能需要手動載入。

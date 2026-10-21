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
npm run build           # Chrome  → .output/chrome-mv3
npm run build:firefox   # Firefox → .output/firefox-*
npm run zip
npm run zip:firefox
```

## 手動載入擴充功能

- **Chrome**：開啟 `chrome://extensions`，打開「開發人員模式」，點「載入未封裝項目」，選擇 `.output/chrome-mv3`。
- **Firefox**：開啟 `about:debugging#/runtime/this-firefox`，點「載入臨時附加元件」，選擇 `.output/` 底下 Firefox 建置資料夾內的 `manifest.json`。

## 專案文件

本專案採用規格驅動開發（SDD）與 clean-room 流程：

| 文件 | 內容 |
|---|---|
| [`specs/constitution.md`](./specs/constitution.md) | 專案原則 |
| [`specs/CLEANROOM.md`](./specs/CLEANROOM.md) | Clean-room 流程與紀錄 |
| [`specs/001-toolbar`](./specs/001-toolbar/spec.md) | 工具列外框 |
| [`specs/002-downloads`](./specs/002-downloads/spec.md) | 下載功能 |
| [`specs/003-viewing-tools`](./specs/003-viewing-tools/spec.md) | 觀看輔助功能 |
| [`specs/plan.md`](./specs/plan.md)／[`specs/tasks.md`](./specs/tasks.md) | 技術計畫與任務拆解 |
| [`specs/ROADMAP.md`](./specs/ROADMAP.md) | 後續擴充方向 |

## 免責聲明

下載 YouTube 內容可能違反 YouTube 服務條款。請只下載你有權下載的內容，並僅供個人使用。由於 Chrome 線上應用程式商店不允許 YouTube 下載工具，本擴充功能需要手動載入。

# 技術計畫（001–003）

狀態：草稿，待專案擁有者確認

本文件說明如何實作 [`001-toolbar`](./001-toolbar/spec.md)、[`002-downloads`](./002-downloads/spec.md)、[`003-viewing-tools`](./003-viewing-tools/spec.md)，並遵守 [`constitution.md`](./constitution.md)。任務拆解見 [`tasks.md`](./tasks.md)。

## 1. 整體架構

```
┌────────────── 瀏覽器 ──────────────────────────────────────────┐
│                                                                │
│  YouTube 分頁                                                   │
│  ┌──────────────────────────┐   CustomEvent   ┌──────────────┐ │
│  │ 內容腳本（isolated world） │ ◄────────────► │ 頁面橋接腳本  │ │
│  │ ・工具列 UI（Shadow DOM）   │                │ (main world) │ │
│  │ ・觀看輔助功能             │                │ ・播放器 API  │ │
│  └────────────┬─────────────┘                 └──────────────┘ │
│               │ runtime.sendMessage / Port                     │
│  ┌────────────▼─────────────┐                                  │
│  │ 背景腳本                  │  下載佇列、通知、縮圖/截圖存檔       │
│  └────────────┬─────────────┘                                  │
└───────────────┼────────────────────────────────────────────────┘
                │ Native Messaging（stdin/stdout，JSON）
┌───────────────▼─────────────┐
│ 橋接程式 yte-host（Go 單一執行檔）│ ──► yt-dlp ──► ffmpeg
└─────────────────────────────┘
```

- **內容腳本（isolated world）**：繪製工具列與面板，處理所有 DOM 相關功能。
- **頁面橋接腳本（main world）**：只負責呼叫 YouTube 播放器物件的公開方法（取得影片資料、音量、跳轉），用事件與內容腳本溝通。內容固定、隨擴充功能打包，不是動態注入的外部程式。
- **背景腳本**：唯一能與橋接程式溝通的地方；管理下載工作、通知、以及縮圖與截圖的存檔。
- **橋接程式**：Go 撰寫，編譯成 macOS 與 Windows 的單一執行檔，負責驗證指令並呼叫 yt-dlp。

## 2. 技術選擇

| 項目 | 選擇 | 理由 |
|---|---|---|
| 擴充功能框架 | WXT（現有） | 一份程式碼打包 Chrome 與 Firefox |
| Manifest 版本 | Chrome 與 Firefox 都用 MV3 | 兩邊都能使用 main world 內容腳本，程式碼一致（見風險 R1） |
| UI | Preact + TSX | 面板與表單元件多，用元件寫比較好維護；體積約 4KB。Preact 內部支援 `dangerouslySetInnerHTML` 會產生一個 `web-ext lint` 警告，本專案不得使用該屬性，此警告記錄於 `specs/notes/lint-exceptions.md` 並接受 |
| 樣式隔離 | WXT `createShadowRootUi` | 避免影響 YouTube 版面；CSS 自訂變數會穿透 Shadow DOM，所以仍能使用 YouTube 的顏色變數 |
| 圖示 | `@material-symbols/svg-400`（Apache 2.0） | 以 Vite `?raw` 匯入 SVG，打包進擴充功能 |
| 多語系 | `browser.i18n` + `public/_locales/{en,zh_TW}` | 瀏覽器原生機制，依瀏覽器語言自動切換 |
| 單元測試 | Vitest | 與 Vite 相容 |
| 橋接程式 | Go 1.24，只用標準函式庫（Windows 另加 `golang.org/x/sys/windows`） | 跨平台編譯成單一執行檔，使用者不必安裝執行環境 |

## 3. 擴充功能

### 3.1 目錄結構

```
entrypoints/
  background.ts                 背景腳本進入點
  youtube.content/              工具列與觀看輔助（isolated world）
    index.tsx
  youtube-page.content.ts       頁面橋接腳本（world: MAIN）
  popup/                        彈出視窗（現有，加上語系）
  options/                      設定頁
components/
  toolbar/                      Toolbar、ToolbarButton、Panel、PanelHost
  controls/                     RangeSlider、TimeInput、Switch、Select、Button、Badge
  panels/                       VideoPanel、Mp3Panel、ThumbnailPanel、SubtitlePanel、
                                LoopPanel、MorePanel、HelpPanel、HostMissing
features/
  viewing/                      darkMode、cinema、pip、floatingPlayer、looper、
                                smartPause、autoplay、audioOnly、wheelVolume、hideComments
  downloads/                    screenshot、thumbnails、jobs（下載狀態）
utils/
  youtube/dom.ts                ★ 所有 YouTube 選擇器集中於此（constitution 第 7 點）
  youtube/page.ts               目前影片 ID、換頁事件、頁面類型判斷
  youtube/player.ts             與頁面橋接腳本溝通的封裝
  format-list.ts                yt-dlp 格式 → 畫質清單（純函式，有測試）
  time.ts                       時:分:秒 解析與格式化（純函式，有測試）
  filename.ts                   截圖／縮圖檔名（純函式，有測試）
  settings.ts                   所有設定的 storage 定義（取代現有 storage.ts）
  native.ts                     背景腳本端的橋接程式連線
  messages.ts                   內容腳本 ↔ 背景腳本的訊息型別
host/                           橋接程式（Go），見第 4 節
```

### 3.2 權限

| 權限 | 用途 |
|---|---|
| `storage` | 設定與功能開關 |
| `downloads` | 縮圖與截圖存檔 |
| `notifications` | 下載完成／失敗通知 |
| `nativeMessaging` | 與橋接程式溝通 |
| 主機權限 `*://*.youtube.com/*` | 內容腳本 |
| 主機權限 `https://i.ytimg.com/*` | 背景腳本檢查縮圖尺寸是否存在並下載 |

不申請 `tabs`、`scripting`、`webRequest`、`<all_urls>`、`cookies`。

### 3.3 擴充功能 ID 固定

原生訊息設定檔必須寫明擴充功能 ID：

- **Chrome**：在 `wxt.config.ts` 的 manifest 加入固定的 `key`（公鑰），讓未封裝載入的 ID 永遠相同。金鑰在實作時產生一次，只提交公鑰，私鑰不進 repo。
- **Firefox**：`browser_specific_settings.gecko.id` 改為 `youtube-extension@chidi0716`。
- Chrome 不打包 `.crx`（Chrome 不允許安裝商店以外的 `.crx`），因此不需要保留私鑰；只以「載入未封裝項目」安裝。

### 3.3.1 Firefox 發佈方式

- Firefox 正式版與 Zen 只能永久安裝經 Mozilla 簽署的附加元件，因此以 AMO「不公開（unlisted）」頻道送簽署，取得 `.xpi` 自行發佈；不在 AMO 網站上架。
- manifest 的 `browser_specific_settings.gecko` 加入：
  - `strict_min_version: "140.0"`（main world 內容腳本需要 128，`data_collection_permissions` 需要 140；140 為 ESR 版本）；
  - `data_collection_permissions: { "required": ["none"] }`（依 constitution 第 2 點，不收集任何資料）。
- 不支援 Firefox Android；`web-ext lint` 中只與 Android 相關的警告可以接受，需在 `specs/notes/lint-exceptions.md` 記錄。
- 送簽署時一併上傳原始碼：`sign:firefox` 先以 `git archive` 產生原始碼壓縮檔（不含 `node_modules`、`.output`、`host/dist`、`spikes`），再以 `--upload-source-code` 附上；README 寫明審查者如何從原始碼重現建置（`npm ci && npm run build:firefox`）。
- 新增 `npm run sign:firefox`：以 `web-ext sign --channel unlisted` 送簽署。AMO API 金鑰從環境變數 `WEB_EXT_API_KEY`、`WEB_EXT_API_SECRET` 讀取，不得寫入 repo 或任何設定檔。實際送簽署由專案擁有者在自己的電腦上執行。
- README 說明如何安裝簽署後的 `.xpi`，以及開發時用「臨時附加元件」載入。

### 3.4 換頁與工具列掛載

- 監聽 YouTube 的 `yt-navigate-finish` 事件，以及首次載入時的狀態；以網址判斷是否為 `/watch`。
- 以 `utils/youtube/dom.ts` 提供的錨點（播放器下方、標題上方的容器）掛載 Shadow DOM 根節點。
- 用一個 `MutationObserver` 只觀察錨點的父節點，偵測工具列被 YouTube 移除時重新掛載（FR-5）；離開觀看頁時停止觀察（NFR-3）。
- 全螢幕：監聽 `fullscreenchange`，全螢幕時隱藏工具列。

### 3.5 頁面橋接腳本

- 以 `world: 'MAIN'` 宣告的內容腳本，只在 `*.youtube.com` 執行。
- 只接受以下事件請求，其他一律忽略：`getVideoData`（標題、影片 ID、長度、是否直播／尚未開始）、`getVolume`、`setVolume`、`seekTo`、`getCurrentTime`，以及鎖定畫質用的 `getAvailableQualities`、`getQuality`、`setQuality`（`setQuality` 的參數只接受 YouTube 畫質代號白名單），與深色模式用的 `markThemeOptions`（不帶參數，只在 YouTube 外觀子選單的深色／淺色選項上加標記屬性，不點擊、不修改其他內容）。
- 事件名稱加上固定前綴；回覆時帶請求 ID。
- 頁面上其他程式也能發出同名事件，所以這些操作都設計成無害的（只能讀取影片資料、調整音量、跳轉）。

### 3.6 工具列與面板

- `PanelHost` 管理「目前展開的面板」與「是否釘選」，實作 001 的 FR-10 至 FR-13。
- 面板定位：以按鈕位置計算，超出播放器右緣時改為右對齊（FR-11）。
- 點外面收起：在 Shadow DOM 外層監聽 `pointerdown`，用 `event.composedPath()` 判斷是否點在工具列或面板內。
- 切換按鈕的開啟狀態由各功能模組回報。
- 顏色只使用 YouTube 變數，例如：
  - 依序嘗試 `--yt-spec-*`、`--yt-sys-color-baseline--*`，最後是固定備用值（例如面板背景、主要與次要文字、懸停背景、藍色強調）。
  - 對應關係集中在一個 CSS 檔，YouTube 改名時只需修改該檔。

### 3.7 觀看輔助功能的做法

| 功能 | 做法 |
|---|---|
| 深色模式 | **操作 YouTube 自己的外觀選單**：在 `<html>` 加上暫時的 class，以 CSS 讓 YouTube 的彈出選單容器在操作期間不可見；以程式點擊頭像按鈕（未登入時為設定按鈕）→「外觀」項目 → 「深色主題」／「淺色主題」項目；完成或逾時（例如 3 秒）後關閉選單並移除暫時 class。選單項目以 YouTube 頁面上的結構辨識（例如外觀子選單中的勾選項目順序或對應的圖示／連結資料），**不得只靠顯示文字**（介面語言會變）。所有選擇器集中在 `utils/youtube/dom.ts`。移除 T06a／T06b 的 PREF 修改、主題屬性設定、變數覆寫、每秒檢查等程式。按鈕狀態只讀取 `<html>` 的 `dark` 屬性。 |
| 劇院模式 | **不使用蓋住整頁的遮罩**（YouTube 的播放器位於多層形成獨立堆疊脈絡的容器內，提高 `z-index` 無法讓播放器跳出遮罩，實測會連播放器一起蓋住）。改為在 `<html>` 加上 class，以 CSS 把播放器容器與工具列以外的各個頁面區域調暗（例如降低不透明度或亮度），頁面背景改為黑色；需要調暗的區域選擇器集中在 `utils/youtube/dom.ts`。點擊被調暗的區域時關閉（在這些區域上以捕獲階段攔截點擊，避免誤觸連結）；Esc 關閉 |
| 子母畫面 | 對 `<video>` 呼叫 `requestPictureInPicture()`；監聽 `enterpictureinpicture`／`leavepictureinpicture`；`document.pictureInPictureEnabled` 為 false 時停用按鈕 |
| 浮動播放器 | `IntersectionObserver` 觀察播放器原位置；離開畫面時對播放器容器加上固定定位的 class，並觸發 `resize` 事件讓 YouTube 重新計算尺寸；拖曳使用 Pointer Events，放開時貼齊最近角落 |
| 循環播放 | 監聽 `<video>` 的 `timeupdate` 與 `ended`；片段模式超過結束時間就 `seekTo` 開始時間 |
| 切換分頁自動暫停 | `visibilitychange`；記錄「是不是我們暫停的」 |
| 自動播放 | 點擊 YouTube 播放器上的自動播放開關，讀取其 `aria-checked` 狀態 |
| 純音訊模式 | 隱藏 `<video>` 畫面，在播放器內加入顯示縮圖的覆蓋層 |
| 滾輪調音量 | 在播放器上監聽 `wheel`（`passive: false`），透過頁面橋接腳本 `setVolume`；在播放器中央顯示音量提示 |
| 隱藏留言 | 對留言區容器加上隱藏用的 class |

### 3.7.1 鎖定畫質與複製連結（004）

- **鎖定畫質**：透過頁面橋接腳本讀取影片可用畫質，選出不高於設定值的最高畫質後設定給播放器。
  - 在影片載入與播放器畫質改變時重新檢查。
  - 偵測到使用者手動改畫質時（畫質改變但不是我們觸發的），記下這部影片的影片 ID，該影片不再強制。
  - 畫質代號與解析度的對應、選擇邏輯寫成純函式並有單元測試。
  - 實作前先以真實 YouTube 確認播放器的畫質相關方法仍可用；不可用時在 QUESTIONS.md 回報。
- **複製連結**：連結與 Markdown 文字的產生寫成純函式（有單元測試），在按鈕點擊的使用者操作中以 `navigator.clipboard.writeText` 複製；失敗時改為顯示可選取的文字框（004 FR-34）。

### 3.7.2 頁面整理（005）

- **設定**：`utils/settings.ts` 新增各選項（預設 false，存在 `sync`）。設定頁以類別分組顯示（觀看頁、干擾、Shorts、介面），並保留原本的下載設定區。
- **CSS 開關機制**：內容腳本在 `document_start` 就依設定在 `<html>` 加上對應的 class（例如 `yte-hide-end-cards`），並監聽設定變更即時增減 class（005 FR-3）。所有相關樣式放在同一個樣式檔，選擇器集中在 `utils/youtube/dom.ts`。這個機制取代各功能各自加樣式的做法，003 的「隱藏留言」也改用此機制。
- **內容腳本範圍**：頁面整理在所有 YouTube 頁面作用，工具列仍只在觀看頁掛載。
- **需要程式的選項**：
  - **原始語音**：透過頁面橋接腳本讀取影片的語音軌清單並切換（新增 `getAudioTracks`、`setAudioTrack` 請求，`setAudioTrack` 只接受清單中存在的語音軌識別值）。在影片載入時檢查；偵測到使用者手動切換時，這部影片不再強制。實作前先以真實 YouTube 確認播放器提供的語音軌方法；不可用時在 QUESTIONS.md 回報。
  - **繼續觀看對話框**：以 `MutationObserver` 只觀察對話框會出現的容器；對話框出現且影片因此暫停時，關閉對話框並繼續播放。
  - **Shorts 轉換**：首次載入時檢查網址；站內換頁時在 YouTube 換頁事件（及網址變更）時檢查。以 `location.replace` 轉到觀看頁，避免瀏覽紀錄循環。
- **測試**：網址轉換、語音軌選擇等純邏輯寫成純函式並有單元測試；假觀看頁加上模擬的片尾卡片、結尾畫面、Shorts 區塊、長標題與「繼續觀看」對話框來驗證。

### 3.7.3 自訂工具列（006）

- **設定**：`utils/settings.ts` 新增 `sync:toolbarLayout`，格式為 `{ version: 1, items: Array<{ id: ToolId | 'separator', visible: boolean }> }`；`id` 為固定的工具識別字串（不使用顯示名稱）。讀取時與預設清單合併（006 FR-24），寫入前驗證。
- **工具註冊表**：把目前散在 Toolbar 元件中的按鈕定義集中成一份註冊表（id、圖示、名稱、類型：面板／切換／執行、預設組），工具列、編輯模式、「更多」的其他工具區塊、說明面板與設定頁都從註冊表與設定產生，避免各自維護一份清單。
- **拖曳**：使用 Pointer Events 自行實作（不引入函式庫），拖曳中只更新暫存順序，放開時才寫入暫存狀態；「完成」時才寫入 storage。
- **跨分頁套用**：監聽 storage 變更，重新繪製工具列；編輯模式中的分頁收到其他分頁的變更時，先保留自己的編輯，「完成」時以自己的結果覆寫。

### 3.7.4 介面語言（007）

- `browser.i18n.getMessage` 只會依瀏覽器語言回傳，無法在執行中切換，因此改為自己的翻譯層：
  - 兩份語言檔（`public/_locales/en`、`zh_TW` 的 `messages.json`）在建置時一併打包成模組，執行時依設定選用；`_locales` 仍保留給 manifest 的名稱與說明使用（007 FR-5）。
  - `utils/i18n.ts` 提供 `t(key, substitutions?)` 與目前語言的訂閱；Preact 元件透過 hook 讀取，語言改變時只重新繪製文字，不重新掛載（NFR-1）。
  - 設定 `sync:uiLanguage`：`'auto' | 'zh_TW' | 'en'`。
  - 數字、檔案大小、時間的格式以 `Intl` 依目前語言產生。
  - 背景腳本建立通知時讀取同一個設定。
- 測試：兩份語言檔的鍵一致；所有程式中使用的鍵都存在於語言檔（掃描原始碼）；切換語言時面板狀態保留。
- **設定頁外觀（007 FR-20 至 FR-24）**：設定 `sync:pageTheme` = `'youtube' | 'system' | 'dark' | 'light'`（預設 `youtube`）；內容腳本在深色模式功能已有的 `<html dark>` 觀察中，把目前主題寫入 `local:lastYouTubeTheme`（只在值改變時寫入）。設定頁與彈出視窗的顏色改為 CSS 變數，以 `<html data-theme="dark|light">` 切換；`system` 與尚無紀錄時以 `prefers-color-scheme` 決定。監聽 storage 變更即時更新。

### 3.8 下載相關（擴充功能端）

- **影片資訊快取**：背景腳本以影片 ID 快取 `getInfo` 結果，影片、MP3、字幕面板共用（NFR-2）。
- **畫質清單**（`utils/format-list.ts`）：
  - 從 yt-dlp 的格式資料挑出只有影像的格式，依解析度與幀率分組。
  - MP4 組用 H.264 影像搭配 M4A 聲音；其他格式組用 VP9/AV1 搭配 Opus。
  - 已經包含聲音的格式（例如 360p）直接列出。
  - 大小為影像與聲音相加；任一方只有估計值時標記「約」。
  - 標籤規則依 002 FR-11。
- **縮圖**：背景腳本依序檢查 `maxresdefault`、`sddefault`、`hqdefault`、`mqdefault`。YouTube 對不存在的尺寸會回傳 404 或 120×90 的預設圖，兩者都排除。以 `downloads.download` 存檔。
- **截圖**：在內容腳本把 `<video>` 畫到 canvas，轉成 PNG Blob，交給背景腳本以 `downloads.download` 存檔。若 canvas 被汙染而失敗，顯示錯誤（FR-52）。
- **字幕（直接下載，002 FR-44）**：頁面橋接腳本新增 `getCaptionTracks` 請求（不帶參數），從播放器的影片資料取得字幕清單（語言代碼、名稱、是否自動產生、字幕網址）。字幕網址必須是 `youtube.com` 網域，背景腳本以 `fetch` 取得 VTT 格式（或 YouTube 的 XML 格式再轉換），在擴充功能內轉成 SRT、TXT（轉換函式有單元測試），以 `downloads.download` 存檔。失敗且橋接程式可用時，改用 yt-dlp（4.5 節）。
- 縮圖與截圖存到瀏覽器的預設下載位置；設定頁的「下載資料夾」只影響經由橋接程式的下載。設定頁要寫明這點。
- **下載工作狀態**：背景腳本維護工作清單（ID、影片 ID、類型、進度、狀態），以 `storage.session` 保存，並推播給開著的 YouTube 分頁。
- **通知**：完成時建立通知；點擊通知送出「在檔案總管中顯示」指令。

## 4. 橋接程式（host/）

### 4.1 目錄結構

```
host/
  go.mod
  cmd/yte-host/main.go          進入點
  internal/protocol/            原生訊息讀寫（4 位元組長度 + JSON）
  internal/commands/            指令分派與參數驗證
  internal/ytdlp/               尋找 yt-dlp/ffmpeg、組命令列參數、解析輸出
  internal/jobs/                下載工作管理、取消、清理暫存檔
  internal/platform/            各平台差異：下載資料夾、顯示檔案、選資料夾、結束子程序
  testdata/fake-yt-dlp/         測試用的假 yt-dlp
install/
  macos/install.sh、uninstall.sh
  windows/install.ps1、uninstall.ps1
  manifests/                    原生訊息設定檔範本
```

### 4.2 通訊協定

- 請求：`{"id": "<uuid>", "cmd": "<指令>", "args": {...}}`
- 回應：`{"id": "<同一個 id>", "ok": true, "result": {...}}`，或 `{"id": ..., "ok": false, "error": {"code": "<代碼>", "message": "..."}}`
- 事件（主動推送）：`{"event": "progress" | "done" | "failed", "jobId": "...", ...}`
- 錯誤代碼固定（例如 `INVALID_ARGS`、`YTDLP_NOT_FOUND`、`FFMPEG_NOT_FOUND`、`LOGIN_REQUIRED`、`NETWORK`、`DISK_FULL`、`YTDLP_OUTDATED`、`UNKNOWN`），擴充功能依代碼顯示易懂的訊息（FR-6）。
- 單一訊息上限：橋接程式送出 1MB（Chrome 規定）。`getInfo` 只回傳需要的欄位，避免超過上限。

### 4.3 指令

| 指令 | 參數 | 說明 |
|---|---|---|
| `status` | — | 回傳橋接程式版本、yt-dlp 與 ffmpeg 路徑和版本、是否由套件管理工具安裝、預設下載資料夾 |
| `getInfo` | `videoId` | `yt-dlp -J --no-playlist`，回傳精簡後的格式、字幕清單、標題、長度、直播狀態 |
| `download` | `videoId`、`kind`、`formatId`、`container`、`bitrate`、`section`、`subLang`、`subFormat`、`dir`、`namePreset`、`embed` | 依 `kind`（`video`／`mp3`／`subtitle`）組參數，回傳 `jobId` |
| `cancel` | `jobId` | 結束整個子程序樹並刪除暫存檔 |
| `jobs` | — | 回傳進行中與最近完成的工作 |
| `reveal` | `jobId` | 在 Finder 或檔案總管中選取完成的檔案 |
| `pickFolder` | — | 開啟系統的選擇資料夾視窗，回傳路徑 |
| `updateYtDlp` | — | 非套件管理工具安裝時執行 `yt-dlp -U`，否則回傳對應的更新指令 |

### 4.4 驗證規則（FR-71 至 FR-73）

- `videoId`：`^[A-Za-z0-9_-]{11}$`，網址由橋接程式組成 `https://www.youtube.com/watch?v=<id>`。
- `formatId`：`^[A-Za-z0-9_-]{1,10}(\+[A-Za-z0-9_-]{1,10})?$`。
- `container`：白名單 `mp4`、`webm`。
- `bitrate`：白名單 64、128、192、256、320。
- `section`：兩個非負整數秒數，開始小於結束；`video` 與 `mp3` 都可使用。
- `embed`：布林值。
- `subLang`：`^[A-Za-z0-9-]{1,20}$`。
- `subFormat`：白名單 `srt`、`vtt`、`txt`。
- `namePreset`：白名單 ID，對應橋接程式內建的 yt-dlp 檔名範本，不接受任意範本。
- `dir`：必須是絕對路徑、存在、可寫入。
- 所有參數以陣列傳給 `exec.Command`，不經過 shell；網址前一律加 `--` 防止被當成選項。

### 4.5 呼叫 yt-dlp

- **尋找執行檔**：瀏覽器啟動的程式在 macOS 上 `PATH` 很短，所以除了 `PATH`，還要找：
  - macOS：`/opt/homebrew/bin`、`/usr/local/bin`
  - Windows：`%LOCALAPPDATA%\Microsoft\WinGet\Links`、`%LOCALAPPDATA%\Microsoft\WinGet\Packages\*`

  找到的 ffmpeg 以 `--ffmpeg-location` 傳給 yt-dlp。
- **影片**：`-f <formatId> --merge-output-format <container>`；有裁切時加 `--download-sections *<start>-<end> --force-keyframes-at-cuts`
- **MP3**：`-f bestaudio -x --audio-format mp3 --audio-quality <bitrate>K`；有裁切時加 `--download-sections *<start>-<end> --force-keyframes-at-cuts`
- **字幕**：`--skip-download --write-subs`（自動字幕用 `--write-auto-subs`）`--sub-langs <lang> --sub-format vtt`
  - SRT：加上 `--convert-subs srt`
  - TXT：由橋接程式把 VTT 轉成純文字（去掉時間碼與重複行），有單元測試。
- **嵌入資訊**（004 第 2 節，設定開啟時）：`--embed-thumbnail --embed-metadata --embed-chapters`；WEBM 等不支援嵌入封面的格式不加 `--embed-thumbnail`。是否嵌入由 `download` 指令的布林參數 `embed` 決定。
- **共通參數**：`--newline --no-colors --progress-template "download:YTE-PROGRESS %(progress)j" --print after_move:YTE-FILE:%(filepath)s -P <dir> -o <範本> --windows-filenames --no-playlist`
- **進度**：解析 `YTE-PROGRESS` JSON 行得到百分比、速度、剩餘時間；遇到合併或轉檔階段時，回報狀態「處理中」。
- **錯誤分類**：依 stderr 關鍵字對應錯誤代碼，例如登入、網路、空間不足、格式不存在。

### 4.6 工作與生命週期

- 每個下載是一個子程序。
  - macOS：用程序群組，取消時結束整個群組。
  - Windows：用 Job Object，確保 ffmpeg 也會被結束。
- 取消或失敗時刪除 `.part`、`.ytdl` 與合併前的暫存檔。
- 瀏覽器關閉連線（stdin EOF）時，橋接程式等進行中的下載完成才結束，最長 6 小時。完成的工作記在本機狀態檔，背景腳本下次連線時補發通知。

### 4.7 記錄檔

- macOS：`~/Library/Logs/youtube-extension-host/host.log`
- Windows：`%LOCALAPPDATA%\youtube-extension-host\logs\host.log`

只記錄指令名稱、錯誤代碼與 yt-dlp 的錯誤訊息，大小上限 5MB，超過就輪替。

### 4.8 安裝腳本

- 原生訊息名稱：`com.chidi0716.youtube_extension`
- **macOS**（`install.sh`，不需 sudo）：
  - 複製執行檔到 `~/Library/Application Support/youtube-extension-host/`，並移除隔離屬性（`xattr -d com.apple.quarantine`）。
  - 寫入原生訊息設定檔到：
    - `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
    - `~/Library/Application Support/Mozilla/NativeMessagingHosts/`
  - 檢查 yt-dlp、ffmpeg，缺少時提示 `brew install yt-dlp ffmpeg`。
- **Windows**（`install.ps1`，不需系統管理員）：
  - 複製執行檔到 `%LOCALAPPDATA%\youtube-extension-host\`。
  - 寫入設定檔，並建立以下登錄機碼：
    - `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chidi0716.youtube_extension`
    - `HKCU\Software\Mozilla\NativeMessagingHosts\com.chidi0716.youtube_extension`
  - 缺少 yt-dlp、ffmpeg 時提示 `winget install yt-dlp.yt-dlp Gyan.FFmpeg`。
- 解除安裝腳本移除上述所有檔案與機碼。
- 執行檔由 `npm run build:host` 在本機交叉編譯，產出 `darwin-arm64`、`darwin-amd64`、`windows-amd64`；之後可改由 GitHub Actions 發布到 Releases。

## 5. 測試策略

| 層級 | 內容 | 工具 |
|---|---|---|
| 單元（擴充功能） | 畫質清單、時間格式、檔名、設定預設值 | Vitest |
| 單元（橋接程式） | 協定讀寫、每條驗證規則（含惡意輸入）、命令列參數組合、VTT→TXT、錯誤分類 | `go test` |
| 整合（橋接程式） | 用假 yt-dlp 腳本模擬進度輸出、成功、失敗、取消 | `go test` |
| 打包 | `npm run compile`、`npm run build`、`npm run build:firefox`、`npm run build:host` 全部成功 | CI 指令 |
| 手動 E2E | 依 001–003 的驗收條件，在 macOS 與 Windows 的 Chrome、Firefox 上逐項測試 | 檢查清單（`specs/e2e-checklist.md`） |

## 6. 風險與待驗證事項

| 編號 | 風險 | 因應 |
|---|---|---|
| R1 | Firefox MV3 的背景頁屬於可被暫停的事件頁面，下載途中可能被暫停 | 第一個任務先驗證；橋接程式設計成斷線後仍會完成下載並保存結果（4.6）。若仍有問題，Firefox 改用 MV2 |
| R2 | YouTube 改版造成選擇器失效 | 選擇器集中在 `dom.ts`；找不到元素時安靜停用該功能 |
| R3 | 浮動播放器與劇院模式會改動 YouTube 版面，可能和 YouTube 自己的樣式衝突 | 只加我們的 class，不改 YouTube 原本的屬性；關閉時完整還原 |
| R4 | macOS 未簽章的執行檔被 Gatekeeper 擋下 | 安裝腳本移除隔離屬性；README 說明也可以從原始碼自行編譯 |
| R5 | YouTube 限制下載速度，或要求驗證才能下載 | 屬於 yt-dlp 的範圍；顯示「請更新 yt-dlp」，並在設定頁提供更新按鈕 |
| R6 | 截圖時 canvas 被視為跨來源而無法輸出 | YouTube 一般使用 blob 網址播放，不會有此問題；失敗時依 FR-52 顯示錯誤 |

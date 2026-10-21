# 任務拆解

狀態：草稿，待專案擁有者確認

依 [`plan.md`](./plan.md) 拆解。每個任務完成後都要通過 `npm run compile`；有測試的任務要通過對應的測試。標示 `[P]` 的任務彼此沒有相依，可以同時進行。

每個任務完成時做一個 commit，格式依 constitution 第 10 點：第一行為英文摘要並以任務編號開頭（例如 `T03 Add toolbar shell and panel manager`），空一行後以繁體中文補充說明。

## 階段 0：基礎建設

- **T00 技術驗證：Firefox MV3 背景頁與原生訊息**
  - 做一個最小的橋接程式與擴充功能，確認 Firefox MV3 在原生訊息連線期間，背景頁不會被暫停超過 30 秒。
  - 結果寫進 `specs/notes/T00-firefox-mv3.md`。若會被暫停，在 `QUESTIONS.md` 回報，由規格方決定是否改用 MV2。
- **T01 專案設定**
  - 加入 Preact、Vitest、`@material-symbols/svg-400`。
  - `wxt.config.ts`：Firefox 也輸出 MV3；加入權限（plan 3.2）、Chrome 的固定 `key`、Firefox gecko ID。
  - 建立 `public/_locales/en`、`public/_locales/zh_TW`，以及 `npm test`、`npm run build:host` 指令。
  - 移除 `utils/storage.ts`，改為 `utils/settings.ts`。
  - **完成條件**：Chrome 與 Firefox 都能打包，`npm test` 能執行（可以先沒有測試）。

## 階段 1：工具列外框（001）

- **T01a Firefox 發佈設定**（QUESTIONS Q1、Q2 的回答）
  - 依 plan 3.3.1 加入 `strict_min_version`、`data_collection_permissions`，以及 `npm run sign:firefox`。
  - **完成條件**：`web-ext lint` 對 `.output/firefox-mv3` 沒有錯誤與警告；Chrome 版 manifest 不出現 `browser_specific_settings`。

- **T02 YouTube 頁面工具**
  - `utils/youtube/dom.ts`、`page.ts`：判斷觀看頁、取得影片 ID、換頁事件、錨點元素。
  - `youtube-page.content.ts` 與 `player.ts`：頁面橋接腳本與封裝（plan 3.5）。
- **T03 工具列外框與面板管理**
  - Shadow DOM 掛載、重新掛載、全螢幕隱藏。
  - 左右兩組按鈕（先放空面板）、提示文字、`PanelHost`（單一面板、點外面收起、Esc、釘選、定位）。
  - 鍵盤操作與焦點移動。
  - **完成條件**：001 中與功能無關的驗收條件全部通過。
- **T04 [P] 共用控制元件**
  - `RangeSlider`（雙把手）、`TimeInput`、`Switch`、`Select`、`Button`、`Badge`，全部使用 YouTube 顏色變數。
  - `utils/time.ts` 與單元測試。
- **T05 [P] 關閉、彈出視窗與說明面板**
  - ✕ 與彈出視窗的「啟用」開關連動；說明面板列出所有按鈕。
  - 彈出視窗加上語系。

## 階段 2：觀看輔助（003）

T06 至 T10 都依賴 T03，彼此之間可以同時進行。

- **T06 [P] 深色模式、子母畫面**
- **T07 [P] 劇院模式**
- **T08 [P] 浮動播放器**
- **T09 [P] 循環播放面板**（使用 T04 的區間滑桿）
- **T10 [P] 更多選單**：切換分頁自動暫停、自動播放、純音訊模式、滾輪調音量、隱藏留言
- **完成條件**：003 的驗收條件全部通過。

## 階段 3：橋接程式（002 後端）

T11 可以和階段 1、2 同時進行。

- **T11 [P] 協定與指令分派**
  - `protocol`、`commands`、全部驗證規則（plan 4.4）。
  - 測試涵蓋每條規則的合法與非法輸入。
- **T12 yt-dlp 整合**
  - 尋找執行檔、`status`、`getInfo`（精簡輸出）、組合三種下載的參數、解析進度與最終路徑、錯誤分類、VTT→TXT。
  - 以假 yt-dlp 做整合測試。
- **T13 工作管理**
  - `download`、`cancel`（含子程序樹與暫存檔清理）、`jobs`、斷線後繼續與狀態檔（plan 4.6）、記錄檔。
- **T14 平台功能**
  - `reveal`、`pickFolder`、預設下載資料夾、`updateYtDlp`（macOS 與 Windows 各自實作）。
- **T15 安裝與打包**
  - 交叉編譯腳本、macOS 與 Windows 的安裝及解除安裝腳本、原生訊息設定檔範本。
  - README 加入安裝章節。

## 階段 4：下載功能（002 前端）

- **T16 背景腳本與橋接程式連線**
  - `utils/native.ts`：連線、請求與回應配對、事件、自動重連。
  - 影片資訊快取、工作狀態、推播給分頁、通知與點擊通知。
- **T17 [P] 截圖與縮圖**：不需要橋接程式，依賴 T03。
- **T18 [P] 畫質清單邏輯**：`utils/format-list.ts` 與單元測試（以多組真實格式的範例資料測試）。
- **T19 影片面板**：依賴 T16、T18。
- **T20 MP3 面板**：依賴 T16、T04；包含與播放器同步、設為目前時間。
- **T21 字幕面板**：依賴 T16。
- **T22 共通狀態**
  - 未連線時的安裝說明、直播中或尚未開始的影片、進度環、錯誤訊息與重試。
- **T23 設定頁**
  - 下載資料夾（`pickFolder`）、檔名格式、連線狀態、更新 yt-dlp。

## 階段 5：收尾

- **T24 E2E 檢查清單**
  - 把 001–003 的驗收條件整理成 `specs/e2e-checklist.md`，標註每項在哪個瀏覽器與作業系統測試。
- **T25 文件**
  - README：功能介紹、安裝（擴充功能與橋接程式）、常見問題（例如 yt-dlp 需要更新、Gatekeeper 擋下）。
- **T26 最終檢查**
  - 確認 manifest 權限與 plan 3.2 完全一致。
  - 以全文搜尋確認沒有 `eval`、`new Function`、外部腳本網址、分析或追蹤程式碼。
  - 確認全部測試與打包都通過。

## 交付給實作方的方式

- 實作方是獨立的子代理，在獨立的 git 工作目錄中工作。它只看得到這個 repo，看不到參考資料。
- 每完成一個階段就停下來回報，由規格方對照驗收條件檢查後，才進入下一階段。
- 實作方的疑問寫在 `specs/QUESTIONS.md`。

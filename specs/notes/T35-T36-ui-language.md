# 階段 7：介面語言（T35、T36）

日期：2026-10-23　負責：實作方　規格：[`007-ui-language`](../007-ui-language/spec.md)、plan 3.7.4

## 做法

- `utils/i18n.ts`：兩份語言檔（`public/_locales/en`、`zh_TW` 的 `messages.json`）在建置時打包成模組；`t(key, substitutions?)` 依目前語言回傳，
  代換 `$NAME$` 佔位符（繁體中文語言檔沒有 `placeholders` 定義時沿用英文的）與 `$$`；找不到時退回英文，再退回鍵名。
  `_locales` 仍由 manifest 使用（擴充功能名稱與說明，007 FR-5）。
- 設定 `sync:uiLanguage`：`auto`（預設）／`zh_TW`／`en`。`auto` 時瀏覽器語言為任何中文（`zh`、`zh-TW`、`zh-CN`…）用繁體中文，其他用英文（FR-2）。
  `initI18n()` 直接以 `browser.storage` 讀取並監聽（頁面橋接腳本也會間接載入翻譯層，那裡沒有擴充功能的 API，所以不在模組載入時定義 storage 項目）。
- 語言改變時通知訂閱者：
  - 內容腳本：以同一個 Preact 樹重新繪製（`render` 到同一個容器），工具列不重新掛載，面板、釘選、編輯模式、輸入值與下載進度都保留（NFR-1）；
    `components/useLocale.ts` 讓工具列根元件與浮動播放器控制列跟著重新繪製。「更多」的下拉選單選項每次繪製時重新產生。
  - 設定頁：最上方新增「語言」區（選單與 FR-5 的說明）；改變時先寫入設定，再以新語言重新繪製整頁（各區的 storage 監聽在重新繪製前取消），焦點回到語言選單。
  - 彈出視窗：開啟時讀取設定（下次開啟時套用）。
  - 背景腳本：啟動時讀取設定並監聽；建立通知前確認已讀取，通知與錯誤說明使用所選語言（FR-3、FR-7）。
- 數字（檔案大小、下載速度）以 `Intl.NumberFormat` 依介面語言格式化（FR-6）。剩餘時間維持 `mm:ss`（QUESTIONS Q51）。
- 錯誤訊息一律依錯誤代碼（002 FR-6a）轉成所選語言，原始訊息只寫進 console（FR-7）。
- 新增語言時只需要新增語言檔，並在 `utils/i18n.ts` 的 `LOCALES`、`UI_LANGUAGES` 與設定的值各加一項（FR-8）。

## 驗證

- 單元測試（`utils/i18n.test.ts`）：兩份語言檔的鍵完全一致、訊息不空白、佔位符一致且有定義；掃描 `entrypoints`、`components`、`features`、`utils`
  中的 `t('…')`、`data-i18n` 與註冊表的 `label`／`description`／`title`，確認使用的鍵都存在於兩份語言檔；「跟隨瀏覽器」的判斷；切換後 `t()` 立即改變並通知訂閱者；
  佔位符代換；數字與檔案大小的格式。型別上 `MessageKey` 為英文語言檔的鍵，使用不存在的鍵會在 `npm run compile` 失敗。
- `node spikes/stage7/language-test.mjs`（英文瀏覽器、假觀看頁與設定頁）：16/16。
- `spikes/stage4/e2e-test.mjs` 的 `language` 段落（真正的橋接程式）：下載中切換語言、完成與失敗通知的語言、錯誤訊息（5 項）。
- `spikes/stage4/firefox-smoke.mjs`：Firefox 上設定頁切換語言並寫入 `sync:uiLanguage`。
- 既有的假頁面測試：`lib.mjs` 的 `launch` 依瀏覽器語言明確設定介面語言（`uiLanguage` 參數，`'auto'` 時不設定）。

| 007 驗收條件 | 狀態 |
|---|---|
| 英文瀏覽器選「繁體中文」，設定頁與已開啟的 YouTube 分頁（提示文字、面板、說明面板）立即變成中文 | ✔ 自動化（Chromium） |
| 下載中切換語言，進度與面板狀態不變，文字換成新語言 | ✔ 自動化（真正的橋接程式） |
| 選回「跟隨瀏覽器」後依瀏覽器語言顯示 | ✔ 自動化（英文瀏覽器；中文瀏覽器由單元測試與既有 zh-TW 測試涵蓋） |
| 下載完成的通知使用所選語言 | ✔ 自動化（Chrome；headless Firefox 無法確認通知） |
| 兩份語言檔的鍵完全一致 | ✔ 單元測試 |
| Chrome、Firefox 上都符合 | Chrome ✔；Firefox 驗證設定頁切換與設定寫入，YouTube 分頁上的切換待實測（`specs/e2e-checklist.md` 第 8 節） |

截圖：`T35-options-language-en.png`、`T35-options-language-zh-TW.png`、`T35-toolbar-zh-TW-switched.png`（釘選的循環面板在切換後保留）、
`T35-download-zh-TW-switched.png`（下載中切換）。

## T37 設定頁外觀（007 FR-20 至 FR-24）

- 設定 `sync:pageTheme`：`youtube`（預設）／`system`／`dark`／`light`；設定頁「介面語言」下方新增「外觀」選單與一行說明（只影響設定頁與彈出視窗，FR-23）。
- 記錄 YouTube 主題：深色模式功能（`features/viewing/dark-mode.ts`）原本就觀察 `<html dark>`，在同一個觀察中呼叫 `recordYouTubeTheme`，
  只在值改變時寫入 `local:lastYouTubeTheme`（FR-21、FR-24）。觀看輔助功能只在 `www.youtube.com`／`youtube.com` 且工具列啟用時作用，
  所以工具列被關閉時不再記錄（QUESTIONS Q52）。
- `utils/page-theme.ts`：`resolvePageTheme`（有單元測試）與 `applyPageTheme`：設定頁與彈出視窗啟動時讀取兩個設定，以 `<html data-theme="dark|light">`
  切換顏色變數（同時設定 `color-scheme`，原生控制項與下拉清單跟著變）；監聽 storage 與 `prefers-color-scheme` 的變化即時更新（FR-22）。
  JS 套用前（沒有 `data-theme`）以 `prefers-color-scheme` 決定，避免閃爍成錯誤的顏色。
- 驗證：`node spikes/stage7/appearance-test.mjs` 11/11（「跟隨 YouTube」時 YouTube 深色、系統淺色 → 設定頁與彈出視窗深色；YouTube 切成淺色 → 已開啟的設定頁立即變淺色；
  深色、淺色、跟隨系統各自正確且不受 YouTube 影響；系統主題改變時即時更新；設定存在 sync；中文選單；不改變 YouTube 的主題）。
  `firefox-smoke.mjs` 驗證 Firefox 上設定頁的外觀選單立即套用。截圖：`T37-options-dark.png`、`T37-options-light.png`。

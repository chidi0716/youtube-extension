# web-ext lint 可接受的警告

`npx web-ext lint --self-hosted --source-dir .output/firefox-mv3` 必須是 0 個錯誤；下表以外的警告都要修正。

T43 起 Firefox 版 manifest 有 `browser_specific_settings.gecko.update_url`（自行發佈、由瀏覽器自動更新，plan 4.10）。不加 `--self-hosted` 時 web-ext lint 會把它當成 AMO 上架版本而回報錯誤 `MANIFEST_UPDATE_URL`（「"update_url" is not allowed.」）；本專案以 AMO 不公開頻道簽署後自行發佈，所以一律以 `--self-hosted` 檢查（`scripts/release.mjs` 與 `spikes/stage4/final-check.sh` 都已加上，見 QUESTIONS Q57）。
新增例外前要先經規格方同意（見 `specs/QUESTIONS.md`）。

| 警告代碼 | 檔案 | 理由 | 依據 |
|---|---|---|---|
| `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` | `manifest.json` | `browser_specific_settings.gecko.data_collection_permissions` 在 Firefox for Android 142 才支援，而 `strict_min_version` 是 140。本專案不支援 Firefox Android（constitution 第 5 點），桌面版 140 已支援這個欄位。 | Q5、plan 3.3.1 |
| `UNSAFE_VAR_ASSIGNMENT`（Unsafe assignment to innerHTML） | `content-scripts/youtube.js` | 來自 Preact 本身：它的 diff 程式碼支援 `dangerouslySetInnerHTML`，因此含有 `innerHTML` 指派。本專案**不得**使用 `dangerouslySetInnerHTML`，所以這段程式在執行時不會被走到；圖示也是取出 path 後用 JSX 畫出，不經過 innerHTML。 | Q10、plan 第 2 節 |

## 最近一次檢查

- 日期：2026-10-23（T37）
- 結果：0 個錯誤、2 個警告（即上表兩項：`manifest.json`、`content-scripts/youtube.js`）、0 個 notice。`background.js`（含原生訊息與通知）、`options.html` 的腳本（設定頁的工具列區與下載區以 DOM API 建立元素與圖示，沒有 innerHTML，也不含 Preact）、`content-scripts/tidy.js` 沒有警告。

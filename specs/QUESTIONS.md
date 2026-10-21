# 實作方的疑問

實作方在這裡記錄規格不清楚或彼此矛盾的地方，由規格方以修改 `specs/` 的方式回答。回答後請在該題標註「已回答」與對應的規格修改位置。

## 階段 0（T00、T01）

### Q1 Firefox 版本的發佈與安裝方式（T01）— 已回答：plan 3.3.1、tasks T01a

- **狀況**：正式版 Firefox 只允許安裝經過 Mozilla 簽署的附加元件；未簽署的版本只能從 `about:debugging` 以「暫時附加元件」載入，重新開機就會消失。規格與計畫都沒有寫 Firefox 版本要怎麼交給使用者（上架 AMO、以「不公開（unlisted）」方式送 AMO 簽署，或只支援開發者自行載入）。
- **相關**：Mozilla 目前要求新送審的附加元件在 `browser_specific_settings.gecko.data_collection_permissions` 宣告是否收集資料。依 constitution 第 2 點，本專案應宣告 `{"required": ["none"]}`，但 plan 3.2 沒有列出這個欄位，所以 T01 **沒有加入**。
- **目前做法**：manifest 只放 plan 3.3 指定的 `gecko.id`。因此 `web-ext lint` 對 `.output/firefox-mv3` 會出現 1 個警告 `MISSING_DATA_COLLECTION_PERMISSIONS`（0 個錯誤）。
- **請規格方決定**：Firefox 版的發佈方式；若需要送簽署，是否在 plan 3.2／3.3 加上 `data_collection_permissions`。

### Q2 Firefox 最低版本（T01）— 已回答：Firefox 128 以上，constitution 第 5 點、plan 3.3.1

- **狀況**：plan 3.5 使用 `world: 'MAIN'` 的內容腳本，Firefox 128 起才支援；T00 確認的「原生訊息連線期間背景頁不會被暫停」是 Firefox 104 起的行為。規格沒有寫 Firefox 的最低支援版本，manifest 也就沒有 `strict_min_version`。
- **目前做法**：不設定 `strict_min_version`。
- **請規格方決定**：是否在 constitution 第 5 點或 plan 中寫明 Firefox 最低版本（例如 128，也就是目前的 ESR 系列之一以上），並加入 manifest。

### Q3 Chrome 金鑰的私鑰（T01）— 已回答：不保留私鑰、不打包 .crx，plan 3.3

- **狀況**：plan 3.3 要求「只提交公鑰，私鑰不進 repo」。實作時私鑰只存在於產生金鑰的管線記憶體中，沒有寫入任何檔案，因此**已經不存在**。擴充功能 ID 只由公鑰決定，未封裝載入不需要私鑰；但若之後要自行打包 `.crx`，需要同一把私鑰才能維持相同 ID。
- **目前做法**：只保留公鑰（`wxt.config.ts`），ID 記在 `specs/notes/extension-ids.md`；`.gitignore` 已排除 `*.pem` 等私鑰檔名作為保險。
- **請規格方確認**：不需要打包 `.crx`（002「不在本次範圍」已排除上架商店）。若需要，請專案擁有者自行產生金鑰並保管私鑰，再替換 `wxt.config.ts` 的公鑰與 `extension-ids.md` 的 ID。

### Q4 擴充功能的正式名稱（T01）— 待定：專案擁有者尚未決定名稱，暫時沿用現有名稱，之後只需修改 _locales

- **狀況**：規格沒有定義擴充功能的顯示名稱與說明文字。現有程式碼使用 “YouTube Extension” / “A browser extension for YouTube”。
- **目前做法**：沿用現有名稱，`en` 與 `zh_TW` 名稱相同，說明文字翻成「YouTube 瀏覽器擴充功能」。
- **請規格方決定**：正式名稱與兩種語言的說明文字。

## 階段 1（T01a、T02–T05）

### Q5 `strict_min_version: 128` 與「web-ext lint 無警告」互相矛盾（T01a）

- **狀況**：plan 3.3.1 指定 `strict_min_version: "128.0"` 並宣告 `data_collection_permissions`。但 `data_collection_permissions` 是 Firefox 140（Android 142）才支援的欄位，所以 `web-ext lint` 會出現 2 個警告：`KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION`、`KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`（0 個錯誤）。tasks T01a 的完成條件要求「沒有錯誤與警告」，兩者無法同時成立。
- **Mozilla 文件**（<https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/>）：新擴充功能建議把 `strict_min_version` 設為 140（`gecko_android` 為 142）；舊版 Firefox 會忽略這個欄位。本專案宣告不收集資料（`none`），在 128–139 版上不需要額外處理。
- **目前做法**：依 plan 3.3.1 維持 128，接受這 2 個警告。
- **請規格方決定**：改成最低 Firefox 140（同時修改 constitution 第 5 點），或接受這 2 個警告並修改 T01a 的完成條件。

### Q6 AMO 是否需要上傳原始碼（T01a）

- **狀況**：WXT 建置出的 JavaScript 經過壓縮（minify）。Mozilla 的原始碼提交說明（<https://extensionworkshop.com/documentation/publish/source-code-submission/>）要求「經過處理而無法閱讀」的程式碼附上原始碼與建置說明；文件沒有明確說明 unlisted 簽署是否同樣適用。plan 3.3.1 沒有提到原始碼。
- **目前做法**：`npm run sign:firefox` 只依 plan 3.3.1 組出 `web-ext sign --channel unlisted`，不附原始碼。
- **請規格方決定**：是否 (a) Firefox 版關閉壓縮，或 (b) 送簽署時以 `wxt zip -b firefox` 產生的原始碼壓縮檔加上 `--upload-source-code`，或 (c) 維持現狀，等 AMO 要求時再處理。

### Q7 YouTube 劇院模式下的工具列寬度（T03）

- **狀況**：001 FR-2 要求工具列「寬度與播放器相同」，FR-3 要求切換劇院模式時「跟著播放器寬度調整」。工具列插在播放器下方、標題上方的欄位（plan 3.4 的錨點）。一般模式下這個欄位與播放器同寬（實測 967px = 967px）；YouTube 劇院模式下播放器變成整個視窗寬（實測 1400px），但標題所在的欄位仍是左欄寬度，工具列也就跟著標題欄（967px），不會與播放器同寬。
- **目前做法**：工具列維持在標題欄、與標題同寬（截圖 `specs/notes/screenshots/T03-youtube-theater.png`）。若要與劇院模式的播放器同寬，就得把工具列移到播放器容器內或另外蓋在頁面上，會與右側推薦影片欄重疊。
- **請規格方決定**：劇院模式下維持現狀（與標題欄同寬），或改成與播放器同寬（並說明與右側欄重疊時的處理方式）。

### Q8 plan 3.6 列出的 `--yt-spec-*` 變數在目前的 YouTube 不存在（T03）

- **狀況**：實測 2026-10-21 的 YouTube（未登入，淺色與深色主題），`--yt-spec-text-primary`、`--yt-spec-menu-background`、`--yt-spec-badge-chip-background`、`--yt-spec-call-to-action` 等變數都沒有定義；YouTube 目前使用 `--yt-sys-color-baseline--text-primary`、`--yt-sys-color-baseline--menu-background` 等名稱（深色主題下會自動換值，例如選單背景 `#282828`）。
- **目前做法**：每個顏色依序使用 plan 3.6 的 `--yt-spec-*` → `--yt-sys-color-baseline--*` → 固定備用值（淺色主題的值），集中定義在 `components/toolbar/toolbar.css` 開頭。深色主題下實測圖示為 `#f1f1f1`、面板背景為 `#282828`，符合 001 的外觀規格。
- **請規格方確認**：這個做法可以接受；或在 plan 3.6 改列新的變數名稱。

### Q9 釘選面板的細節（T03）

001 FR-10 與 FR-13 有幾處沒有寫清楚，目前依下列解讀實作（`components/toolbar/panel-state.ts`，都有單元測試）：

1. **已釘選時點另一個面板按鈕**：FR-10 說「展開另一個面板時，前一個自動收起」，FR-13 說釘選後「只有再點按鈕或按面板內的取消釘選才會收起」，兩者衝突。目前依 FR-10：前一個（即使已釘選）收起，新面板不帶釘選。
2. **未釘選的面板遇到換頁**：FR-13 只說釘選的面板換頁後維持展開。目前未釘選的面板在換頁時收起。
3. **「取消釘選」**：依 FR-13 字面，按下「取消釘選」會同時收起面板（不是只取消釘選、維持展開）。
4. **釘選按鈕的位置**：規格只有 MP3 面板寫了底部的「釘選面板」按鈕（002 FR-20）。FR-13 適用於所有面板，所以目前每個面板標題列右側都有一個圖示按鈕（Material Symbols `keep`／`keep_off`），提示文字為「釘選面板」／「取消釘選」。

- **請規格方確認**以上 4 點，或修改 001 FR-10、FR-13。

### Q10 Preact 的 innerHTML 造成 web-ext lint 警告（T03）

- **狀況**：加入工具列後，`web-ext lint` 多了 1 個警告 `UNSAFE_VAR_ASSIGNMENT`（`content-scripts/youtube.js`，「Unsafe assignment to innerHTML」）。來源是 Preact 本身的 diff 程式碼：它支援 `dangerouslySetInnerHTML` 屬性，所以程式中有 `e.innerHTML = ...`。本專案沒有使用 `dangerouslySetInnerHTML`（圖示也是取出 path 後用 JSX 畫，不用 innerHTML），這段程式在執行時不會被走到。
- **目前做法**：維持 plan 第 2 節選定的 Preact，不修改或替換套件程式碼。
- **影響**：加上 Q5 的 2 個警告，`web-ext lint` 目前是 0 個錯誤、3 個警告，無法達成 T01a／本階段「無錯誤無警告」的完成條件。
- **請規格方決定**：接受這個警告（AMO 審查時說明來源），或改變 UI 的實作方式（例如不用 Preact）。

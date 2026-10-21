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

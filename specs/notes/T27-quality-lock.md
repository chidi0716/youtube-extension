# T27 鎖定畫質

日期：2026-10-22　負責：實作方

## 做法（plan 3.7.1）

- 「更多」面板最後一列「鎖定畫質」，右側為下拉選單：關閉（預設）、最高可用畫質、2160p、1440p、1080p、720p、480p。設定存在 `sync:qualityLock`（`utils/settings.ts`）。
- 頁面橋接腳本新增三個請求（`utils/youtube/bridge.ts`）：
  - `getAvailableQualities`：`#movie_player.getAvailableQualityLevels()`，只回傳已知的畫質代號（去掉 `auto` 與其他值）；
  - `getQuality`：`getPlaybackQuality()`，不是已知代號時（例如 `unknown`）回傳 null；
  - `setQuality`：參數只接受白名單 `tiny`、`small`、`medium`、`large`、`hd720`、`hd1080`、`hd1440`、`hd2160`、`hd2880`、`highres` 與 `auto`；呼叫 `setPlaybackQualityRange(q, q)` 與 `setPlaybackQuality(q)`。
- 選擇邏輯（`features/viewing/quality-logic.ts`，有單元測試）：可用畫質中不高於鎖定值的最高畫質；都比鎖定值高時用最低的畫質。
- 檢查時機（不輪詢，`features/viewing/quality.ts`）：`<video>` 的 `loadedmetadata`、`playing`、`resize`（畫質改變時解析度改變，`<video>` 會發出 `resize`），以及換頁、改變設定時。媒體事件不冒泡，所以在 `document` 的捕獲階段監聽。
- 手動改畫質的判斷（FR-4）：畫質變成鎖定值以外的值時，如果使用者在 10 秒內在播放器的設定選單（`.ytp-settings-menu`）中點擊或按鍵，就視為手動選擇，這部影片不再強制；否則視為 YouTube 自動調整，切回鎖定的畫質（FR-3）。換到下一部影片（影片 ID 改變）時恢復鎖定。
- 選「關閉」或工具列被關閉（003 FR-5）時，若這個頁面曾經設定過畫質，呼叫 `setQuality('auto')` 交還給 YouTube。

## 在真實 YouTube 上確認到的事（2026-10-22）

觀看頁直接載入會被驗證頁擋住，所以從首頁以站內搜尋與點擊進入（`spikes/stage2c/probe-watch.mjs`，結果 `spikes/stage2c/results-watch.txt`）。影片本身在本環境無法播放（Video unavailable）。

- `#movie_player` 上有以下方法：`getAvailableQualityLevels`、`getPlaybackQuality`、`setPlaybackQuality`、`setPlaybackQualityRange`、`getAvailableQualityData`、`getAvailableQualityLabels`、`getPlaybackQualityLabel`、`getPreferredQuality`、`getMaxPlaybackQuality`、`getUserPlaybackQualityPreference`。
- 影片無法播放，所以 `getAvailableQualityLevels()` 回傳 `[]`、`getPlaybackQuality()` 回傳 `"unknown"`。
- 畫質代號與解析度的對應依 YouTube IFrame Player API 的公開文件（`small`、`medium`、`large`、`hd720`、`hd1080`、`highres` 等）；`hd1440`、`hd2160`、`hd2880`、`tiny` 依相同命名規則加入。

## 本環境無法驗證的部分

1. `setPlaybackQualityRange(q, q)` ＋ `setPlaybackQuality(q)` 是否真的讓播放器切換到該畫質，並在網路變慢時不再自動降畫質。
2. 真實影片在可以播放時，`getAvailableQualityLevels()` 的內容（推測為由高到低的代號，最後是 `auto`）。
3. `setPlaybackQualityRange('auto', 'auto')` 是否讓 YouTube 恢復自動決定畫質。
4. 使用者從齒輪手動改畫質時，YouTube 的設定選單元素是否仍是 `.ytp-settings-menu`（觀看頁上有此元素，見 `results-watch.txt` 的 player children）。

假觀看頁（`spikes/stage1-smoke/fixtures/stage2c-watch.js`）模擬上述方法與齒輪選單，驗證了 004 第 1 節的流程（`spikes/stage1-smoke/convenience-test.mjs` 的 T27，13 項）。

## 給專案擁有者的手動驗證步驟

在 Chrome 與 Firefox（或 Zen）上：

1. 打開一部有 4K 的影片（例如搜尋「4K nature」），在工具列「更多」中把「鎖定畫質」設為 1080p。在播放器上按右鍵 →「詳細統計資料」（Stats for nerds），確認「Current / Optimal Res」為 1920x1080 或齒輪中的畫質顯示 1080p。
2. 打開一部最高只有 720p 的影片：畫質為 720p。
3. 在同一部影片中，從齒輪手動改成 480p：維持 480p，不會被切回。換下一部影片：恢復 1080p。
4. 重新整理、重新開啟瀏覽器：設定仍是 1080p 並生效。
5. 選「關閉」：齒輪中的畫質回到「自動」，YouTube 依網路自行調整。
6. 若任一步驟畫質沒有改變，請在開發者工具的 Console 中執行以下程式並回報結果（只讀取，不修改）：

   ```js
   const p = document.querySelector('#movie_player');
   [p.getAvailableQualityLevels(), p.getPlaybackQuality(), typeof p.setPlaybackQualityRange]
   ```

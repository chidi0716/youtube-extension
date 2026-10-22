# T31 頁面整理：需要程式的選項

日期：2026-10-22　負責：實作方

三個選項都在 `features/tidy/scripts.ts`，由 `document_start` 的頁面整理內容腳本（T29）依設定啟動與停止；設定關閉時移除所有監聽。純邏輯在 `features/tidy/script-logic.ts` 與 `utils/youtube/page.ts`，都有單元測試。都不輪詢（005 NFR-2）。

## 永遠使用原始語音（FR-10 至 FR-13）

- 頁面橋接腳本新增兩個請求（`utils/youtube/bridge.ts`，有白名單與參數驗證測試）：
  - `getAudioTracks`：`getAvailableAudioTracks()` 與 `getAudioTrack()`，整理成 `{ id, name, isDefault, isAutoDubbed, isOriginal }`；
  - `setAudioTrack`：參數 `trackId` 必須符合 `^[A-Za-z0-9._:-]{1,64}$`，而且必須是目前清單中存在的語音軌，否則不做任何事；切換後播放位置被移動超過 2 秒時跳回原本的位置（FR-13）。
- 時機：`<video>` 的 `loadedmetadata`、`playing`（在 `document` 捕獲階段監聽），以及換頁。每部影片只判斷一次：清單載入後，目前是自動配音才切到原始語音；之後這部影片不再介入，所以使用者手動選的語音軌會被尊重（FR-12）；換到下一部影片時重新判斷。
- 原始語音的判斷（`pickOriginalTrack`）：明確標示為原始語音（`xtags` 含 `acont=original`）→ 影片的預設語音軌 → 唯一不是自動配音的語音軌；任一步有多個候選時不做任何事。人工配音不處理（QUESTIONS Q22）。

### 在真實 YouTube 上確認到的事

- `#movie_player` 有 `getAvailableAudioTracks`、`getAudioTrack`、`setAudioTrack`（`spikes/stage2c/results-watch.txt`）。
- 影片無法播放時，`getAvailableAudioTracks()` 為 `[]`；`getAudioTrack()` 回傳 `{"id":"und","Nb":{"name":"Default","id":"und","isDefault":true,"isAutoDubbed":false},"xtags":"",…}`。內層物件的屬性名稱（`Nb`）是壓縮過的短名稱，所以程式以「含有 `isAutoDubbed` 或 `isDefault` 布林值的子物件」尋找。

### 本環境無法驗證的部分

1. 有自動配音的影片，`getAvailableAudioTracks()` 的實際內容（是否每個語音軌都有 `isAutoDubbed`、原始語音是否 `isDefault: true`、`xtags` 的格式）。
2. `setAudioTrack(語音軌物件)` 是否切換語音、是否保留播放位置。
3. 只有一個語音軌的一般影片，`getAvailableAudioTracks()` 是空陣列還是一個項目（兩種情況都不會切換）。

## 自動關閉「影片已暫停，要繼續觀看嗎？」（FR-30、FR-31）

- 只以一個 `MutationObserver` 觀察 YouTube 的彈出視窗容器 `ytd-popup-container`（已確認在 `ytd-app` 底下）；容器在首次載入時較晚出現，所以在 `DOMContentLoaded` 與換頁時尋找。
- 容器中出現可見的 `yt-confirm-dialog-renderer` 時，若 (1) 使用者在這個頁面 30 秒內沒有點擊或按鍵、(2) 影片在 10 秒內被暫停、(3) 影片目前是暫停的，就按下 `#confirm-button` 中的按鈕；影片仍暫停時直接播放。不依賴對話框的文字（QUESTIONS Q23）。
- 本環境無法讓 YouTube 顯示這個對話框，元素名稱依公開觀察，未確認。

## Shorts 改用一般播放器（FR-50 至 FR-52）

- `watchUrlForShorts`：只把 `www.youtube.com`、`youtube.com` 上的 `/shorts/<11 碼影片 ID>` 轉成 `/watch?v=<ID>`；其他網址（含觀看頁）一律不轉，所以不會形成循環。
- 時機：內容腳本啟動時（`document_start`，讀到設定後）、`yt-navigate-finish`（站內換頁）、`popstate`（上一頁／下一頁），以及開啟設定的當下。以 `location.replace` 轉換，瀏覽紀錄中的 Shorts 頁面被取代（FR-51）。
- 站內點擊 Shorts 時，YouTube 先以站內換頁進入 Shorts 頁，`yt-navigate-finish` 後才轉換，所以 Shorts 頁可能會短暫出現。
- 真實頁面：左側導覽的 Shorts 入口沒有 `href`（YouTube 會自己選一部 Shorts），換頁後網址是 `/shorts/<ID>`，同樣會被轉換（未在本環境實際點擊）。

## 假頁面驗證

`spikes/stage1-smoke/convenience-test.mjs` 的 T31（16 項）：

- 原始語音：開啟時立即切換且繼續播放、沒有跳回開頭；手動改成配音後維持；換到下一部影片恢復；單一語音軌與預設就是原始語音時不切換；直接打開時切換。
- 繼續觀看：對話框被關閉並繼續播放；對話框再次出現（被重複使用）時同樣處理；自己按暫停的影片不會被播放；使用者剛操作過時出現的其他確認對話框不受影響。
- Shorts：開啟時已開著的 Shorts 頁立即轉換；直接輸入、首頁站內點擊、觀看頁推薦清單點擊都轉成觀看頁且工具列出現；上一頁回到首頁、下一頁回到觀看頁，沒有循環。
- 假頁面的模擬：`fixtures/stage2c-watch.js`（語音軌方法、齒輪選單中的語音軌、彈出視窗容器與對話框）、`fixtures/shorts.html`、`fixtures/browse.js`（站內換頁到 Shorts）。
- 截圖：`screenshots/T31-continue-dialog-fixture.png`（假頁面的對話框，未開啟選項時）、`screenshots/T31-shorts-as-watch.png`。

## 給專案擁有者的手動驗證步驟

在 Chrome 與 Firefox（或 Zen）上，於設定頁開啟對應選項：

1. **永遠使用原始語音**：找一部有自動配音的影片（播放器齒輪中有「音軌」選項，且其中有標示「自動配音」的語言；可把 YouTube 介面語言改成與影片不同的語言以觸發預設配音）。
   - 打開影片：播放的是原始語音，齒輪中的音軌顯示原始語言，影片沒有跳回開頭。
   - 在齒輪中手動改成配音：這部影片維持配音。換到下一部有配音的影片：恢復原始語音。
   - 沒有切換時，請在 Console 執行以下程式並回報結果（只讀取）：

     ```js
     const p = document.querySelector('#movie_player');
     JSON.stringify([p.getAvailableAudioTracks(), p.getAudioTrack()]).slice(0, 3000)
     ```
2. **自動關閉「要繼續觀看嗎？」**：播放一個長播放清單或直播，離開電腦不操作，直到 YouTube 顯示「影片已暫停，要繼續觀看嗎？」：對話框應被自動關閉並繼續播放。自己按暫停的影片不應被自動播放。若對話框沒有被關閉，請在開發者工具中選取對話框，回報它與上層元素的 tag 名稱。
3. **Shorts 改用一般播放器**：從首頁或搜尋點一部 Shorts、直接在網址列輸入 `https://www.youtube.com/shorts/<ID>`、點左側選單的「Shorts」：都以一般觀看頁播放並有工具列；按上一頁回到原本的頁面，不會卡在轉換。

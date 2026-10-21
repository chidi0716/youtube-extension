# T28 複製連結

日期：2026-10-22　負責：實作方

## 做法（plan 3.7.1）

- 工具列左組在「截圖」右邊加入「連結」面板按鈕（`components/toolbar/buttons.ts`）；說明面板依按鈕清單自動列出，不需另外維護。
- 連結與 Markdown 文字的產生是純函式（`features/link/link-logic.ts`，有單元測試）：
  - 一律為 `https://youtu.be/<影片ID>`，只帶影片 ID 與時間，所以播放清單等其他參數不會出現（FR-35）；
  - 時間無條件捨去，0 秒（不到 1 秒）時不加 `?t=`（FR-33）；
  - Markdown 為 `[標題（mm:ss）](連結)`，一小時以上為 `hh:mm:ss`（沿用 `utils/time.ts` 的 `formatTime`）。標題中的 `[`、`]`、`\` 加上反斜線，換行改成空白，避免破壞 Markdown 連結。
  - 預覽過長時在中間以「…」省略（以字元計算，保留開頭與結尾的時間）。
- 面板（`components/panels/LinkPanel.tsx`）：
  - 標題由頁面橋接腳本的 `getVideoData` 取得；讀不到時顯示錯誤與「重試」（001 FR-14）。
  - 時間直接讀 `<video>.currentTime`，只在面板開著時監聽 `timeupdate`、`seeked`（FR-32）。
  - 在點擊事件中直接呼叫 `navigator.clipboard.writeText`；成功時該行顯示「已複製」2 秒（一次性的計時器）；失敗時顯示錯誤與唯讀文字框，文字框自動取得焦點並全選（FR-34）。
- 不需要新的權限：剪貼簿寫入在使用者點擊時由頁面的 Clipboard API 處理。

## 驗證

- 單元測試：`features/link/link-logic.test.ts`（含 83 秒 → `[標題（01:23）](https://youtu.be/ID?t=83)`、一小時以上、0 秒、跳脫、省略）。
- 假觀看頁（`spikes/stage1-smoke/convenience-test.mjs` 的 T28，13 項）：按鈕順序、說明面板、三種格式、0 秒、播放中更新、實際複製到剪貼簿、「已複製」消失、釘選面板換頁、播放清單網址、複製失敗（以 Chrome DevTools Protocol 拒絕剪貼簿寫入權限）。假影片只有 30 秒，所以以 23 秒驗證；83 秒的例子由單元測試涵蓋。
- 截圖：`screenshots/T28-link-panel-copied.png`、`screenshots/T28-link-panel-copy-failed.png`。

## 給專案擁有者的手動驗證步驟

在 Chrome 與 Firefox（或 Zen）上：

1. 打開一部影片，播放到 1 分 23 秒左右暫停，按工具列的「連結」。
2. 點「Markdown 格式」，貼到任一文字編輯器：應為 `[影片標題（01:23）](https://youtu.be/<ID>?t=83)`；點「目前時間的連結」與「不含時間的連結」各貼一次確認。
3. 從播放清單打開一部影片（網址有 `list=`），複製的連結不含 `list`。
4. Firefox 上若複製失敗（出現錯誤與文字框），請回報 Firefox 版本，以及是否有安裝其他會限制剪貼簿的擴充功能。

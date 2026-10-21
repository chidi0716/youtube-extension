// 所有設定的 storage 定義集中於此（plan 3.1）。
// 檔案位於 utils/，WXT 會自動匯入這裡的 export。

/**
 * 工具列是否顯示（001 FR-15、FR-16）。
 * 存在 sync 區，跨分頁、跨重新開機，並跟著使用者的瀏覽器帳號同步。
 */
export const enabled = storage.defineItem<boolean>('sync:enabled', {
  fallback: true,
});

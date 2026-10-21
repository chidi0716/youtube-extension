// 所有設定的 storage 定義集中於此（plan 3.1）。
// 檔案位於 utils/，WXT 會自動匯入這裡的 export。
// 設定都存在 sync 區：跨分頁、跨重新開機，並跟著使用者的瀏覽器帳號同步。

/** 工具列是否顯示（001 FR-15、FR-16）。 */
export const enabled = storage.defineItem<boolean>('sync:enabled', {
  fallback: true,
});

/**
 * 深色模式（003 FR-10、FR-1）。null 表示使用者還沒用工具列切換過，不改變 YouTube 原本的主題。
 */
export const darkMode = storage.defineItem<boolean | null>('sync:darkMode', {
  fallback: null,
});

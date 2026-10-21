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

/** 浮動播放器是否開啟（003 FR-40、FR-1）。 */
export const floatingPlayer = storage.defineItem<boolean>('sync:floatingPlayer', {
  fallback: false,
});

/** 浮動播放器貼齊的角落（003 FR-41）。 */
export const floatingCorner = storage.defineItem<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>(
  'sync:floatingCorner',
  { fallback: 'bottom-right' },
);

/** 切換分頁時自動暫停（003 FR-60）。 */
export const smartPause = storage.defineItem<boolean>('sync:smartPause', { fallback: false });

/** 純音訊模式（003 FR-62）。 */
export const audioOnly = storage.defineItem<boolean>('sync:audioOnly', { fallback: false });

/** 滑鼠滾輪調整音量（003 FR-63）。 */
export const wheelVolume = storage.defineItem<boolean>('sync:wheelVolume', { fallback: false });

/** 隱藏留言（003 FR-64）。 */
export const hideComments = storage.defineItem<boolean>('sync:hideComments', { fallback: false });

// 深色模式的判斷（003 FR-10 至 FR-12）。純函式。

/**
 * 使用者操作後多久內發生的主題變更，視為使用者從 YouTube 選單切換的。
 * 沒有使用者操作時的變更（例如 YouTube 載入時自己套用主題）不覆寫記住的設定。
 */
export const USER_CHANGE_WINDOW_MS = 5000;

/**
 * YouTube 頁面的主題被改變（不是本擴充功能改的）時要怎麼處理：
 * - remember：使用者從 YouTube 選單切換，按鈕與記住的狀態跟著更新；
 * - reapply：沒有使用者操作，重新套用記住的主題；
 * - follow：沒有記住的主題，只更新按鈕。
 */
export function decideThemeChange(
  remembered: boolean | null,
  current: boolean,
  now: number,
  lastUserInteraction: number | null,
): 'remember' | 'reapply' | 'follow' {
  if (lastUserInteraction !== null && now - lastUserInteraction <= USER_CHANGE_WINDOW_MS) return 'remember';
  if (remembered === null || remembered === current) return 'follow';
  return 'reapply';
}

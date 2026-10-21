// 面板開關的狀態機（001 FR-10 至 FR-13、FR-19）。純函式，方便測試。

export interface PanelState<Id extends string = string> {
  /** 目前展開的面板；null 表示沒有展開。同一時間最多一個（FR-10）。 */
  openId: Id | null;
  /** 目前展開的面板是否被釘選（FR-13）。 */
  pinned: boolean;
  /**
   * 剛收起的面板，焦點要回到它的按鈕（FR-19）。
   * 點面板外面而收起時為 null，不搶走使用者剛點的位置的焦點。
   */
  restoreFocusTo: Id | null;
}

export type PanelAction<Id extends string = string> =
  /** 點面板按鈕：沒展開就展開（並收起其他面板）；已展開就收起（釘選時也一樣）。 */
  | { type: 'toggle'; id: Id }
  /** 按 Esc：未釘選時收起。 */
  | { type: 'escape' }
  /** 點面板與工具列以外的地方：未釘選時收起。 */
  | { type: 'outside' }
  /** 面板內的「釘選面板」。 */
  | { type: 'pin' }
  /** 面板內的「取消釘選」：取消釘選並收起（FR-13）。 */
  | { type: 'unpin' }
  /** YouTube 換頁：釘選的面板維持展開，未釘選的收起（FR-13）。 */
  | { type: 'navigate' }
  /** 焦點已經還給按鈕。 */
  | { type: 'focusRestored' };

export function initialPanelState<Id extends string = string>(): PanelState<Id> {
  return { openId: null, pinned: false, restoreFocusTo: null };
}

export function panelReducer<Id extends string>(state: PanelState<Id>, action: PanelAction<Id>): PanelState<Id> {
  const closed = (restoreFocusTo: Id | null): PanelState<Id> => ({ openId: null, pinned: false, restoreFocusTo });
  switch (action.type) {
    case 'toggle':
      if (state.openId === action.id) return closed(action.id);
      // 展開另一個面板時，前一個（即使已釘選）自動收起（FR-10）。
      return { openId: action.id, pinned: false, restoreFocusTo: null };
    case 'escape':
      return state.openId !== null && !state.pinned ? closed(state.openId) : state;
    case 'outside':
      return state.openId !== null && !state.pinned ? closed(null) : state;
    case 'pin':
      return state.openId !== null ? { ...state, pinned: true } : state;
    case 'unpin':
      return state.openId !== null ? closed(state.openId) : state;
    case 'navigate':
      return state.openId !== null && !state.pinned ? closed(null) : state;
    case 'focusRestored':
      return state.restoreFocusTo === null ? state : { ...state, restoreFocusTo: null };
  }
}

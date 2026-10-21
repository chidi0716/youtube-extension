// 浮動播放器的計算與狀態（003 FR-40 至 FR-43）。純函式。

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const CORNERS: readonly Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export interface Viewport {
  width: number;
  height: number;
  /** 頂端被 YouTube 標題列蓋住的高度。 */
  topInset: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 浮動播放器與視窗邊緣的距離。 */
export const MARGIN = 16;
/** 寬度約為視窗寬度的 25%，最小 320px（FR-43）。 */
export const WIDTH_RATIO = 0.25;
export const MIN_WIDTH = 320;

export function isCorner(value: unknown): value is Corner {
  return typeof value === 'string' && (CORNERS as readonly string[]).includes(value);
}

/** 浮動播放器的尺寸：視窗寬 25%（最小 320px，但不超過視窗），並維持影片比例。 */
export function floatingSize(viewport: Viewport, aspect: number): { width: number; height: number } {
  const ratio = aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9;
  const maxWidth = Math.max(0, viewport.width - MARGIN * 2);
  const maxHeight = Math.max(0, viewport.height - viewport.topInset - MARGIN * 2);
  let width = Math.min(Math.max(MIN_WIDTH, Math.round(viewport.width * WIDTH_RATIO)), maxWidth);
  let height = Math.round(width / ratio);
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * ratio);
  }
  return { width, height };
}

/** 貼齊指定角落時的位置與尺寸。 */
export function cornerRect(corner: Corner, viewport: Viewport, aspect: number): Rect {
  const { width, height } = floatingSize(viewport, aspect);
  const left = corner.endsWith('left') ? MARGIN : viewport.width - width - MARGIN;
  const top = corner.startsWith('top') ? viewport.topInset + MARGIN : viewport.height - height - MARGIN;
  return { left, top, width, height };
}

/** 放開拖曳時，依播放器中心點所在的象限決定最近的角落（FR-41）。 */
export function nearestCorner(rect: Rect, viewport: Viewport): Corner {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const midY = viewport.topInset + (viewport.height - viewport.topInset) / 2;
  const vertical = cy < midY ? 'top' : 'bottom';
  const horizontal = cx < viewport.width / 2 ? 'left' : 'right';
  return `${vertical}-${horizontal}`;
}

/** 拖曳中的位置：限制在視窗內。 */
export function clampToViewport(rect: Rect, viewport: Viewport): Rect {
  const left = Math.min(Math.max(0, rect.left), Math.max(0, viewport.width - rect.width));
  const top = Math.min(Math.max(viewport.topInset, rect.top), Math.max(viewport.topInset, viewport.height - rect.height));
  return { ...rect, left, top };
}

// ---------------------------------------------------------------------------
// 狀態：是否要浮動
// ---------------------------------------------------------------------------

export interface FloatingState {
  /** 使用者是否開啟浮動播放器（會被記住）。 */
  enabled: boolean;
  /** 播放器原位置目前是否在畫面外。 */
  outOfView: boolean;
  /** 使用者按了浮動播放器上的 ✕：暫時回到原位置，直到下次捲動離開（FR-42）。 */
  dismissed: boolean;
  /** 全螢幕時不浮動。 */
  fullscreen: boolean;
}

export type FloatingEvent =
  | { type: 'enable'; enabled: boolean }
  | { type: 'visibility'; outOfView: boolean }
  | { type: 'dismiss' }
  | { type: 'fullscreen'; fullscreen: boolean }
  /** 換到另一部影片：清除暫時關閉。 */
  | { type: 'navigate' };

export function initialFloatingState(enabled = false): FloatingState {
  return { enabled, outOfView: false, dismissed: false, fullscreen: false };
}

export function floatingReducer(state: FloatingState, event: FloatingEvent): FloatingState {
  switch (event.type) {
    case 'enable':
      return { ...state, enabled: event.enabled, dismissed: false };
    case 'visibility':
      // 捲回播放器原位置後，✕ 的效果結束；下次捲動離開時再浮動。
      return { ...state, outOfView: event.outOfView, dismissed: event.outOfView ? state.dismissed : false };
    case 'dismiss':
      return isFloating(state) ? { ...state, dismissed: true } : state;
    case 'fullscreen':
      return { ...state, fullscreen: event.fullscreen };
    case 'navigate':
      return { ...state, dismissed: false };
  }
}

export function isFloating(state: FloatingState): boolean {
  return state.enabled && state.outOfView && !state.dismissed && !state.fullscreen;
}

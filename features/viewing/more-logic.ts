// 「更多」選單中各功能的純邏輯（003 FR-60、FR-63）。

// ---------------------------------------------------------------------------
// 滑鼠滾輪調整音量（FR-63）
// ---------------------------------------------------------------------------

/** 每格 5%。 */
export const VOLUME_STEP = 5;
/**
 * 以像素為單位的 wheel 事件：一次至少這麼多就當成滑鼠滾輪的一格（各瀏覽器一格約 100–120px）；
 * 比這小的（觸控板）累積到 PIXELS_PER_STEP 才算一格。
 */
export const NOTCH_MIN_PIXELS = 50;
export const PIXELS_PER_STEP = 100;

/** WheelEvent.deltaMode：0 像素、1 行、2 頁。 */
export type DeltaMode = 0 | 1 | 2;

export interface WheelAccumulator {
  pixels: number;
}

/**
 * 把一次 wheel 事件換算成音量格數（往上捲為正：音量變大）。
 * 滑鼠滾輪每一格（行／頁模式的每個事件，或像素模式中夠大的事件）算一格；
 * 觸控板送來的小量 deltaY 累積到 PIXELS_PER_STEP 才算一格，剩下的留給下次。
 */
export function wheelSteps(acc: WheelAccumulator, deltaY: number, deltaMode: DeltaMode): { acc: WheelAccumulator; steps: number } {
  if (!Number.isFinite(deltaY) || deltaY === 0) return { acc, steps: 0 };
  if (deltaMode !== 0 || Math.abs(deltaY) >= NOTCH_MIN_PIXELS) return { acc: { pixels: 0 }, steps: deltaY < 0 ? 1 : -1 };
  // 換方向時重新累積。
  const pixels = acc.pixels === 0 || Math.sign(acc.pixels) === Math.sign(deltaY) ? acc.pixels + deltaY : deltaY;
  const whole = Math.trunc(pixels / PIXELS_PER_STEP);
  if (whole === 0) return { acc: { pixels }, steps: 0 };
  return { acc: { pixels: pixels - whole * PIXELS_PER_STEP }, steps: -whole };
}

/** 依格數調整音量，限制在 0–100，並對齊 5 的倍數。 */
export function nextVolume(current: number, steps: number): number {
  const base = Number.isFinite(current) ? current : 0;
  if (steps === 0) return Math.min(100, Math.max(0, Math.round(base)));
  // 先對齊到格線，例如 47% 往上一格到 50%、往下一格到 45%。
  const aligned = steps > 0 ? Math.floor(base / VOLUME_STEP) * VOLUME_STEP : Math.ceil(base / VOLUME_STEP) * VOLUME_STEP;
  return Math.min(100, Math.max(0, aligned + steps * VOLUME_STEP));
}

// ---------------------------------------------------------------------------
// 切換分頁時自動暫停（FR-60）
// ---------------------------------------------------------------------------

export interface SmartPauseState {
  /** 目前的暫停是不是這個功能造成的。 */
  pausedByUs: boolean;
}

export type SmartPauseEvent =
  | { type: 'hidden'; playing: boolean }
  | { type: 'visible' }
  /** 使用者在分頁隱藏期間自己操作了播放（例如用媒體鍵播放），就不再自動恢復。 */
  | { type: 'userPlayback' }
  /** 換到另一部影片或關閉功能。 */
  | { type: 'reset' };

export type SmartPauseAction = 'pause' | 'play' | null;

export function smartPauseStep(state: SmartPauseState, event: SmartPauseEvent): { state: SmartPauseState; action: SmartPauseAction } {
  switch (event.type) {
    case 'hidden':
      return event.playing ? { state: { pausedByUs: true }, action: 'pause' } : { state: { pausedByUs: false }, action: null };
    case 'visible':
      return { state: { pausedByUs: false }, action: state.pausedByUs ? 'play' : null };
    case 'userPlayback':
    case 'reset':
      return { state: { pausedByUs: false }, action: null };
  }
}

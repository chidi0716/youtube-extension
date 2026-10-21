// 循環播放的判斷（003 FR-50 至 FR-53）。純函式：輸入目前播放時間，輸出要不要跳轉。
//
// 為了不讓影片真的播到結尾（YouTube 會自動播放下一部），整部重複模式在接近結尾時
// 就跳回開頭；只有最後一次才讓影片自然結束。

export type LoopConfig =
  /** 重複整部影片；times 為總共播放的次數（1–99），null 表示無限。 */
  | { mode: 'repeat'; times: number | null }
  /** 循環片段：播到 end 秒時跳回 start 秒。 */
  | { mode: 'segment'; start: number; end: number };

export interface LoopState {
  running: boolean;
  /** 已經完整播放（或片段播完）的次數。 */
  played: number;
  /**
   * 是否可以觸發下一次跳轉。跳轉後要等播放時間離開觸發點才重新啟動，
   * 避免同一個結尾被算兩次。
   */
  armed: boolean;
}

export interface LoopStep {
  state: LoopState;
  /** 要跳轉到的秒數；undefined 表示不跳轉。 */
  seekTo?: number;
}

/** 整部重複模式在結尾前多少秒就跳回開頭。timeupdate 大約每 250ms 觸發一次。 */
export const END_MARGIN = 0.4;
/** 跳轉後，播放時間要離開觸發點這麼多秒才重新啟動。 */
const REARM_DISTANCE = 1;

export const MIN_TIMES = 1;
export const MAX_TIMES = 99;

export function initialLoopState(): LoopState {
  return { running: false, played: 0, armed: true };
}

export function startLoop(): LoopState {
  return { running: true, played: 0, armed: true };
}

/** 驗證設定是否合法（次數 1–99 的整數，或片段的開始早於結束且在影片長度內）。 */
export function isValidLoopConfig(config: LoopConfig, duration: number): boolean {
  if (config.mode === 'repeat') {
    return config.times === null || (Number.isInteger(config.times) && config.times >= MIN_TIMES && config.times <= MAX_TIMES);
  }
  return config.start >= 0 && config.end <= Math.ceil(duration) && config.start < config.end;
}

/** 片段模式與整部模式的觸發點。 */
function triggerPoint(config: LoopConfig, duration: number): number {
  return config.mode === 'segment' ? config.end : Math.max(0, duration - END_MARGIN);
}

/**
 * 每次 timeupdate（或 ended）時呼叫。`ended` 為 true 表示影片已經播完
 * （例如 timeupdate 太慢沒趕上觸發點）。
 */
export function loopTick(state: LoopState, config: LoopConfig, currentTime: number, duration: number, ended = false): LoopStep {
  if (!state.running || !(duration > 0)) return { state };
  const trigger = triggerPoint(config, duration);
  const restart = config.mode === 'segment' ? config.start : 0;

  if (!state.armed) {
    // 跳轉完成、播放時間離開觸發點後才重新啟動。
    const away = currentTime < trigger - REARM_DISTANCE || currentTime < restart + REARM_DISTANCE;
    return away && !ended ? { state: { ...state, armed: true } } : { state };
  }

  if (currentTime < trigger && !ended) return { state };

  const played = state.played + 1;
  if (config.mode === 'repeat' && config.times !== null && played >= config.times) {
    // 最後一次：停止循環，讓影片自然結束。
    return { state: { running: false, played, armed: true } };
  }
  return { state: { running: true, played, armed: false }, seekTo: restart };
}

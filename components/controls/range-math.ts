// 雙把手區間滑桿的數值計算（純函式）。

export type RangeValue = readonly [start: number, end: number];
export type Thumb = 0 | 1;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 依 step 對齊（以 min 為基準），並限制在 [min, max]。 */
export function snap(value: number, min: number, max: number, step: number): number {
  if (!(step > 0)) return clamp(value, min, max);
  const snapped = min + Math.round((value - min) / step) * step;
  // 避免浮點誤差，例如 0.1 + 0.2
  return clamp(Number(snapped.toFixed(6)), min, max);
}

/** 指標在軌道上的位置換算成數值。 */
export function valueFromPosition(
  clientX: number,
  track: { left: number; width: number },
  min: number,
  max: number,
  step: number,
): number {
  if (track.width <= 0 || max <= min) return min;
  const ratio = clamp((clientX - track.left) / track.width, 0, 1);
  return snap(min + ratio * (max - min), min, max, step);
}

/** 數值在軌道上的百分比位置（0–100）。 */
export function percentOf(value: number, min: number, max: number): number {
  return max > min ? (clamp(value, min, max) - min) / (max - min) * 100 : 0;
}

/** 移動其中一個把手；開始不得超過結束，結束不得小於開始。 */
export function moveThumb(range: RangeValue, thumb: Thumb, value: number, min: number, max: number, step: number): RangeValue {
  const v = snap(value, min, max, step);
  return thumb === 0 ? [Math.min(v, range[1]), range[1]] : [range[0], Math.max(v, range[0])];
}

/** 點軌道時移動離指標比較近的把手；兩個把手重疊時，往右點移動結束、往左點移動開始。 */
export function nearestThumb(range: RangeValue, value: number): Thumb {
  const [start, end] = range;
  if (start === end) return value > end ? 1 : 0;
  return Math.abs(value - start) <= Math.abs(value - end) ? 0 : 1;
}

/** 鍵盤操作（WAI-ARIA slider）：方向鍵一步、Page Up/Down 十步、Home/End 到頭尾。 */
export function valueForKey(key: string, current: number, min: number, max: number, step: number): number | null {
  const big = step * 10;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return snap(current + step, min, max, step);
    case 'ArrowLeft':
    case 'ArrowDown':
      return snap(current - step, min, max, step);
    case 'PageUp':
      return snap(current + big, min, max, step);
    case 'PageDown':
      return snap(current - big, min, max, step);
    case 'Home':
      return min;
    case 'End':
      return max;
    default:
      return null;
  }
}

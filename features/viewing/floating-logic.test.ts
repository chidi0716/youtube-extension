import { describe, expect, it } from 'vitest';
import {
  clampToViewport,
  cornerRect,
  floatingReducer,
  floatingSize,
  initialFloatingState,
  isCorner,
  isFloating,
  nearestCorner,
  type FloatingEvent,
  type Viewport,
} from './floating-logic';

const viewport: Viewport = { width: 1600, height: 900, topInset: 56 };

describe('floatingSize（FR-43）', () => {
  it('寬度為視窗的 25%，維持 16:9', () => {
    expect(floatingSize(viewport, 16 / 9)).toEqual({ width: 400, height: 225 });
  });

  it('最小 320px', () => {
    expect(floatingSize({ width: 1000, height: 800, topInset: 56 }, 16 / 9)).toEqual({ width: 320, height: 180 });
  });

  it('視窗太窄時不超過視窗', () => {
    expect(floatingSize({ width: 300, height: 800, topInset: 56 }, 16 / 9).width).toBe(268);
  });

  it('直式影片太高時以高度為準', () => {
    const size = floatingSize({ width: 1600, height: 600, topInset: 56 }, 9 / 16);
    expect(size.height).toBe(600 - 56 - 32);
    expect(size.width).toBe(Math.round(size.height * (9 / 16)));
  });

  it('比例不合法時用 16:9', () => {
    expect(floatingSize(viewport, Number.NaN)).toEqual({ width: 400, height: 225 });
  });
});

describe('cornerRect', () => {
  it('四個角落，頂端避開標題列', () => {
    expect(cornerRect('bottom-right', viewport, 16 / 9)).toEqual({ left: 1184, top: 659, width: 400, height: 225 });
    expect(cornerRect('top-left', viewport, 16 / 9)).toEqual({ left: 16, top: 72, width: 400, height: 225 });
    expect(cornerRect('top-right', viewport, 16 / 9)).toMatchObject({ left: 1184, top: 72 });
    expect(cornerRect('bottom-left', viewport, 16 / 9)).toMatchObject({ left: 16, top: 659 });
  });
});

describe('nearestCorner（FR-41）', () => {
  const size = { width: 400, height: 225 };
  it('依中心點所在的象限貼齊', () => {
    expect(nearestCorner({ left: 100, top: 100, ...size }, viewport)).toBe('top-left');
    expect(nearestCorner({ left: 1000, top: 100, ...size }, viewport)).toBe('top-right');
    expect(nearestCorner({ left: 100, top: 600, ...size }, viewport)).toBe('bottom-left');
    expect(nearestCorner({ left: 1000, top: 600, ...size }, viewport)).toBe('bottom-right');
  });

  it('貼齊後的位置再算一次仍是同一個角落', () => {
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
      expect(nearestCorner(cornerRect(corner, viewport, 16 / 9), viewport)).toBe(corner);
    }
  });
});

describe('clampToViewport', () => {
  it('拖曳時不超出視窗，也不蓋到標題列', () => {
    expect(clampToViewport({ left: -50, top: 0, width: 400, height: 225 }, viewport)).toEqual({ left: 0, top: 56, width: 400, height: 225 });
    expect(clampToViewport({ left: 1500, top: 800, width: 400, height: 225 }, viewport)).toEqual({ left: 1200, top: 675, width: 400, height: 225 });
  });
});

describe('isCorner', () => {
  it('只接受四個角落', () => {
    expect(isCorner('top-left')).toBe(true);
    expect(isCorner('middle')).toBe(false);
    expect(isCorner(undefined)).toBe(false);
  });
});

describe('floatingReducer（FR-40、FR-42）', () => {
  const run = (events: FloatingEvent[], enabled = true) => events.reduce(floatingReducer, initialFloatingState(enabled));

  it('開啟後，播放器捲出畫面才浮動，捲回來就恢復', () => {
    expect(isFloating(run([]))).toBe(false);
    expect(isFloating(run([{ type: 'visibility', outOfView: true }]))).toBe(true);
    expect(isFloating(run([{ type: 'visibility', outOfView: true }, { type: 'visibility', outOfView: false }]))).toBe(false);
  });

  it('沒開啟時不浮動', () => {
    expect(isFloating(run([{ type: 'visibility', outOfView: true }], false))).toBe(false);
  });

  it('✕ 之後暫時不浮動，直到捲回原位再捲出去', () => {
    const dismissed = run([{ type: 'visibility', outOfView: true }, { type: 'dismiss' }]);
    expect(isFloating(dismissed)).toBe(false);
    expect(isFloating(floatingReducer(dismissed, { type: 'visibility', outOfView: true }))).toBe(false);
    const back = run([
      { type: 'visibility', outOfView: true },
      { type: 'dismiss' },
      { type: 'visibility', outOfView: false },
      { type: 'visibility', outOfView: true },
    ]);
    expect(isFloating(back)).toBe(true);
  });

  it('沒在浮動時 ✕ 沒有作用', () => {
    const s = run([]);
    expect(floatingReducer(s, { type: 'dismiss' })).toBe(s);
  });

  it('全螢幕時不浮動', () => {
    expect(isFloating(run([{ type: 'visibility', outOfView: true }, { type: 'fullscreen', fullscreen: true }]))).toBe(false);
  });

  it('換頁時清除暫時關閉', () => {
    const s = run([{ type: 'visibility', outOfView: true }, { type: 'dismiss' }, { type: 'navigate' }]);
    expect(isFloating(s)).toBe(true);
  });
});

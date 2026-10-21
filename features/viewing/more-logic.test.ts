import { describe, expect, it } from 'vitest';
import {
  PIXELS_PER_STEP,
  nextVolume,
  smartPauseStep,
  wheelSteps,
  type SmartPauseEvent,
  type SmartPauseState,
} from './more-logic';

describe('wheelSteps（FR-63）', () => {
  it('行／頁模式：每個事件一格，往上捲為正', () => {
    expect(wheelSteps({ pixels: 0 }, -3, 1).steps).toBe(1);
    expect(wheelSteps({ pixels: 0 }, 3, 1).steps).toBe(-1);
    expect(wheelSteps({ pixels: 0 }, -1, 2).steps).toBe(1);
  });

  it('像素模式：滑鼠滾輪的一格（100 或 120px）就是一格', () => {
    expect(wheelSteps({ pixels: 0 }, -100, 0)).toEqual({ acc: { pixels: 0 }, steps: 1 });
    expect(wheelSteps({ pixels: 0 }, 120, 0)).toEqual({ acc: { pixels: 0 }, steps: -1 });
  });

  it('觸控板的小量 deltaY 會累積', () => {
    let acc = { pixels: 0 };
    let total = 0;
    for (let i = 0; i < 25; i++) {
      const r = wheelSteps(acc, -10, 0);
      acc = r.acc;
      total += r.steps;
    }
    expect(total).toBe(2);
    expect(acc.pixels).toBe(-250 + 2 * PIXELS_PER_STEP);
  });

  it('換方向時重新累積', () => {
    const r1 = wheelSteps({ pixels: 0 }, -40, 0);
    expect(r1.steps).toBe(0);
    const r2 = wheelSteps(r1.acc, 30, 0);
    expect(r2).toEqual({ acc: { pixels: 30 }, steps: 0 });
  });

  it('deltaY 為 0 或不是數字時不動', () => {
    expect(wheelSteps({ pixels: 10 }, 0, 0)).toEqual({ acc: { pixels: 10 }, steps: 0 });
    expect(wheelSteps({ pixels: 10 }, Number.NaN, 0).steps).toBe(0);
  });
});

describe('nextVolume（FR-63）', () => {
  it('每格 5%', () => {
    expect(nextVolume(50, 1)).toBe(55);
    expect(nextVolume(50, -1)).toBe(45);
    expect(nextVolume(50, 3)).toBe(65);
  });

  it('不是 5 的倍數時先對齊格線', () => {
    expect(nextVolume(47, 1)).toBe(50);
    expect(nextVolume(47, -1)).toBe(45);
  });

  it('限制在 0–100', () => {
    expect(nextVolume(98, 1)).toBe(100);
    expect(nextVolume(100, 2)).toBe(100);
    expect(nextVolume(3, -1)).toBe(0);
    expect(nextVolume(0, -1)).toBe(0);
  });

  it('目前音量不合法時視為 0', () => {
    expect(nextVolume(Number.NaN, 1)).toBe(5);
  });
});

describe('smartPauseStep（FR-60）', () => {
  const run = (events: SmartPauseEvent[]) => {
    let state: SmartPauseState = { pausedByUs: false };
    const actions = [];
    for (const e of events) {
      const r = smartPauseStep(state, e);
      state = r.state;
      actions.push(r.action);
    }
    return { state, actions };
  };

  it('播放中切走時暫停，回來時繼續播放', () => {
    expect(run([{ type: 'hidden', playing: true }, { type: 'visible' }]).actions).toEqual(['pause', 'play']);
  });

  it('原本就暫停的影片，回來時不自動播放', () => {
    expect(run([{ type: 'hidden', playing: false }, { type: 'visible' }]).actions).toEqual([null, null]);
  });

  it('切走期間使用者自己操作播放，回來時不再自動播放', () => {
    expect(run([{ type: 'hidden', playing: true }, { type: 'userPlayback' }, { type: 'visible' }]).actions).toEqual([
      'pause',
      null,
      null,
    ]);
  });

  it('換影片後重設', () => {
    expect(run([{ type: 'hidden', playing: true }, { type: 'reset' }, { type: 'visible' }]).actions).toEqual(['pause', null, null]);
  });

  it('只恢復一次', () => {
    expect(run([{ type: 'hidden', playing: true }, { type: 'visible' }, { type: 'visible' }]).actions).toEqual([
      'pause',
      'play',
      null,
    ]);
  });
});

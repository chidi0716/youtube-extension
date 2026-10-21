import { describe, expect, it } from 'vitest';
import { END_MARGIN, initialLoopState, isValidLoopConfig, loopTick, startLoop, type LoopConfig, type LoopState } from './loop-logic';

/** 模擬依序播放到各個時間點，回傳每次的結果與最後狀態。 */
function play(config: LoopConfig, duration: number, times: number[], start: LoopState = startLoop()) {
  let state = start;
  const seeks: number[] = [];
  for (const t of times) {
    const step = loopTick(state, config, t, duration);
    state = step.state;
    if (step.seekTo !== undefined) seeks.push(step.seekTo);
  }
  return { state, seeks };
}

describe('isValidLoopConfig', () => {
  it('次數必須是 1–99 的整數或無限', () => {
    expect(isValidLoopConfig({ mode: 'repeat', times: 1 }, 60)).toBe(true);
    expect(isValidLoopConfig({ mode: 'repeat', times: 99 }, 60)).toBe(true);
    expect(isValidLoopConfig({ mode: 'repeat', times: null }, 60)).toBe(true);
    expect(isValidLoopConfig({ mode: 'repeat', times: 0 }, 60)).toBe(false);
    expect(isValidLoopConfig({ mode: 'repeat', times: 100 }, 60)).toBe(false);
    expect(isValidLoopConfig({ mode: 'repeat', times: 2.5 }, 60)).toBe(false);
  });

  it('片段的開始要早於結束且在影片長度內', () => {
    expect(isValidLoopConfig({ mode: 'segment', start: 10, end: 20 }, 60)).toBe(true);
    expect(isValidLoopConfig({ mode: 'segment', start: 20, end: 20 }, 60)).toBe(false);
    expect(isValidLoopConfig({ mode: 'segment', start: 10, end: 61 }, 60)).toBe(false);
    expect(isValidLoopConfig({ mode: 'segment', start: 10, end: 60 }, 59.5)).toBe(true);
  });
});

describe('loopTick：重複整部影片', () => {
  const duration = 30;
  const nearEnd = duration - END_MARGIN / 2;

  it('「3 次」：前兩次播完跳回開頭，第 3 次播完後停止', () => {
    const config: LoopConfig = { mode: 'repeat', times: 3 };
    const { state, seeks } = play(config, duration, [5, 20, nearEnd, 0.2, 5, 20, nearEnd, 0.1, 10, nearEnd, 29.9]);
    expect(seeks).toEqual([0, 0]);
    expect(state).toEqual({ running: false, played: 3, armed: true });
  });

  it('「1 次」：播完就停止，不跳轉', () => {
    const { state, seeks } = play({ mode: 'repeat', times: 1 }, duration, [10, nearEnd]);
    expect(seeks).toEqual([]);
    expect(state.running).toBe(false);
    expect(state.played).toBe(1);
  });

  it('無限：每次播完都跳回開頭', () => {
    const times = Array.from({ length: 10 }, () => [10, nearEnd, 0.2]).flat();
    const { state, seeks } = play({ mode: 'repeat', times: null }, duration, times);
    expect(seeks).toHaveLength(10);
    expect(state).toMatchObject({ running: true, played: 10 });
  });

  it('跳轉還沒生效前，同一個結尾不會被算兩次', () => {
    const { state, seeks } = play({ mode: 'repeat', times: null }, duration, [nearEnd, nearEnd, 29.9, nearEnd]);
    expect(seeks).toEqual([0]);
    expect(state.played).toBe(1);
  });

  it('timeupdate 沒趕上、影片已經結束時也會跳回開頭', () => {
    const step = loopTick(startLoop(), { mode: 'repeat', times: null }, 30, duration, true);
    expect(step.seekTo).toBe(0);
    expect(step.state.played).toBe(1);
  });
});

describe('loopTick：循環片段', () => {
  const config: LoopConfig = { mode: 'segment', start: 10, end: 20 };

  it('播到結束時間就跳回開始時間（00:10–00:20）', () => {
    const { state, seeks } = play(config, 60, [10, 15, 19.8, 20.1, 10.05, 15, 20.2, 10.1, 19, 20]);
    expect(seeks).toEqual([10, 10, 10]);
    expect(state).toMatchObject({ running: true, played: 3 });
  });

  it('一開始就在片段之後，會立刻跳回開始時間', () => {
    const { seeks } = play(config, 60, [45]);
    expect(seeks).toEqual([10]);
  });

  it('非常短的片段也能持續循環', () => {
    const short: LoopConfig = { mode: 'segment', start: 10, end: 11 };
    const { state, seeks } = play(short, 60, [11, 10, 10.5, 11.1, 10.02, 11]);
    expect(seeks).toEqual([10, 10, 10]);
    expect(state.played).toBe(3);
  });
});

describe('loopTick：停止時', () => {
  it('沒有在循環時不做任何事', () => {
    const s = initialLoopState();
    expect(loopTick(s, { mode: 'repeat', times: null }, 29.9, 30)).toEqual({ state: s });
  });

  it('影片長度未知時不做任何事', () => {
    const s = startLoop();
    expect(loopTick(s, { mode: 'repeat', times: null }, 0, Number.NaN)).toEqual({ state: s });
  });
});

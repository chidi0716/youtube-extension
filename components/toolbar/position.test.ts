import { describe, expect, it } from 'vitest';
import { maxPanelWidth, placePanel } from './position';

const bounds = { left: 100, right: 1100 }; // 播放器寬 1000

describe('placePanel（001 FR-11）', () => {
  it('放得下時左緣對齊按鈕', () => {
    expect(placePanel({ button: { left: 120, right: 160 }, panelWidth: 360, bounds })).toEqual({
      left: 120,
      align: 'start',
    });
  });

  it('剛好碰到播放器右緣仍然左對齊', () => {
    expect(placePanel({ button: { left: 740, right: 780 }, panelWidth: 360, bounds })).toEqual({
      left: 740,
      align: 'start',
    });
  });

  it('超出播放器右緣時改成右緣對齊按鈕', () => {
    expect(placePanel({ button: { left: 1000, right: 1040 }, panelWidth: 360, bounds })).toEqual({
      left: 680,
      align: 'end',
    });
  });

  it('右對齊後若超出播放器左緣，推回播放器範圍內', () => {
    expect(placePanel({ button: { left: 300, right: 340 }, panelWidth: 900, bounds })).toEqual({
      left: 100,
      align: 'end',
    });
  });
});

describe('maxPanelWidth', () => {
  it('等於播放器寬度，不為負', () => {
    expect(maxPanelWidth(bounds)).toBe(1000);
    expect(maxPanelWidth({ left: 10, right: 5 })).toBe(0);
  });
});

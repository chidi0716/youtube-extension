import { describe, expect, it } from 'vitest';
import { moveThumb, nearestThumb, percentOf, snap, valueForKey, valueFromPosition } from './range-math';

describe('snap', () => {
  it('對齊 step 並限制範圍', () => {
    expect(snap(4.4, 0, 10, 1)).toBe(4);
    expect(snap(4.6, 0, 10, 1)).toBe(5);
    expect(snap(-3, 0, 10, 1)).toBe(0);
    expect(snap(12, 0, 10, 1)).toBe(10);
    expect(snap(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
  });

  it('step 不合法時只限制範圍', () => {
    expect(snap(4.4, 0, 10, 0)).toBe(4.4);
  });
});

describe('valueFromPosition', () => {
  const track = { left: 100, width: 200 };
  it('換算指標位置', () => {
    expect(valueFromPosition(100, track, 0, 60, 1)).toBe(0);
    expect(valueFromPosition(200, track, 0, 60, 1)).toBe(30);
    expect(valueFromPosition(300, track, 0, 60, 1)).toBe(60);
  });
  it('超出軌道時夾在頭尾', () => {
    expect(valueFromPosition(0, track, 0, 60, 1)).toBe(0);
    expect(valueFromPosition(999, track, 0, 60, 1)).toBe(60);
  });
  it('軌道寬度為 0 或範圍為空時回傳 min', () => {
    expect(valueFromPosition(150, { left: 100, width: 0 }, 5, 60, 1)).toBe(5);
    expect(valueFromPosition(150, track, 5, 5, 1)).toBe(5);
  });
});

describe('percentOf', () => {
  it('換算百分比', () => {
    expect(percentOf(30, 0, 60)).toBe(50);
    expect(percentOf(90, 0, 60)).toBe(100);
    expect(percentOf(5, 5, 5)).toBe(0);
  });
});

describe('moveThumb', () => {
  it('開始不超過結束、結束不小於開始', () => {
    expect(moveThumb([10, 20], 0, 25, 0, 60, 1)).toEqual([20, 20]);
    expect(moveThumb([10, 20], 1, 5, 0, 60, 1)).toEqual([10, 10]);
    expect(moveThumb([10, 20], 0, 3, 0, 60, 1)).toEqual([3, 20]);
    expect(moveThumb([10, 20], 1, 70, 0, 60, 1)).toEqual([10, 60]);
  });
});

describe('nearestThumb', () => {
  it('選離點擊位置比較近的把手', () => {
    expect(nearestThumb([10, 50], 20)).toBe(0);
    expect(nearestThumb([10, 50], 40)).toBe(1);
  });
  it('把手重疊時依點擊方向決定', () => {
    expect(nearestThumb([30, 30], 40)).toBe(1);
    expect(nearestThumb([30, 30], 20)).toBe(0);
  });
});

describe('valueForKey', () => {
  it('依 WAI-ARIA slider 的按鍵移動', () => {
    expect(valueForKey('ArrowRight', 10, 0, 60, 1)).toBe(11);
    expect(valueForKey('ArrowLeft', 10, 0, 60, 1)).toBe(9);
    expect(valueForKey('ArrowUp', 60, 0, 60, 1)).toBe(60);
    expect(valueForKey('PageUp', 10, 0, 60, 1)).toBe(20);
    expect(valueForKey('PageDown', 5, 0, 60, 1)).toBe(0);
    expect(valueForKey('Home', 10, 0, 60, 1)).toBe(0);
    expect(valueForKey('End', 10, 0, 60, 1)).toBe(60);
    expect(valueForKey('a', 10, 0, 60, 1)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { USER_CHANGE_WINDOW_MS, decideThemeChange } from './theme-logic';

describe('decideThemeChange（FR-12）', () => {
  const now = 100_000;
  it('使用者剛操作過：視為從 YouTube 選單切換，記住新的主題', () => {
    expect(decideThemeChange(true, false, now, now - 1000)).toBe('remember');
    expect(decideThemeChange(null, true, now, now - USER_CHANGE_WINDOW_MS)).toBe('remember');
  });

  it('沒有使用者操作且與記住的主題不同：重新套用', () => {
    expect(decideThemeChange(true, false, now, null)).toBe('reapply');
    expect(decideThemeChange(false, true, now, now - USER_CHANGE_WINDOW_MS - 1)).toBe('reapply');
  });

  it('沒有記住的主題或與記住的相同：只更新按鈕', () => {
    expect(decideThemeChange(null, true, now, null)).toBe('follow');
    expect(decideThemeChange(true, true, now, null)).toBe('follow');
  });
});

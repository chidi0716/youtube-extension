// 深色模式即時切換（T06b）的純邏輯測試。測試資料依 specs/notes/T06b-dark-mode-instant.md 的實測結果。
import { describe, expect, it } from 'vitest';
import { THEME_ATTRIBUTE_NAMES, themeAttributeChanges, themeRuleKind } from '@/utils/youtube/dom';
import {
  htmlThemeChangedByOthers,
  parseCssColor,
  pinnedVariableOverrides,
  prefFixDecision,
  prefNeedingFix,
  themeOfColor,
} from './theme-logic';

describe('themeAttributeChanges', () => {
  it('深色：<html dark>、移除 light，元素上的主題屬性都存在', () => {
    const changes = themeAttributeChanges('dark');
    expect(changes).toContainEqual({ selector: null, attribute: 'dark', present: true });
    expect(changes).toContainEqual({ selector: null, attribute: 'light', present: false });
    expect(changes).toContainEqual({ selector: 'ytd-masthead', attribute: 'dark', present: true });
    expect(changes).toContainEqual({ selector: 'ytd-masthead', attribute: 'page-dark-theme', present: true });
    expect(changes).toContainEqual({ selector: 'ytd-watch-flexy', attribute: 'is-dark-theme', present: true });
    expect(changes).toContainEqual({ selector: 'ytd-playlist-panel-renderer', attribute: 'is-dark-theme', present: true });
    expect(changes).toContainEqual({ selector: 'ytd-feed-nudge-renderer', attribute: 'is-dark-mode', present: true });
  });

  it('淺色：移除 dark、加上 <html light>（以深色載入的頁面需要），元素上的主題屬性都移除', () => {
    const changes = themeAttributeChanges('light');
    expect(changes).toContainEqual({ selector: null, attribute: 'dark', present: false });
    expect(changes).toContainEqual({ selector: null, attribute: 'light', present: true });
    expect(changes.filter((c) => c.selector !== null).every((c) => !c.present)).toBe(true);
  });

  it('深色與淺色涵蓋相同的屬性，attributeFilter 不重複', () => {
    const key = (c: { selector: string | null; attribute: string }) => `${c.selector}|${c.attribute}`;
    expect(themeAttributeChanges('dark').map(key)).toEqual(themeAttributeChanges('light').map(key));
    expect(new Set(THEME_ATTRIBUTE_NAMES).size).toBe(THEME_ATTRIBUTE_NAMES.length);
    expect([...THEME_ATTRIBUTE_NAMES].sort()).toEqual(['dark', 'is-dark-mode', 'is-dark-theme', 'light', 'page-dark-theme']);
  });
});

describe('parseCssColor／themeOfColor', () => {
  it('解析 getComputedStyle 的 rgb()／rgba()', () => {
    expect(parseCssColor('rgb(15, 15, 15)')).toEqual({ r: 15, g: 15, b: 15, a: 1 });
    expect(parseCssColor('rgba(255, 255, 255, 0.9)')).toEqual({ r: 255, g: 255, b: 255, a: 0.9 });
    expect(parseCssColor('rgb(15 15 15 / 50%)')).toEqual({ r: 15, g: 15, b: 15, a: 0.5 });
    expect(parseCssColor('#fff')).toBeNull();
    expect(parseCssColor('transparent')).toBeNull();
  });

  it('YouTube 的深色與淺色背景', () => {
    expect(themeOfColor('rgb(15, 15, 15)')).toBe('dark'); // #0f0f0f
    expect(themeOfColor('rgba(15, 15, 15, 0.8)')).toBe('dark'); // 深色頂端列
    expect(themeOfColor('rgb(40, 40, 40)')).toBe('dark'); // 深色選單
    expect(themeOfColor('rgb(255, 255, 255)')).toBe('light');
    expect(themeOfColor('rgb(249, 249, 249)')).toBe('light');
  });

  it('透明或無法解析時無法判斷', () => {
    expect(themeOfColor('rgba(0, 0, 0, 0)')).toBeNull();
    expect(themeOfColor('transparent')).toBeNull();
    expect(themeOfColor(null)).toBeNull();
  });
});

describe('prefNeedingFix', () => {
  it('主題偏好已經相同時不需修正', () => {
    expect(prefNeedingFix('f6=400&tz=UTC', 'dark')).toBeNull();
    expect(prefNeedingFix('f5=30000&f6=80008&hl=en', 'light')).toBeNull();
  });

  it('YouTube 以舊的偏好改寫 PREF 時（實測：f6 被改回、另外加上 f7），只改回主題旗標並保留新欄位', () => {
    expect(prefNeedingFix('f6=80000&tz=UTC&f7=100', 'dark')).toBe('f6=400&tz=UTC&f7=100');
    expect(prefNeedingFix('tz=UTC&f7=100', 'dark')).toBe('tz=UTC&f7=100&f6=400');
    expect(prefNeedingFix('f6=408&hl=en', 'light')).toBe('f6=80008&hl=en');
  });

  it('沒有 PREF 時加上主題旗標；f6 格式不對時不修改', () => {
    expect(prefNeedingFix(null, 'light')).toBe('f6=80000');
    expect(prefNeedingFix('f6=xyz', 'dark')).toBeNull();
  });
});

describe('htmlThemeChangedByOthers', () => {
  it('維持深色時，dark 被移除表示 YouTube 自己切換了主題', () => {
    expect(htmlThemeChangedByOthers('dark', true)).toBe(false);
    expect(htmlThemeChangedByOthers('dark', false)).toBe(true);
  });

  it('維持淺色時，被加上 dark 表示 YouTube 自己切換了主題', () => {
    expect(htmlThemeChangedByOthers('light', false)).toBe(false);
    expect(htmlThemeChangedByOthers('light', true)).toBe(true);
  });
});

describe('prefFixDecision', () => {
  it('相同時重設', () => {
    expect(prefFixDecision(false, 1000, 5000, 1000)).toEqual({ since: null, fix: false });
  });

  it('第一次發現不同時只記下時間', () => {
    expect(prefFixDecision(true, null, 5000, 1000)).toEqual({ since: 5000, fix: false });
  });

  it('寬限期內不修正，超過才修正', () => {
    expect(prefFixDecision(true, 5000, 5500, 1000)).toEqual({ since: 5000, fix: false });
    expect(prefFixDecision(true, 5000, 6000, 1000)).toEqual({ since: null, fix: true });
  });
});

describe('themeRuleKind', () => {
  it('依選擇器分出固定值、深色、淺色三組主題變數（實測的 YouTube 選擇器）', () => {
    expect(themeRuleKind(':root:root')).toBe('pinned');
    expect(themeRuleKind('[dark]')).toBe('dark');
    expect(themeRuleKind('[dark], html[dark]')).toBe('dark');
    expect(themeRuleKind('[light], html')).toBe('light');
    expect(themeRuleKind('[color-version="v2_0"] [dark], html[color-version="v2_0"][dark]')).toBeNull();
    expect(themeRuleKind(':root')).toBeNull();
    expect(themeRuleKind(':root:root:root')).toBeNull(); // 擴充功能自己的覆寫
    expect(themeRuleKind('ytd-masthead[dark]')).toBeNull();
  });
});

describe('pinnedVariableOverrides', () => {
  // 以淺色載入的首頁實測值（spikes/T06b/results-pinned-vars.txt）
  const vars = {
    pinned: new Set(['--tf3fc855af2285f5f', '--t87eabf113a15ac96', '--t6216186c28b3834b']),
    dark: new Map([
      ['--tf3fc855af2285f5f', 'rgba(255,255,255,0.2)'],
      ['--t6216186c28b3834b', '#0f0f0f'],
      ['--unrelated', '#123'],
    ]),
    light: new Map([
      ['--tf3fc855af2285f5f', 'rgba(0,0,0,0.1)'],
      ['--t87eabf113a15ac96', '#e6e6e6'],
      ['--t6216186c28b3834b', '#fff'],
    ]),
  };

  it('切到深色時取 [dark] 的值；樣式表沒有深色值的變數不覆寫', () => {
    expect(pinnedVariableOverrides(vars, 'dark')).toEqual([
      ['--tf3fc855af2285f5f', 'rgba(255,255,255,0.2)'],
      ['--t6216186c28b3834b', '#0f0f0f'],
    ]);
  });

  it('切到淺色時取 [light] 的值；只覆寫被固定的變數', () => {
    expect(pinnedVariableOverrides(vars, 'light')).toEqual([
      ['--tf3fc855af2285f5f', 'rgba(0,0,0,0.1)'],
      ['--t87eabf113a15ac96', '#e6e6e6'],
      ['--t6216186c28b3834b', '#fff'],
    ]);
  });
});

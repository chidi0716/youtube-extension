import { describe, expect, it } from 'vitest';
import { resolvePageTheme } from './page-theme';

describe('resolvePageTheme（007 FR-20、FR-21）', () => {
  it('深色、淺色不受 YouTube 與系統影響', () => {
    for (const last of ['dark', 'light', null]) {
      for (const system of [true, false]) {
        expect(resolvePageTheme('dark', last, system)).toBe('dark');
        expect(resolvePageTheme('light', last, system)).toBe('light');
      }
    }
  });
  it('跟隨 YouTube：使用最近一次的 YouTube 主題；沒有紀錄時依系統', () => {
    expect(resolvePageTheme('youtube', 'dark', false)).toBe('dark');
    expect(resolvePageTheme('youtube', 'light', true)).toBe('light');
    expect(resolvePageTheme('youtube', null, true)).toBe('dark');
    expect(resolvePageTheme('youtube', 'garbage', false)).toBe('light');
  });
  it('跟隨系統：不看 YouTube 的紀錄', () => {
    expect(resolvePageTheme('system', 'dark', false)).toBe('light');
    expect(resolvePageTheme('system', 'light', true)).toBe('dark');
  });
  it('設定不認得時與「跟隨 YouTube」相同（預設值）', () => {
    expect(resolvePageTheme(undefined, 'dark', false)).toBe('dark');
    expect(resolvePageTheme('weird', null, true)).toBe('dark');
  });
});

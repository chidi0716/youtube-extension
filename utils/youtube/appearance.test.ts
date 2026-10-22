// YouTube 外觀選項的辨識（T06d）：依選項 data 中的動作代號，不依顯示文字或順序。
// 測試資料依 specs/notes/T06d-dark-mode-menu.md 的實測（英文與繁體中文介面相同）。
import { describe, expect, it } from 'vitest';
import { themeOptionOf } from './dom';

const option = (signal: unknown, title = 'Dark theme') => ({
  title: { runs: [{ text: title }] },
  style: 'COMPACT_LINK_STYLE_TYPE_SELECTION_MENU',
  serviceEndpoint: {
    commandMetadata: { webCommandMetadata: { sendPost: true } },
    signalServiceEndpoint: { signal: 'CLIENT_SIGNAL', actions: [{ clickTrackingParams: 'x', signalAction: { signal } }] },
  },
});

describe('themeOptionOf', () => {
  it('依動作代號分出深色與淺色選項', () => {
    expect(themeOptionOf(option('TOGGLE_DARK_THEME_ON'))).toBe('dark');
    expect(themeOptionOf(option('TOGGLE_DARK_THEME_OFF'))).toBe('light');
  });

  it('不看顯示文字（介面語言會變）', () => {
    expect(themeOptionOf(option('TOGGLE_DARK_THEME_ON', '深色主題'))).toBe('dark');
    expect(themeOptionOf(option('TOGGLE_DARK_THEME_OFF', 'Dark theme'))).toBe('light');
  });

  it('其他選項（例如使用裝置主題、其他選單項目）或格式不對時回傳 null', () => {
    expect(themeOptionOf(option('TOGGLE_DARK_THEME_DEVICE'))).toBeNull();
    expect(themeOptionOf(option(42))).toBeNull();
    expect(themeOptionOf({ serviceEndpoint: { signalServiceEndpoint: { actions: 'x' } } })).toBeNull();
    expect(themeOptionOf({ title: { runs: [{ text: 'Dark theme' }] } })).toBeNull();
    expect(themeOptionOf(null)).toBeNull();
    expect(themeOptionOf('TOGGLE_DARK_THEME_ON')).toBeNull();
  });

  it('不會被原型上的同名欄位騙過', () => {
    expect(themeOptionOf(option('toString'))).toBeNull();
    expect(themeOptionOf(option('__proto__'))).toBeNull();
  });
});

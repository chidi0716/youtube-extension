// YouTube 主題偏好（PREF cookie）的解析與修改（003 FR-10 至 FR-13、T06a）。
// 測試資料依 specs/notes/T06a-dark-mode.md 的實測結果。
import { describe, expect, it } from 'vitest';
import {
  parsePref,
  prefCookieString,
  readPrefCookie,
  readThemePreference,
  serializePref,
  urlWithTime,
  withThemePreference,
} from './dom';

describe('readPrefCookie', () => {
  it('從 document.cookie 取出 PREF 的值', () => {
    expect(readPrefCookie('YSC=abc; PREF=f6=400&hl=en; VISITOR_INFO1_LIVE=x')).toBe('f6=400&hl=en');
    expect(readPrefCookie('PREF=tz=Asia%2FTaipei')).toBe('tz=Asia%2FTaipei');
  });

  it('沒有 PREF 時回傳 null，不會誤認名稱相近的 cookie', () => {
    expect(readPrefCookie('YSC=abc; XPREF=f6=400')).toBeNull();
    expect(readPrefCookie('')).toBeNull();
  });
});

describe('parsePref／serializePref', () => {
  it('保持欄位順序與原始文字', () => {
    const value = 'f5=30000&f6=8&hl=en&tz=Asia%2FTaipei&flag';
    expect(parsePref(value)).toEqual([
      ['f5', '30000'],
      ['f6', '8'],
      ['hl', 'en'],
      ['tz', 'Asia%2FTaipei'],
      ['flag', ''],
    ]);
    expect(serializePref(parsePref('f5=30000&f6=8&hl=en&tz=Asia%2FTaipei'))).toBe('f5=30000&f6=8&hl=en&tz=Asia%2FTaipei');
  });

  it('空值', () => {
    expect(parsePref(null)).toEqual([]);
    expect(parsePref('')).toEqual([]);
  });
});

describe('readThemePreference', () => {
  it('f6 的 0x400 為深色、0x80000 為淺色（實測：選單選擇後的值）', () => {
    expect(readThemePreference('tz=UTC&f6=400')).toBe('dark');
    expect(readThemePreference('tz=UTC&f6=80000')).toBe('light');
    expect(readThemePreference('f5=30000&f6=408&hl=en')).toBe('dark');
    expect(readThemePreference('f5=30000&f6=80008&hl=en')).toBe('light');
  });

  it('沒有主題位元時視為沒有明確設定（使用 YouTube 預設或裝置主題）', () => {
    expect(readThemePreference(null)).toBe('device');
    expect(readThemePreference('tz=UTC')).toBe('device');
    expect(readThemePreference('f6=8')).toBe('device');
  });

  it('f6 格式不對時視為沒有明確設定', () => {
    expect(readThemePreference('f6=xyz')).toBe('device');
  });
});

describe('withThemePreference', () => {
  it('切換成深色：設定 0x400、清除 0x80000，其他位元與欄位保留', () => {
    expect(withThemePreference('f5=30000&f6=80008&hl=en&gl=US&tz=UTC', 'dark')).toBe('f5=30000&f6=408&hl=en&gl=US&tz=UTC');
  });

  it('切換成淺色：設定 0x80000、清除 0x400，其他位元與欄位保留', () => {
    expect(withThemePreference('f5=30000&f6=408&hl=en&gl=US&tz=UTC', 'light')).toBe('f5=30000&f6=80008&hl=en&gl=US&tz=UTC');
  });

  it('原本沒有 f6（使用預設或裝置主題）時加在最後，與 YouTube 選單的結果相同', () => {
    expect(withThemePreference('tz=UTC', 'dark')).toBe('tz=UTC&f6=400');
    expect(withThemePreference('tz=UTC', 'light')).toBe('tz=UTC&f6=80000');
  });

  it('沒有 PREF 時只寫入主題欄位', () => {
    expect(withThemePreference(null, 'dark')).toBe('f6=400');
    expect(withThemePreference('', 'light')).toBe('f6=80000');
  });

  it('其他未知的位元也原樣保留（含最高位元）', () => {
    expect(withThemePreference('f6=40000008', 'dark')).toBe('f6=40000408');
    expect(withThemePreference('f6=80000008', 'dark')).toBe('f6=80000408');
    expect(readThemePreference(withThemePreference('f6=40000408', 'light'))).toBe('light');
  });

  it('不碰其他欄位中的編碼文字', () => {
    expect(withThemePreference('tz=Asia%2FTaipei&f6=400&hl=zh-TW', 'light')).toBe('tz=Asia%2FTaipei&f6=80000&hl=zh-TW');
  });

  it('f6 格式不對時回傳 null，不修改', () => {
    expect(withThemePreference('f6=not-hex&hl=en', 'dark')).toBeNull();
  });
});

describe('prefCookieString', () => {
  it('屬性與 YouTube 自己設定的相同', () => {
    expect(prefCookieString('f6=400&hl=en')).toBe('PREF=f6=400&hl=en; domain=.youtube.com; path=/; max-age=34560000; secure; samesite=lax');
  });
});

describe('urlWithTime', () => {
  it('觀看頁加上目前時間點（秒，捨去小數），保留其他參數', () => {
    expect(urlWithTime('https://www.youtube.com/watch?v=jNQXAC9IVRw&list=PL1', 83.9)).toBe(
      'https://www.youtube.com/watch?v=jNQXAC9IVRw&list=PL1&t=83s',
    );
  });

  it('取代原有的 t 參數；不到 1 秒時移除 t', () => {
    expect(urlWithTime('https://www.youtube.com/watch?v=jNQXAC9IVRw&t=120s', 10)).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw&t=10s');
    expect(urlWithTime('https://www.youtube.com/watch?v=jNQXAC9IVRw&t=120s', 0.4)).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  });

  it('不是觀看頁或時間未知時不改網址', () => {
    expect(urlWithTime('https://www.youtube.com/results?search_query=a', 30)).toBe('https://www.youtube.com/results?search_query=a');
    expect(urlWithTime('https://www.youtube.com/watch?v=jNQXAC9IVRw', null)).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    expect(urlWithTime('https://www.youtube.com/watch?v=jNQXAC9IVRw', Number.NaN)).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  });
});

import { describe, expect, it } from 'vitest';
import {
  MAX_TITLE_LENGTH,
  baseFilename,
  captionFilename,
  sanitizeFilename,
  screenshotFilename,
  thumbnailFilename,
  timeTag,
} from './filename';

describe('sanitizeFilename（002 FR-8）', () => {
  it('移除作業系統不允許的字元與路徑分隔字元', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a b c d e f g h i j');
    expect(sanitizeFilename('../../etc/passwd')).toBe('etc passwd');
    expect(sanitizeFilename('..\\..\\win.ini')).toBe('win.ini');
  });

  it('控制字元與換行改成空白，連續空白合併', () => {
    expect(sanitizeFilename('Line1\nLine2\t\tEnd\u0000')).toBe('Line1 Line2 End');
  });

  it('去掉前後的空白與點', () => {
    expect(sanitizeFilename('  ...hidden. ')).toBe('hidden');
  });

  it('保留中文、日文與表情符號', () => {
    expect(sanitizeFilename('台北 101｜跨年煙火 🎆')).toBe('台北 101｜跨年煙火 🎆');
  });

  it('Windows 保留名稱前面加底線', () => {
    expect(sanitizeFilename('CON')).toBe('_CON');
    expect(sanitizeFilename('lpt1.txt')).toBe('_lpt1.txt');
    expect(sanitizeFilename('Console')).toBe('Console');
  });

  it('過長時截斷', () => {
    expect(Array.from(sanitizeFilename('長'.repeat(400)))).toHaveLength(MAX_TITLE_LENGTH);
  });

  it('結果為空時使用預設名稱', () => {
    expect(sanitizeFilename('///')).toBe('video');
    expect(sanitizeFilename('', 'x')).toBe('x');
  });
});

describe('檔名格式', () => {
  it('基本格式為「影片標題 [影片ID]」；沒有標題時只用 ID', () => {
    expect(baseFilename('Me at the zoo', 'jNQXAC9IVRw')).toBe('Me at the zoo [jNQXAC9IVRw]');
    expect(baseFilename('  ', 'jNQXAC9IVRw')).toBe('[jNQXAC9IVRw]');
  });

  it('時間點：不到一小時為 01m02s，一小時以上加上小時', () => {
    expect(timeTag(62.9)).toBe('01m02s');
    expect(timeTag(0)).toBe('00m00s');
    expect(timeTag(3723)).toBe('01h02m03s');
    expect(timeTag(Number.NaN)).toBe('00m00s');
  });

  it('截圖檔名為「標題 [ID] 01m02s.png」（002 FR-51）', () => {
    expect(screenshotFilename('標題', 'ID123456789', 62)).toBe('標題 [ID123456789] 01m02s.png');
    expect(screenshotFilename('a/b', 'ID123456789', 5)).toBe('a b [ID123456789] 00m05s.png');
  });

  it('縮圖檔名為「標題 [ID].jpg」', () => {
    expect(thumbnailFilename('Me at the zoo', 'jNQXAC9IVRw', 'jpg')).toBe('Me at the zoo [jNQXAC9IVRw].jpg');
  });

  it('字幕檔名加上語言代碼', () => {
    expect(captionFilename('Talk', 'jNQXAC9IVRw', 'zh-TW', 'srt')).toBe('Talk [jNQXAC9IVRw].zh-TW.srt');
    expect(captionFilename('Talk', 'jNQXAC9IVRw', '../x', 'txt')).toBe('Talk [jNQXAC9IVRw].x.txt');
  });
});

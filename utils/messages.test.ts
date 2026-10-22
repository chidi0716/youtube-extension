import { describe, expect, it } from 'vitest';
import { isContentMessage } from './messages';

describe('isContentMessage', () => {
  it('接受已定義的訊息', () => {
    expect(isContentMessage({ type: 'openOptions' })).toBe(true);
  });

  it('拒絕其他內容', () => {
    for (const value of [null, undefined, 'openOptions', 1, {}, { type: 'eval' }, { type: ['openOptions'] }]) {
      expect(isContentMessage(value), JSON.stringify(value)).toBe(false);
    }
  });
});

describe('下載相關的訊息（階段 4a）', () => {
  const ID = 'jNQXAC9IVRw';
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const caption = { type: 'downloadCaption', videoId: ID, title: 'T', languageCode: 'en', url: 'https://www.youtube.com/api/timedtext?v=x', format: 'srt' };

  it('接受合法的縮圖、截圖、字幕訊息', () => {
    expect(isContentMessage({ type: 'getThumbnails', videoId: ID })).toBe(true);
    expect(isContentMessage({ type: 'downloadThumbnail', videoId: ID, title: 'T', key: 'maxresdefault' })).toBe(true);
    expect(isContentMessage({ type: 'saveScreenshot', videoId: ID, title: '標題', seconds: 62.5, dataUrl: PNG })).toBe(true);
    expect(isContentMessage(caption)).toBe(true);
    expect(isContentMessage({ ...caption, format: 'txt', languageCode: 'zh-TW' })).toBe(true);
  });

  it('拒絕不合法的影片 ID 與縮圖尺寸（縮圖網址由背景腳本組出，不接受任意網址）', () => {
    expect(isContentMessage({ type: 'getThumbnails', videoId: '../../x' })).toBe(false);
    expect(isContentMessage({ type: 'downloadThumbnail', videoId: ID, title: 'T', key: 'https://evil.example/a.jpg' })).toBe(false);
    expect(isContentMessage({ type: 'downloadThumbnail', videoId: ID, title: 'T', key: 'default' })).toBe(false);
    expect(isContentMessage({ type: 'downloadThumbnail', videoId: ID, title: 'x'.repeat(501), key: 'hqdefault' })).toBe(false);
  });

  it('截圖只接受 PNG 的 data URL', () => {
    for (const dataUrl of ['https://evil.example/a.png', 'data:text/html;base64,PGgxPg==', 'data:image/png;base64,<script>', 'javascript:1']) {
      expect(isContentMessage({ type: 'saveScreenshot', videoId: ID, title: 'T', seconds: 1, dataUrl }), dataUrl).toBe(false);
    }
    expect(isContentMessage({ type: 'saveScreenshot', videoId: ID, title: 'T', seconds: -1, dataUrl: PNG })).toBe(false);
    expect(isContentMessage({ type: 'saveScreenshot', videoId: ID, title: 'T', seconds: Number.NaN, dataUrl: PNG })).toBe(false);
  });

  it('字幕網址必須是 https 的 youtube.com，格式與語言代碼必須合法', () => {
    for (const url of ['https://evil.example/api/timedtext', 'http://www.youtube.com/api/timedtext', 'https://youtube.com.evil.example/', 'file:///etc/passwd']) {
      expect(isContentMessage({ ...caption, url }), url).toBe(false);
    }
    expect(isContentMessage({ ...caption, format: 'exe' })).toBe(false);
    expect(isContentMessage({ ...caption, languageCode: '../en' })).toBe(false);
  });
});

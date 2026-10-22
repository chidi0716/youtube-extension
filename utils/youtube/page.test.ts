import { describe, expect, it } from 'vitest';
import { getPageType, getShortsVideoId, getVideoId, isValidVideoId, isWatchPage, watchUrlForShorts } from './page';

describe('getPageType', () => {
  it.each([
    ['https://www.youtube.com/watch?v=jNQXAC9IVRw', 'watch'],
    ['https://www.youtube.com/shorts/abcdefghijk', 'shorts'],
    ['https://www.youtube.com/embed/jNQXAC9IVRw', 'embed'],
    ['https://www.youtube.com/', 'home'],
    ['https://www.youtube.com/results?search_query=cat', 'search'],
    ['https://www.youtube.com/@jawed', 'channel'],
    ['https://www.youtube.com/@jawed/videos', 'channel'],
    ['https://www.youtube.com/channel/UC4QobU6STFB0P71PMvOGN5A', 'channel'],
    ['https://www.youtube.com/c/Example', 'channel'],
    ['https://www.youtube.com/user/Example', 'channel'],
    ['https://www.youtube.com/feed/subscriptions', 'other'],
    ['https://www.youtube.com/watch/extra', 'other'],
    ['not a url', 'other'],
  ])('%s → %s', (url, type) => {
    expect(getPageType(url)).toBe(type);
  });
});

describe('getVideoId', () => {
  it('讀出觀看頁的影片 ID', () => {
    expect(getVideoId('https://www.youtube.com/watch?v=jNQXAC9IVRw&t=10s')).toBe('jNQXAC9IVRw');
    expect(getVideoId('https://www.youtube.com/watch?list=PL1&v=a-b_c1D2e3F')).toBe('a-b_c1D2e3F');
  });

  it('沒有或不合法的 ID 回傳 null', () => {
    expect(getVideoId('https://www.youtube.com/watch')).toBeNull();
    expect(getVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(getVideoId('https://www.youtube.com/watch?v=jNQXAC9IVRw1')).toBeNull();
    expect(getVideoId('https://www.youtube.com/watch?v=jNQXAC9IV%3Cw')).toBeNull();
  });

  it('不是觀看頁時回傳 null', () => {
    expect(getVideoId('https://www.youtube.com/shorts/jNQXAC9IVRw')).toBeNull();
    expect(getVideoId('https://www.youtube.com/embed/jNQXAC9IVRw?v=jNQXAC9IVRw')).toBeNull();
  });
});

describe('isValidVideoId', () => {
  it('只接受 11 碼英數字、- 與 _', () => {
    expect(isValidVideoId('jNQXAC9IVRw')).toBe(true);
    expect(isValidVideoId('___________')).toBe(true);
    expect(isValidVideoId('jNQXAC9IVR')).toBe(false);
    expect(isValidVideoId('jNQXAC9IVR!')).toBe(false);
    expect(isValidVideoId(12345678901)).toBe(false);
  });
});

describe('isWatchPage（001 FR-1）', () => {
  it('www.youtube.com 與 youtube.com 的觀看頁', () => {
    expect(isWatchPage('https://www.youtube.com/watch?v=jNQXAC9IVRw')).toBe(true);
    expect(isWatchPage('https://youtube.com/watch?v=jNQXAC9IVRw')).toBe(true);
  });

  it('首頁、搜尋、頻道、Shorts、內嵌播放器都不是', () => {
    for (const url of [
      'https://www.youtube.com/',
      'https://www.youtube.com/results?search_query=x',
      'https://www.youtube.com/@jawed',
      'https://www.youtube.com/shorts/jNQXAC9IVRw',
      'https://www.youtube.com/embed/jNQXAC9IVRw',
      'https://www.youtube.com/watch',
    ]) {
      expect(isWatchPage(url), url).toBe(false);
    }
  });

  it('版面不同的子網域不處理', () => {
    expect(isWatchPage('https://m.youtube.com/watch?v=jNQXAC9IVRw')).toBe(false);
    expect(isWatchPage('https://music.youtube.com/watch?v=jNQXAC9IVRw')).toBe(false);
  });
});

describe('watchUrlForShorts（005 FR-50）', () => {
  it('Shorts 網址轉成同一部影片的一般觀看頁', () => {
    expect(watchUrlForShorts('https://www.youtube.com/shorts/jNQXAC9IVRw')).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    expect(watchUrlForShorts('https://youtube.com/shorts/jNQXAC9IVRw/')).toBe('https://youtube.com/watch?v=jNQXAC9IVRw');
    expect(watchUrlForShorts('https://www.youtube.com/shorts/jNQXAC9IVRw?feature=share&si=abc')).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    expect(getShortsVideoId('https://www.youtube.com/shorts/jNQXAC9IVRw')).toBe('jNQXAC9IVRw');
  });

  it('不是 Shorts 影片網址時不轉換（避免循環：觀看頁永遠不會再被轉換）', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      'https://www.youtube.com/shorts/',
      'https://www.youtube.com/shorts',
      'https://www.youtube.com/shorts/short',
      'https://www.youtube.com/shorts/jNQXAC9IVRw/extra',
      'https://www.youtube.com/@channel/shorts',
      'not a url',
    ]) {
      expect(watchUrlForShorts(url), url).toBeNull();
    }
  });

  it('只處理 www.youtube.com 與 youtube.com（005 FR-5）', () => {
    expect(watchUrlForShorts('https://m.youtube.com/shorts/jNQXAC9IVRw')).toBeNull();
    expect(watchUrlForShorts('https://music.youtube.com/shorts/jNQXAC9IVRw')).toBeNull();
  });

  it('轉換結果一定是觀看頁', () => {
    const url = watchUrlForShorts('https://www.youtube.com/shorts/jNQXAC9IVRw')!;
    expect(isWatchPage(url)).toBe(true);
    expect(watchUrlForShorts(url)).toBeNull();
  });
});

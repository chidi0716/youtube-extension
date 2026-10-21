import { describe, expect, it } from 'vitest';
import { escapeMarkdownText, linkText, markdownLink, middleEllipsis, shortLink, wholeSeconds } from './link-logic';

const ID = 'jNQXAC9IVRw';

describe('shortLink（004 FR-31、FR-33、FR-35）', () => {
  it('目前時間的連結：youtu.be 短網址加上無條件捨去的秒數', () => {
    expect(shortLink(ID, 83)).toBe('https://youtu.be/jNQXAC9IVRw?t=83');
    expect(shortLink(ID, 83.99)).toBe('https://youtu.be/jNQXAC9IVRw?t=83');
    expect(shortLink(ID, 3725.2)).toBe('https://youtu.be/jNQXAC9IVRw?t=3725');
  });

  it('0 秒（或不到 1 秒）時不加 ?t=0，與不含時間的連結相同', () => {
    expect(shortLink(ID, 0)).toBe('https://youtu.be/jNQXAC9IVRw');
    expect(shortLink(ID, 0.7)).toBe('https://youtu.be/jNQXAC9IVRw');
    expect(shortLink(ID)).toBe('https://youtu.be/jNQXAC9IVRw');
  });

  it('不合法的時間視為 0', () => {
    expect(shortLink(ID, Number.NaN)).toBe('https://youtu.be/jNQXAC9IVRw');
    expect(shortLink(ID, -5)).toBe('https://youtu.be/jNQXAC9IVRw');
    expect(wholeSeconds(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('markdownLink（004 FR-31）', () => {
  it('播放到 83 秒時為 [標題（01:23）](https://youtu.be/ID?t=83)', () => {
    expect(markdownLink('標題', 'ID12345678a', 83)).toBe('[標題（01:23）](https://youtu.be/ID12345678a?t=83)');
  });

  it('一小時以上時為 時:分:秒', () => {
    expect(markdownLink('Long talk', ID, 3725)).toBe('[Long talk（01:02:05）](https://youtu.be/jNQXAC9IVRw?t=3725)');
  });

  it('0 秒時連結不帶時間', () => {
    expect(markdownLink('Me at the zoo', ID, 0)).toBe('[Me at the zoo（00:00）](https://youtu.be/jNQXAC9IVRw)');
  });

  it('標題中的方括號與反斜線會被跳脫，換行改成空白', () => {
    expect(escapeMarkdownText('[MV] a\\b [Live]')).toBe('\\[MV\\] a\\\\b \\[Live\\]');
    expect(markdownLink('  Line 1\nLine 2 ', ID, 5)).toBe('[Line 1 Line 2（00:05）](https://youtu.be/jNQXAC9IVRw?t=5)');
  });
});

describe('linkText', () => {
  it('依序產生三種格式', () => {
    expect(linkText('time', ID, 'T', 83)).toBe('https://youtu.be/jNQXAC9IVRw?t=83');
    expect(linkText('markdown', ID, 'T', 83)).toBe('[T（01:23）](https://youtu.be/jNQXAC9IVRw?t=83)');
    expect(linkText('plain', ID, 'T', 83)).toBe('https://youtu.be/jNQXAC9IVRw');
  });
});

describe('middleEllipsis（004 FR-32）', () => {
  it('不超過長度時原樣回傳', () => {
    expect(middleEllipsis('https://youtu.be/abc', 40)).toBe('https://youtu.be/abc');
  });

  it('過長時在中間以「…」省略，總長度為上限', () => {
    const out = middleEllipsis('abcdefghijklmnopqrstuvwxyz', 11);
    expect(out).toBe('abcde…vwxyz');
    expect(Array.from(out)).toHaveLength(11);
  });

  it('以字元（含中文與表情符號）計算長度', () => {
    expect(middleEllipsis('一二三四五六七八九十', 5)).toBe('一二…九十');
    expect(middleEllipsis('😀😀😀😀😀😀', 5)).toBe('😀😀…😀😀');
  });
});

import { describe, expect, it } from 'vitest';
import type { CaptionTrack } from '@/utils/youtube/dom';
import { defaultCaptionIndex, groupCaptions, isRealThumbnail, orderCaptions } from './logic';

describe('isRealThumbnail（002 FR-30、plan 3.8）', () => {
  it('200 且不是 120×90 的圖片才算存在', () => {
    expect(isRealThumbnail(200, 1280, 720)).toBe(true);
    expect(isRealThumbnail(200, 480, 360)).toBe(true);
  });
  it('排除 404 與 120×90 的預設圖', () => {
    expect(isRealThumbnail(404, 120, 90)).toBe(false);
    expect(isRealThumbnail(404, 1280, 720)).toBe(false);
    expect(isRealThumbnail(200, 120, 90)).toBe(false);
    expect(isRealThumbnail(200, 0, 0)).toBe(false);
  });
});

const track = (languageCode: string, isAuto = false): CaptionTrack => ({
  languageCode,
  name: `${languageCode}${isAuto ? ' (auto)' : ''}`,
  isAuto,
  url: `https://www.youtube.com/api/timedtext?lang=${languageCode}`,
});

describe('字幕分組與預設選擇（002 FR-40、FR-43）', () => {
  const tracks = [track('en'), track('ja'), track('zh-TW'), track('en', true)];

  it('分成上傳的字幕與自動產生的字幕', () => {
    const g = groupCaptions(tracks);
    expect(g.uploaded.map((t) => t.languageCode)).toEqual(['en', 'ja', 'zh-TW']);
    expect(g.auto.map((t) => t.languageCode)).toEqual(['en']);
  });

  it('預設選與瀏覽器語言完全相同的字幕', () => {
    expect(defaultCaptionIndex(tracks, 'zh-TW')).toBe(2);
    expect(defaultCaptionIndex(tracks, 'zh_TW')).toBe(2);
    expect(defaultCaptionIndex(tracks, 'ja')).toBe(1);
  });

  it('沒有完全相同時，選主要語言相同的；上傳的字幕優先於自動產生', () => {
    expect(defaultCaptionIndex(tracks, 'en-US')).toBe(0);
    expect(defaultCaptionIndex([track('en', true), track('en-GB')], 'en-US')).toBe(1);
    expect(defaultCaptionIndex([track('zh-Hans'), track('fr')], 'zh-TW')).toBe(0);
  });

  it('都沒有時選影片原始語言（自動產生字幕的語言，有同語言的上傳字幕時用上傳的）', () => {
    expect(defaultCaptionIndex(tracks, 'de')).toBe(0);
    expect(defaultCaptionIndex([track('fr'), track('ko', true)], 'de')).toBe(1);
    expect(defaultCaptionIndex([track('fr'), track('ko'), track('ko', true)], 'de')).toBe(1);
  });

  it('沒有自動字幕時選第一個；沒有字幕時回傳 -1', () => {
    expect(defaultCaptionIndex([track('fr'), track('ko')], 'de')).toBe(0);
    expect(defaultCaptionIndex([], 'en')).toBe(-1);
  });

  it('預設選擇的字幕排在所屬分組的最上方', () => {
    const { groups, selected } = orderCaptions(tracks, 'zh-TW');
    expect(selected?.languageCode).toBe('zh-TW');
    expect(groups.uploaded.map((t) => t.languageCode)).toEqual(['zh-TW', 'en', 'ja']);
    expect(orderCaptions([], 'en')).toEqual({ groups: { uploaded: [], auto: [] }, selected: null });
  });
});

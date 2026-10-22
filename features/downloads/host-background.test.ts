import { describe, expect, it } from 'vitest';
import { downloadArgs } from './host-background';

describe('downloadArgs（下載指令的參數）', () => {
  const settings = { dir: '/Users/me/Downloads', namePreset: 'channel-title', embed: false };
  const base = { videoId: 'jNQXAC9IVRw', title: 'T', label: 'L' };

  it('影片：帶格式、容器、裁切、嵌入設定', () => {
    expect(downloadArgs({ ...base, kind: 'video', formatId: '137+140', container: 'mp4', section: { start: 60, end: 90 } }, settings)).toEqual({
      videoId: 'jNQXAC9IVRw',
      kind: 'video',
      dir: '/Users/me/Downloads',
      namePreset: 'channel-title',
      formatId: '137+140',
      container: 'mp4',
      embed: false,
      section: { start: 60, end: 90 },
    });
  });

  it('沒有裁切時不帶 section', () => {
    const args = downloadArgs({ ...base, kind: 'mp3', bitrate: 320, section: null }, { ...settings, embed: true });
    expect(args).toEqual({ videoId: 'jNQXAC9IVRw', kind: 'mp3', dir: '/Users/me/Downloads', namePreset: 'channel-title', bitrate: 320, embed: true });
  });

  it('字幕：不帶 embed 與 section（橋接程式會拒絕不屬於該種類的欄位）', () => {
    const args = downloadArgs({ ...base, kind: 'subtitle', subLang: 'en', subFormat: 'txt', subAuto: true }, settings);
    expect(args).toEqual({ videoId: 'jNQXAC9IVRw', kind: 'subtitle', dir: '/Users/me/Downloads', namePreset: 'channel-title', subLang: 'en', subFormat: 'txt', subAuto: true });
  });

  it('請求中多出的欄位不會傳給橋接程式', () => {
    const request = { ...base, kind: 'video', formatId: '18', container: 'mp4', section: null, dir: '/etc', exec: 'x' } as never;
    expect(Object.keys(downloadArgs(request, settings)).sort()).toEqual(['container', 'dir', 'embed', 'formatId', 'kind', 'namePreset', 'videoId']);
  });
});

import { describe, expect, it } from 'vitest';
import { isRealThumbnail } from './logic';

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

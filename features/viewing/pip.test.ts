import { describe, expect, it } from 'vitest';
import { isPipSupported } from './pip';

describe('isPipSupported（003 FR-32）', () => {
  it('瀏覽器沒有原生子母畫面時回傳 false', () => {
    expect(isPipSupported({ pictureInPictureEnabled: false } as Document)).toBe(false);
    expect(isPipSupported({} as Document)).toBe(false);
  });
});

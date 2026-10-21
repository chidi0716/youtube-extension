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

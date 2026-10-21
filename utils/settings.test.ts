import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { enabled } from './settings';

describe('settings', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('enabled 預設為 true', async () => {
    expect(await enabled.getValue()).toBe(true);
  });

  it('enabled 會記住設定的值', async () => {
    await enabled.setValue(false);
    expect(await enabled.getValue()).toBe(false);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Messages = Record<string, { message: string; description?: string }>;

const load = (locale: string): Messages =>
  JSON.parse(readFileSync(new URL(`../public/_locales/${locale}/messages.json`, import.meta.url), 'utf8'));

describe('_locales', () => {
  const en = load('en');
  const zh = load('zh_TW');

  it('en 與 zh_TW 有相同的訊息名稱', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('每則訊息都有非空白的文字', () => {
    for (const [locale, messages] of [
      ['en', en],
      ['zh_TW', zh],
    ] as const) {
      for (const [key, value] of Object.entries(messages)) {
        expect(value.message.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('訊息名稱只用英數字與底線（Chrome 的規定）', () => {
    for (const key of Object.keys(en)) expect(key).toMatch(/^[A-Za-z0-9_]+$/);
  });
});

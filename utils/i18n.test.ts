import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { currentLocale, formatMessage, formatNumber, onLocaleChange, resolveLocale, setLocale, t } from './i18n';
import { formatSize } from './format-list';

type Messages = Record<string, { message: string; description?: string; placeholders?: Record<string, { content: string }> }>;

const root = new URL('..', import.meta.url).pathname;
const load = (locale: string): Messages => JSON.parse(readFileSync(join(root, 'public', '_locales', locale, 'messages.json'), 'utf8'));
const en = load('en');
const zh = load('zh_TW');

describe('語言檔（constitution 第 8 點、007 NFR-2）', () => {
  it('en 與 zh_TW 的鍵完全一致', () => {
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

  it('訊息名稱只用英數字與底線（Chrome 的規定，manifest 仍使用 _locales）', () => {
    for (const key of Object.keys(en)) expect(key).toMatch(/^[A-Za-z0-9_]+$/);
  });

  it('兩種語言使用相同的佔位符，且都有定義', () => {
    const names = (m: string) => [...m.matchAll(/\$([A-Za-z0-9_]+)\$/g)].map((x) => x[1]!.toLowerCase()).sort();
    for (const [key, value] of Object.entries(en)) {
      expect(names(zh[key]!.message), key).toEqual(names(value.message));
      for (const name of names(value.message)) expect(value.placeholders?.[name], `${key}.${name}`).toBeDefined();
    }
  });

  it('原始碼中使用的鍵都存在於兩份語言檔（掃描 t(…)、data-i18n 與註冊表中的 label／description／title）', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx|html)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path);
      }
    };
    for (const dir of ['entrypoints', 'components', 'features', 'utils']) walk(join(root, dir));
    const used = new Set<string>();
    const patterns = [
      /\bt\(\s*'([A-Za-z0-9_]+)'/g,
      /data-i18n="([A-Za-z0-9_]+)"/g,
      /\b(?:label|description|title|panelTitle|message):\s*'([A-Za-z0-9_]+)'/g,
      /\bt\(\s*[^)]*\?\s*'([A-Za-z0-9_]+)'\s*:\s*'([A-Za-z0-9_]+)'/g,
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const re of patterns) for (const m of source.matchAll(re)) for (const k of m.slice(1)) if (k) used.add(k);
    }
    // 不是訊息名稱的字串（例如 Select 的 label）會被排除：只檢查看起來像訊息名稱（駝峰式、至少兩段）的值。
    const keys = [...used].filter((k) => /^[a-z]+[A-Z]/.test(k));
    expect(keys.length).toBeGreaterThan(150);
    const missing = keys.filter((k) => !(k in en) || !(k in zh));
    expect(missing).toEqual([]);
  });
});

describe('翻譯層（007、plan 3.7.4）', () => {
  afterEach(() => setLocale('en'));

  it('「跟隨瀏覽器」：中文（任何地區）用繁體中文，其他用英文（FR-2）', () => {
    for (const lang of ['zh-TW', 'zh-CN', 'zh-HK', 'zh', 'zh_TW', 'ZH-tw']) expect(resolveLocale('auto', lang), lang).toBe('zh_TW');
    for (const lang of ['en-US', 'ja', 'fr-FR', 'zu', '']) expect(resolveLocale('auto', lang), lang).toBe('en');
    expect(resolveLocale('en', 'zh-TW')).toBe('en');
    expect(resolveLocale('zh_TW', 'en-US')).toBe('zh_TW');
    expect(resolveLocale('garbage', 'en-US')).toBe('en');
  });

  it('切換語言立即改變 t() 的結果並通知訂閱者', () => {
    const seen: string[] = [];
    const off = onLocaleChange((l) => seen.push(l));
    setLocale('en');
    expect(t('btnVideo')).toBe(en.btnVideo!.message);
    setLocale('zh_TW');
    expect(currentLocale()).toBe('zh_TW');
    expect(t('btnVideo')).toBe(zh.btnVideo!.message);
    setLocale('zh_TW');
    off();
    setLocale('en');
    expect(seen).toEqual(['zh_TW']);
  });

  it('代換佔位符；繁體中文語言檔沒有 placeholders 定義時沿用英文的', () => {
    setLocale('en');
    expect(t('updateDone', '2026.11.01')).toBe('yt-dlp was updated to 2026.11.01.');
    setLocale('zh_TW');
    expect(t('updateDone', '2026.11.01')).toBe('yt-dlp 已更新到 2026.11.01。');
    expect(t('editMoved', ['MP3', '1', '13'])).toBe('「MP3」移到第 1 個位置（共 13 個）');
    expect(formatMessage({ message: 'Cost: $$5 $A$' }, { message: '', placeholders: { a: { content: '$1' } } }, 'x')).toBe('Cost: $5 x');
  });

  it('數字與檔案大小依介面語言格式化（FR-6）', () => {
    setLocale('en');
    expect(formatNumber(1234.5, 1)).toBe('1,234.5');
    expect(formatSize(147_100_000, false, '~')).toBe('147.1 MB');
    setLocale('zh_TW');
    expect(formatSize(147_100_000, true, '約 ')).toBe('約 147.1 MB');
  });
});

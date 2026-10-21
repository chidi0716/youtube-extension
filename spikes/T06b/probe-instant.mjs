// T06b 實測：在 YouTube 首頁不重新載入、直接切換主題，確認效果與 YouTube 以該主題載入時相同。
// 不載入擴充功能，以 page.evaluate 模擬擴充功能的做法（isolated world 與頁面共用同一份 DOM）：
//   1. 改寫 PREF 的 f6 旗標（與 T06a 相同）；
//   2. 設定或移除 <html dark>（MODE=html），或另外同步 ytd-masthead 的 dark／page-dark-theme（MODE=html+masthead）。
// 比對方式：分別以 f6=400、f6=80000 載入首頁當作參考，收集每種元素（tag#id.class）第一個可見元素的
// 背景色、文字色、邊框色，再與即時切換後的頁面比對。之後等 10 秒、站內換頁、重新整理，確認主題沒有被改回去。
// YouTube 顯示驗證頁時直接結束，不嘗試繞過。
//   MODE=html node spikes/T06b/probe-instant.mjs
//   ONLY=0 LOG_WRITES=1 MODE=html+masthead node spikes/T06b/probe-instant.mjs   # 只跑第 1 個情境並記錄 PREF 寫入
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '.cache');
mkdirSync(out, { recursive: true });
const MODE = process.env.MODE ?? 'html';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});

async function open(pref, colorScheme = 'light') {
  const context = await browser.newContext({ colorScheme, locale: 'en-US', viewport: { width: 1280, height: 900 } });
  if (pref !== null) await context.addCookies([{ name: 'PREF', value: pref, domain: '.youtube.com', path: '/' }]);
  if (process.env.LOG_WRITES) {
    // 記錄頁面寫入 PREF 的值與呼叫來源（只在實測腳本中包裝 document.cookie）
    await context.addInitScript(() => {
      const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
      window.__prefWrites = [];
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get() {
          return desc.get.call(this);
        },
        set(v) {
          if (String(v).startsWith('PREF=')) {
            const from = (new Error().stack ?? '').split('\n').slice(2, 4).map((l) => l.trim().replace(/https:\/\/www\.youtube\.com\/s\/[^ )]*\/([^/ )]+)/, '$1')).join(' < ');
            window.__prefWrites.push({ t: Math.round(performance.now()), value: String(v).split(';')[0], from });
          }
          desc.set.call(this, v);
        },
      });
    });
  }
  const page = await context.newPage();
  page.__loads = 0;
  page.on('load', () => page.__loads++);
  await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) {
    console.log('verification page; stopping', page.url());
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(6000);
  return page;
}

/** 每種元素（tag#id.class）第一個可見元素的顏色。 */
const sample = (page) =>
  page.evaluate(() => {
    const result = {};
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.top > innerHeight || r.bottom < 0) continue;
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((c) => c && !/^(?:style-scope|x-scope)$/.test(c)).sort().slice(0, 3).join('.') : '';
      const key = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (cls ? `.${cls}` : '');
      if (key in result) continue;
      const s = getComputedStyle(el);
      result[key] = [s.backgroundColor, s.color, s.borderTopColor, s.fill].join(' | ');
    }
    result['<html>'] = getComputedStyle(document.documentElement).backgroundColor;
    return result;
  });

const compare = (ref, got) => {
  const keys = Object.keys(ref).filter((k) => k in got);
  const bad = keys.filter((k) => ref[k] !== got[k]);
  return { compared: keys.length, mismatched: bad.length, examples: bad.slice(0, 12).map((k) => `${k}: ref=${ref[k]} got=${got[k]}`) };
};

const attrs = (page) =>
  page.evaluate(() => ({
    html: document.documentElement.hasAttribute('dark'),
    masthead: ['dark', 'page-dark-theme'].filter((a) => document.querySelector('ytd-masthead')?.hasAttribute(a)),
    pref: document.cookie.split('; ').find((c) => c.startsWith('PREF=')) ?? null,
    bg: getComputedStyle(document.documentElement).backgroundColor,
    mastheadBg: getComputedStyle(document.querySelector('ytd-masthead #background') ?? document.querySelector('ytd-masthead')).backgroundColor,
    url: location.pathname,
  }));

/** 擴充功能做法的模擬：改 PREF，立即設定屬性。 */
const apply = (page, theme) =>
  page.evaluate(
    ({ theme, mode }) => {
      const dark = theme === 'dark';
      const raw = (document.cookie.split('; ').find((c) => c.startsWith('PREF=')) ?? 'PREF=').slice(5);
      const fields = raw ? raw.split('&').map((p) => p.split('=')) : [];
      const i = fields.findIndex(([k]) => k === 'f6');
      const flags = i === -1 ? 0 : parseInt(fields[i][1], 16);
      const next = ((flags & ~0x80400) | (dark ? 0x400 : 0x80000)).toString(16);
      if (i === -1) fields.push(['f6', next]);
      else fields[i] = ['f6', next];
      document.cookie = `PREF=${fields.map((f) => f.join('=')).join('&')}; domain=.youtube.com; path=/; max-age=34560000; secure; samesite=lax`;
      window.__t0 = performance.now();
      document.documentElement.toggleAttribute('dark', dark);
      if (mode === 'html+masthead') {
        const m = document.querySelector('ytd-masthead');
        m?.toggleAttribute('dark', dark);
        m?.toggleAttribute('page-dark-theme', dark);
      }
      // 之後屬性被改回去時記錄
      window.__reverts = [];
      new MutationObserver((list) => {
        for (const x of list) window.__reverts.push(`${Math.round(performance.now() - window.__t0)}ms ${x.target.tagName.toLowerCase()} ${x.attributeName}=${x.target.hasAttribute(x.attributeName)}`);
      }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['dark', 'page-dark-theme'] });
    },
    { theme, mode: MODE },
  );

console.log(`MODE=${MODE}`);
const refDarkPage = await open('f6=400');
const refDark = await sample(refDarkPage);
console.log('reference dark', JSON.stringify(await attrs(refDarkPage)));
await refDarkPage.screenshot({ path: join(out, 'ref-dark.png') });
const refLightPage = await open('f6=80000');
const refLight = await sample(refLightPage);
console.log('reference light', JSON.stringify(await attrs(refLightPage)));
await refLightPage.screenshot({ path: join(out, 'ref-light.png') });

const scenarios = [
  ['light -> dark', 'f6=80000', 'dark', refDark, 'light'],
  ['dark -> light', 'f6=400', 'light', refLight, 'light'],
  ['unset (device dark) -> light', null, 'light', refLight, 'dark'],
  ['unset (device light) -> dark', null, 'dark', refDark, 'light'],
].filter((_, i) => !process.env.ONLY || process.env.ONLY.split(',').includes(String(i)));
for (const [label, startPref, target, ref, scheme] of scenarios) {
  console.log(`\n=== ${label}`);
  const page = await open(startPref, scheme);
  console.log('start', JSON.stringify(await attrs(page)));
  // 讓影片預覽等持續變化的元素停住，避免影響比對
  await apply(page, target);
  await page.waitForTimeout(300);
  const immediate = await sample(page);
  console.log('after 300ms', JSON.stringify(await attrs(page)), 'reloaded', page.__loads > 1);
  console.log('compare with reference (300ms)', JSON.stringify(compare(ref, immediate)));
  await page.screenshot({ path: join(out, `${label.replace(/[^a-z]+/gi, '-')}-${MODE}.png`) });
  await page.waitForTimeout(10_000);
  console.log('after 10s', JSON.stringify(await attrs(page)), 'reverts', JSON.stringify(await page.evaluate(() => window.__reverts)));
  console.log('compare with reference (10s)', JSON.stringify(compare(ref, await sample(page))));

  // 打開 ⋮ 設定選單，確認選單的顏色也是新主題
  await page.locator('ytd-topbar-menu-button-renderer button, #buttons button[aria-label="Settings"]').first().click();
  await page.waitForTimeout(800);
  const menuBg = await page.evaluate(() => {
    const d = [...document.querySelectorAll('tp-yt-iron-dropdown')].find((e) => e.getBoundingClientRect().height > 0);
    const box = d?.querySelector('ytd-multi-page-menu-renderer') ?? d;
    return box ? { bg: getComputedStyle(box).backgroundColor, color: getComputedStyle(box).color, appearance: d.innerText.match(/Appearance:[^\n]*/)?.[0] } : null;
  });
  console.log('settings menu', JSON.stringify(menuBg));
  await page.keyboard.press('Escape');

  // 站內換頁：點側欄（guide）中的連結
  const link = page.locator('ytd-guide-entry-renderer a[href^="/feed/"], ytd-mini-guide-entry-renderer a[href^="/feed/"], ytd-guide-entry-renderer a[href^="/shorts"], ytd-mini-guide-entry-renderer a[href^="/shorts"]').first();
  if (await link.count()) {
    const href = await link.getAttribute('href');
    await link.click();
    await page.waitForTimeout(4000);
    if (process.env.LOG_WRITES) console.log('PREF writes so far', JSON.stringify(await page.evaluate(() => window.__prefWrites)));
    console.log(`after SPA navigation to ${href}`, JSON.stringify(await attrs(page)), 'reloaded', page.__loads > 1, 'reverts', JSON.stringify(await page.evaluate(() => window.__reverts ?? 'page reloaded')));
    await page.goBack();
    await page.waitForTimeout(3000);
    console.log('after history back', JSON.stringify(await attrs(page)), 'reloaded', page.__loads > 1, 'reverts', JSON.stringify(await page.evaluate(() => window.__reverts ?? 'page reloaded')));
  } else {
    console.log('no guide link found for SPA navigation');
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const reloaded = await attrs(page);
  console.log('after reload', JSON.stringify(reloaded));
  console.log('compare with reference (after reload)', JSON.stringify(compare(ref, await sample(page))));
  await page.context().close();
}

// 參考頁之間的差異（相同主題重新載入兩次的雜訊基準）
const again = await open('f6=400');
console.log('\nnoise baseline (dark vs dark reload)', JSON.stringify(compare(refDark, await sample(again))));
await browser.close();

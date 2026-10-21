// T06b 實測：觀看頁（站內換頁進入）上某個元素的指定屬性由哪些規則決定，用到的 CSS 變數在哪些選擇器定義。
// 用來找出即時切換後顏色沒有跟著變的元素（例如「訂閱」按鈕的文字色）。只嘗試一次；遇到驗證頁就結束。
//   TARGET='button.ytSpecButtonShapeNextFilled' PROP=color node spikes/T06b/probe-watch-rules.mjs
import { chromium } from 'playwright-core';

const TARGET = process.env.TARGET ?? 'button.ytSpecButtonShapeNextFilled';
const PROP = process.env.PROP ?? 'color';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const context = await browser.newContext({ colorScheme: 'light', locale: 'en-US', viewport: { width: 1280, height: 900 } });
await context.addCookies([{ name: 'PREF', value: process.env.INITIAL_PREF ?? 'f6=80000', domain: '.youtube.com', path: '/' }]);
const page = await context.newPage();
await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) {
  console.log('verification page; stopping', page.url());
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(5000);
const box = page.locator('input[name="search_query"]').first();
await box.click();
await box.fill('me at the zoo');
await box.press('Enter');
await page.waitForTimeout(5000);
await page.locator('ytd-video-renderer a#thumbnail[href^="/watch"]').first().click();
await page.waitForTimeout(8000);
const result = await page.evaluate(
  ({ target, prop }) => {
    const el = document.querySelector(target);
    if (!el) return `no element ${target}`;
    const all = [];
    const walk = (list) => {
      for (const r of list) {
        if (r.cssRules && !(r instanceof CSSStyleRule)) {
          walk(r.cssRules);
          continue;
        }
        if (r instanceof CSSStyleRule) all.push(r);
      }
    };
    for (const s of document.styleSheets) {
      try {
        walk(s.cssRules);
      } catch {}
    }
    const matching = all.filter((r) => {
      try {
        return el.matches(r.selectorText) && r.style.getPropertyValue(prop);
      } catch {
        return false;
      }
    });
    const rules = matching.map((r) => `${r.selectorText.slice(0, 160)} { ${prop}: ${r.style.getPropertyValue(prop)} }`);
    const vars = [...new Set(rules.join(' ').match(/--[\w-]+/g) ?? [])];
    const defs = {};
    const seen = new Set();
    const queue = [...vars];
    while (queue.length && seen.size < 12) {
      const v = queue.shift();
      if (seen.has(v)) continue;
      seen.add(v);
      defs[v] = all
        .filter((r) => r.style.getPropertyValue(v))
        .map((r) => `${r.selectorText.slice(0, 80)} => ${r.style.getPropertyValue(v).trim().slice(0, 80)}`)
        .slice(0, 10);
      for (const d of defs[v]) for (const m of d.match(/--[\w-]+/g) ?? []) if (!seen.has(m)) queue.push(m);
    }
    return { computed: getComputedStyle(el)[prop], className: el.className, rules, defs };
  },
  { target: TARGET, prop: PROP },
);
console.log(JSON.stringify(result, null, 1));
await browser.close();

// T06b 實測：登入提示（ytd-feed-nudge-renderer #dismissible）的邊框色由哪條規則與哪個 CSS 變數決定，
// 以及該變數是否只在 :root（依載入時的主題）定義、沒有 [dark]／[light] 覆寫。
// 不載入擴充功能；遇到驗證頁就結束。
//   node spikes/T06b/probe-nudge-rules.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const context = await browser.newContext({ colorScheme: 'light', locale: 'en-US', viewport: { width: 1280, height: 900 } });
await context.addCookies([{ name: 'PREF', value: 'f6=80000', domain: '.youtube.com', path: '/' }]);
const page = await context.newPage();
await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) {
  console.log('verification page; stopping', page.url());
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(6000);
const result = await page.evaluate(() => {
  const el = document.querySelector('ytd-feed-nudge-renderer #dismissible');
  if (!el) return 'no nudge';
  const rules = [];
  const all = [];
  const walk = (list) => {
    for (const r of list) {
      if (r.cssRules && !(r instanceof CSSStyleRule)) {
        walk(r.cssRules);
        continue;
      }
      if (!(r instanceof CSSStyleRule)) continue;
      all.push(r);
      let m = false;
      try {
        m = el.matches(r.selectorText);
      } catch {}
      if (m && /border/.test(r.style.cssText)) rules.push(`${r.selectorText.slice(0, 120)} { ${r.style.cssText.slice(0, 200)} }`);
    }
  };
  for (const s of document.styleSheets) {
    try {
      walk(s.cssRules);
    } catch {}
  }
  const vars = [...new Set(rules.join(' ').match(/--[\w-]+/g) ?? [])];
  const defs = {};
  for (const v of vars) {
    defs[v] = all.filter((r) => r.style.getPropertyValue(v)).map((r) => `${r.selectorText.slice(0, 60)} => ${r.style.getPropertyValue(v).trim().slice(0, 60)}`);
  }
  return { rules, defs };
});
console.log(JSON.stringify(result, null, 1));
await browser.close();

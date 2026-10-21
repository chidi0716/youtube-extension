// T06b 實測：YouTube 依載入時的主題以 `:root:root`（比 [dark]／[light] 優先）固定了哪些 CSS 變數、
// 這些變數在同一份樣式表中是否有 [dark]／[light] 的值、掃描全部樣式規則要多久。
// 不載入擴充功能；遇到驗證頁就結束。
//   node spikes/T06b/probe-pinned-vars.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
for (const pref of ['f6=80000', 'f6=400']) {
  const context = await browser.newContext({ colorScheme: 'light', locale: 'en-US', viewport: { width: 1280, height: 900 } });
  await context.addCookies([{ name: 'PREF', value: pref, domain: '.youtube.com', path: '/' }]);
  const page = await context.newPage();
  await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) {
    console.log('verification page; stopping', page.url());
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(6000);
  const r = await page.evaluate(() => {
    const t0 = performance.now();
    let total = 0;
    const pinned = new Map();
    const dark = new Map();
    const light = new Map();
    const other = new Map();
    const walk = (list) => {
      for (const rule of list) {
        if (rule.cssRules && !(rule instanceof CSSStyleRule)) {
          walk(rule.cssRules);
          continue;
        }
        if (!(rule instanceof CSSStyleRule)) continue;
        total++;
        const parts = rule.selectorText.split(',').map((s) => s.trim());
        const target = parts.includes(':root:root') ? pinned : parts.includes('[dark]') ? dark : parts.includes('[light]') ? light : null;
        if (!target) {
          if (/:root:root/.test(rule.selectorText)) other.set(rule.selectorText.slice(0, 80), true);
          continue;
        }
        for (let i = 0; i < rule.style.length; i++) {
          const p = rule.style[i];
          if (p.startsWith('--')) target.set(p, rule.style.getPropertyValue(p).trim());
        }
      }
    };
    for (const s of document.styleSheets) {
      try {
        walk(s.cssRules);
      } catch {}
    }
    const ms = performance.now() - t0;
    const names = [...pinned.keys()];
    return {
      ms: Math.round(ms),
      totalRules: total,
      sheets: document.styleSheets.length,
      pinned: names.length,
      withDark: names.filter((n) => dark.has(n)).length,
      withLight: names.filter((n) => light.has(n)).length,
      sample: names.slice(0, 8).map((n) => `${n}: pinned=${pinned.get(n)} dark=${dark.get(n)} light=${light.get(n)}`),
      otherRootRootSelectors: [...other.keys()].slice(0, 5),
    };
  });
  console.log(pref, JSON.stringify(r, null, 1));
  await context.close();
}
await browser.close();

// T06b 實測：以深色或淺色載入 YouTube 首頁後，移除／加上主題屬性，列出決定 ytd-app 與
// 頂端列背景色的 CSS 規則，以及 --yt-sys-color-baseline--base-background 的定義位置。
// 用來確認以深色載入的頁面為什麼移除屬性後仍是深色。不載入擴充功能；遇到驗證頁就結束。
//   START=dark node spikes/T06b/probe-rules.mjs
import { chromium } from 'playwright-core';

const START = process.env.START ?? 'dark';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const context = await browser.newContext({ colorScheme: 'light', locale: 'en-US', viewport: { width: 1280, height: 900 } });
await context.addCookies([{ name: 'PREF', value: START === 'dark' ? 'f6=400' : 'f6=80000', domain: '.youtube.com', path: '/' }]);
const page = await context.newPage();
await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) {
  console.log('verification page; stopping', page.url());
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(6000);

const inspect = () =>
  page.evaluate(() => {
    const app = document.querySelector('ytd-app');
    const rules = [];
    const varDefs = [];
    const walk = (list, sheet) => {
      for (const r of list) {
        if (r.cssRules && !(r instanceof CSSStyleRule)) {
          walk(r.cssRules, sheet);
          continue;
        }
        if (!(r instanceof CSSStyleRule)) continue;
        for (const v of ['--yt-sys-color-baseline--base-background', '--t3e41d7b17b187f69']) {
          if (r.style.getPropertyValue(v)) varDefs.push(`${v}: ${r.selectorText.slice(0, 160)} => ${r.style.getPropertyValue(v).trim()}`);
        }
        let matches = false;
        try {
          matches = app.matches(r.selectorText) || document.documentElement.matches(r.selectorText);
        } catch {}
        if (matches && (r.style.backgroundColor || r.style.background || r.style.getPropertyValue('--yt-sys-color-baseline--base-background'))) {
          rules.push(`${r.selectorText.slice(0, 160)} { background: ${r.style.background || r.style.backgroundColor}; var: ${r.style.getPropertyValue('--yt-sys-color-baseline--base-background')} } [${(sheet.href ?? 'inline').slice(-30)}]`);
        }
      }
    };
    for (const s of document.styleSheets) {
      try {
        walk(s.cssRules, s);
      } catch {}
    }
    return {
      appBg: getComputedStyle(app).backgroundColor,
      baseVar: getComputedStyle(app).getPropertyValue('--yt-sys-color-baseline--base-background').trim(),
      appVar: getComputedStyle(app).getPropertyValue('--t3e41d7b17b187f69').trim(),
      rules,
      varDefs: varDefs.slice(0, 40),
      varDefCount: varDefs.length,
      htmlAttrs: [...document.documentElement.attributes].map((a) => a.name).filter((n) => n !== 'style'),
    };
  });

console.log(`START=${START}`);
console.log('as loaded', JSON.stringify(await inspect(), null, 1));
await page.evaluate((start) => {
  const dark = start !== 'dark';
  document.documentElement.toggleAttribute('dark', dark);
  const m = document.querySelector('ytd-masthead');
  m?.toggleAttribute('dark', dark);
  m?.toggleAttribute('page-dark-theme', dark);
}, START);
await page.waitForTimeout(300);
const after = await inspect();
console.log('after toggling attributes', JSON.stringify({ appBg: after.appBg, baseVar: after.baseVar, appVar: after.appVar, rules: after.rules, htmlAttrs: after.htmlAttrs }, null, 1));
await browser.close();

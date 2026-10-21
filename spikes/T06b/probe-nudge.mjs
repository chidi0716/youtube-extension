// T06b 實測：首頁的登入提示（ytd-feed-nudge-renderer）在深色與淺色載入時，子元素的屬性與 class 差在哪裡。
// 不載入擴充功能；遇到驗證頁就結束。
//   node spikes/T06b/probe-nudge.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});

async function dump(pref) {
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
  const lines = await page.evaluate(() => {
    const root = document.querySelector('ytd-feed-nudge-renderer');
    if (!root) return ['(no nudge)'];
    const out = [];
    const walk = (el, depth) => {
      if (depth > 12) return;
      const attrs = [...el.attributes].filter((a) => a.name !== 'style' && a.name !== 'href').map((a) => (a.value ? `${a.name}="${a.value.slice(0, 120)}"` : a.name));
      out.push(`${'  '.repeat(depth)}${el.tagName.toLowerCase()} ${attrs.join(' ')}`);
      for (const c of el.children) walk(c, depth + 1);
    };
    walk(root, 0);
    return out;
  });
  await context.close();
  return lines;
}

const dark = await dump('f6=400');
const light = await dump('f6=80000');
console.log('--- lines only in dark');
for (const l of dark) if (!light.includes(l)) console.log(l);
console.log('--- lines only in light');
for (const l of light) if (!dark.includes(l)) console.log(l);
await browser.close();

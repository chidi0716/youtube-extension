// T06b 實測：YouTube 自己的「外觀」選單（未登入）寫入 PREF 與開始重新載入（beforeunload／pagehide）
// 之間隔多久。用來決定擴充功能修正 PREF 前要等多久，避免蓋掉使用者從 YouTube 選單做的選擇。
// 以 addInitScript 把時間點記到 sessionStorage（重新載入後讀回）；只在實測腳本中包裝 document.cookie。
// 不載入擴充功能；遇到驗證頁就結束。
//   node spikes/T06b/probe-menu-timing.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const context = await browser.newContext({ colorScheme: 'light', locale: 'en-US', viewport: { width: 1280, height: 900 } });
await context.addCookies([{ name: 'PREF', value: 'f6=80000', domain: '.youtube.com', path: '/' }]);
await context.addInitScript(() => {
  const log = (what) => {
    const list = JSON.parse(sessionStorage.getItem('__probe') ?? '[]');
    list.push(`${Date.now()} ${what}`);
    sessionStorage.setItem('__probe', JSON.stringify(list));
  };
  const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get() {
      return desc.get.call(this);
    },
    set(v) {
      if (String(v).startsWith('PREF=')) log(`PREF write ${String(v).split(';')[0]}`);
      desc.set.call(this, v);
    },
  });
  addEventListener('beforeunload', () => log('beforeunload'));
  addEventListener('pagehide', () => log('pagehide'));
  new MutationObserver(() => log(`html dark=${document.documentElement.hasAttribute('dark')}`)).observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });
});
const page = await context.newPage();
await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) {
  console.log('verification page; stopping', page.url());
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(5000);
await page.evaluate(() => sessionStorage.setItem('__probe', JSON.stringify([`${Date.now()} before click`])));
await page.locator('ytd-topbar-menu-button-renderer button, #buttons button[aria-label="Settings"]').first().click();
await page.waitForTimeout(800);
await page.locator('tp-yt-iron-dropdown').getByText(/^Appearance:/).first().click();
await page.waitForTimeout(800);
await page.evaluate(() => {
  const list = JSON.parse(sessionStorage.getItem('__probe') ?? '[]');
  list.push(`${Date.now()} clicking Dark theme`);
  sessionStorage.setItem('__probe', JSON.stringify(list));
});
await page.locator('tp-yt-iron-dropdown').getByText('Dark theme', { exact: true }).first().click();
await page.waitForTimeout(6000);
const log = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__probe') ?? '[]'));
const t0 = Number(log.find((l) => l.includes('clicking'))?.split(' ')[0] ?? 0);
for (const line of log) {
  const [t, ...rest] = line.split(' ');
  console.log(`${String(Number(t) - t0).padStart(6)}ms  ${rest.join(' ')}`);
}
await browser.close();

// T06d 實測：外觀子選單項目（ytd-compact-link-renderer）與「外觀」項目（ytd-toggle-theme-compact-link-renderer）
// 在頁面 JavaScript 中的 data 物件裡，有沒有不受介面語言影響的識別值（例如圖示名稱、動作名稱）。
// 文字欄位只列出鍵名，不列出內容。以英文與繁體中文介面各看一次。不載入擴充功能；遇到驗證頁就結束。
//   node spikes/T06d/probe-menu-data.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
for (const [locale, hl] of [
  ['en-US', 'en'],
  ['zh-TW', 'zh-TW'],
]) {
  const context = await browser.newContext({ locale, viewport: { width: 1280, height: 900 } });
  await context.addCookies([{ name: 'PREF', value: `hl=${hl}&f6=80000`, domain: '.youtube.com', path: '/' }]);
  const page = await context.newPage();
  await page.goto(`https://www.youtube.com/?hl=${hl}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) {
    console.log('verification page; stopping', page.url());
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(5000);
  await page.locator('ytd-masthead #end ytd-topbar-menu-button-renderer button').first().click();
  await page.waitForTimeout(1500);
  await page.locator('ytd-popup-container ytd-toggle-theme-compact-link-renderer').first().click();
  await page.waitForTimeout(1500);
  const data = await page.evaluate(() => {
    // 把物件中的字串值換成 <text> 或保留看起來像代號的值（全大寫、底線）
    const scrub = (v, depth = 0) => {
      if (depth > 9) return '…';
      if (typeof v === 'string') return /^[A-Z0-9_]+$/.test(v) ? v : `<${v.length} chars>`;
      if (Array.isArray(v)) return v.slice(0, 4).map((x) => scrub(x, depth + 1));
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).slice(0, 20).map(([k, x]) => [k, scrub(x, depth + 1)]));
      return v;
    };
    const items = [...document.querySelectorAll('ytd-popup-container #submenu ytd-compact-link-renderer')];
    const toggle = document.querySelector('ytd-popup-container ytd-toggle-theme-compact-link-renderer');
    return {
      toggle: scrub(toggle?.data ?? toggle?.__data ?? null),
      items: items.map((el) => ({ hasCheckIcon: !!el.querySelector('#content-icon'), data: scrub(el.data ?? null) })),
    };
  });
  console.log(`\n######## ${locale}`);
  console.log(JSON.stringify(data, null, 1));
  await context.close();
}
await browser.close();

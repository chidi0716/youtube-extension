// T06a 實測：用 YouTube 自己的「外觀」選單（未登入時在右上角 ⋮ 設定選單）依序選擇
// 使用裝置主題／深色主題／淺色主題，記錄每次選擇後 PREF cookie 的內容與頁面主題。
// 裝置主題模擬為深色（prefers-color-scheme: dark）。不載入擴充功能；
// YouTube 顯示驗證頁時直接結束，不嘗試繞過。
//   node spikes/T06a/probe-menu.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const context = await browser.newContext({ colorScheme: process.env.DEVICE ?? 'dark', locale: 'en-US', viewport: { width: 1280, height: 900 } });
// INITIAL_PREF：預先放入的 PREF 值（例如含其他偏好的 f5=30000&f6=8&hl=en），用來確認其他欄位是否保留。
if (process.env.INITIAL_PREF) {
  await context.addCookies([{ name: 'PREF', value: process.env.INITIAL_PREF, domain: '.youtube.com', path: '/' }]);
}
const page = await context.newPage();

const state = () =>
  page.evaluate(() => ({
    dark: document.documentElement.hasAttribute('dark'),
    pref: document.cookie.split('; ').find((c) => c.startsWith('PREF=')) ?? null,
  }));

await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com') {
  console.log('verification page; stopping', page.url());
  // 最後一次選擇後 PREF cookie 的屬性（網域、路徑、期限、Secure、SameSite）
const pref = (await context.cookies('https://www.youtube.com/')).find((c) => c.name === 'PREF');
if (pref) console.log('cookie attributes', JSON.stringify({ ...pref, value: undefined, expiresInDays: Math.round((pref.expires - Date.now() / 1000) / 86400) }));
await browser.close();
  process.exit(2);
}
await page.waitForTimeout(4000);
console.log('initial', JSON.stringify(await state()));

// 未登入時選單只有「深色主題」「淺色主題」兩項（實測）；有「使用裝置主題」時一併測試。
for (const option of ['Dark theme', 'Light theme', 'Use device theme', 'Dark theme']) {
  await page.locator('ytd-topbar-menu-button-renderer button, #buttons button[aria-label="Settings"]').first().click();
  await page.waitForTimeout(800);
  await page.locator('tp-yt-iron-dropdown').getByText(/^Appearance:/).first().click();
  await page.waitForTimeout(800);
  if (process.env.DUMP) {
    console.log(await page.evaluate(() => [...document.querySelectorAll('tp-yt-iron-dropdown:not([aria-hidden="true"]) *')].filter((e) => e.children.length === 0 && e.textContent.trim()).map((e) => e.tagName.toLowerCase() + ':' + e.textContent.trim()).slice(0, 40).join(' | ')));
    await page.screenshot({ path: process.env.DUMP });
    break;
  }
  const item = page.locator('tp-yt-iron-dropdown').getByText(option, { exact: true }).first();
  if ((await item.count()) === 0) {
    console.log(`option "${option}" not in menu`);
    await page.keyboard.press('Escape');
    continue;
  }
  await item.click();
  await page.waitForTimeout(4000);
  console.log(`after "${option}"`, JSON.stringify(await state()), page.url());
}
// 最後一次選擇後 PREF cookie 的屬性（網域、路徑、期限、Secure、SameSite）
const pref = (await context.cookies('https://www.youtube.com/')).find((c) => c.name === 'PREF');
if (pref) console.log('cookie attributes', JSON.stringify({ ...pref, value: undefined, expiresInDays: Math.round((pref.expires - Date.now() / 1000) / 86400) }));
await browser.close();

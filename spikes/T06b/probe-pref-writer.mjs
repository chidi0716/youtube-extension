// T06b 實測：找出站內換頁時把 PREF 改回去的是頁面 JavaScript（document.cookie）還是伺服器回應
// （Set-Cookie）。以 Playwright 的 addInitScript 在頁面中包裝 document.cookie 的 setter（只在這個
// 實測腳本中，擴充功能不會這樣做），記錄寫入 PREF 的值與呼叫來源；同時記錄回應標頭中的 Set-Cookie: PREF。
// 不載入擴充功能；遇到驗證頁就結束。
//   node spikes/T06b/probe-pref-writer.mjs
//   OPEN_MENU=1 node spikes/T06b/probe-pref-writer.mjs   # 換頁前先打開 ⋮ 設定選單
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const context = await browser.newContext({ colorScheme: 'light', locale: 'en-US', viewport: { width: 1280, height: 900 } });
await context.addCookies([{ name: 'PREF', value: process.env.INITIAL_PREF ?? 'f6=80000', domain: '.youtube.com', path: '/' }]);
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
        const stack = (new Error().stack ?? '').split('\n').slice(2, 5).map((l) => l.trim().replace(/https:\/\/www\.youtube\.com\/s\/[^ )]*\/([^/ )]+)/, '$1')).join(' < ');
        window.__prefWrites.push({ t: Math.round(performance.now()), value: String(v).split(';')[0], from: stack });
      }
      desc.set.call(this, v);
    },
  });
});
const page = await context.newPage();
page.on('response', async (res) => {
  try {
    const headers = await res.headersArray();
    for (const h of headers) {
      if (h.name.toLowerCase() === 'set-cookie' && /(^|\n)PREF=/.test(h.value)) {
        console.log('Set-Cookie PREF from', new URL(res.url()).pathname, h.value.split(';')[0]);
      }
    }
  } catch {}
});

await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) {
  console.log('verification page; stopping', page.url());
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(6000);
console.log('writes during load', JSON.stringify(await page.evaluate(() => window.__prefWrites)));

// 模擬擴充功能的寫入（深色）
await page.evaluate(() => {
  document.cookie = 'PREF=f6=400&tz=UTC; domain=.youtube.com; path=/; max-age=34560000; secure; samesite=lax';
  document.documentElement.setAttribute('dark', '');
  window.__prefWrites = [];
});
if (process.env.OPEN_MENU) {
  // 先打開 ⋮ 設定選單再關閉（與 probe-instant.mjs 的步驟相同）
  await page.locator('ytd-topbar-menu-button-renderer button, #buttons button[aria-label="Settings"]').first().click();
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  console.log('after opening the settings menu', JSON.stringify(await page.evaluate(() => ({ pref: document.cookie.split('; ').find((c) => c.startsWith('PREF=')), writes: window.__prefWrites }))));
}
if (process.env.WAIT) await page.waitForTimeout(Number(process.env.WAIT));
for (const sel of ['a[href^="/shorts"]', 'a[href="/feed/you"]', 'a[href="/"]']) {
  const link = page.locator(`ytd-guide-entry-renderer ${sel}, ytd-mini-guide-entry-renderer ${sel}`).first();
  if (!(await link.count())) {
    console.log('no link', sel);
    continue;
  }
  await link.click();
  await page.waitForTimeout(5000);
  console.log(`after navigating via ${sel}`, location(), JSON.stringify(await page.evaluate(() => ({ url: location.pathname, pref: document.cookie.split('; ').find((c) => c.startsWith('PREF=')), writes: window.__prefWrites }))));
  await page.evaluate(() => (window.__prefWrites = []));
}
function location() {
  return '';
}
await browser.close();

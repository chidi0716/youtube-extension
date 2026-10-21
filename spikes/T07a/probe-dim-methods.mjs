// T07a 實測：右側欄縮圖在 #secondary 設 opacity 後截圖仍偏亮。比較幾種調暗方式下，同一張縮圖
// 實際畫出來的平均亮度（截圖後在空白頁以 canvas 計算），找出能把縮圖也確實調暗的做法。
// 不載入擴充功能（直接在頁面上套用樣式）。從首頁以站內換頁進入觀看頁；只嘗試一次，遇到驗證頁就結束。
//   node spikes/T07a/probe-dim-methods.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1400, height: 1000 } });
const page = await context.newPage();
const stop = async (why) => {
  console.log(`${why}; stopping`, page.url());
  await browser.close();
  process.exit(2);
};
await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) await stop('verification page');
await page.waitForTimeout(5000);
const box = page.locator('input[name="search_query"]').first();
await box.click();
await box.fill('me at the zoo');
await box.press('Enter');
await page.waitForTimeout(5000);
await page.locator('ytd-video-renderer a#thumbnail[href^="/watch"]').first().click();
await page.waitForTimeout(8000);
await page.mouse.move(500, 400);

const rect = await page.evaluate(() => {
  const sr = document.querySelector('ytd-watch-flexy #secondary').getBoundingClientRect();
  const img = document.elementFromPoint(sr.left + sr.width / 4, sr.top + 100)?.closest('yt-thumbnail-view-model, ytd-thumbnail') ?? null;
  const r = (img ?? document.querySelector('ytd-watch-flexy #secondary')).getBoundingClientRect();
  return { x: Math.round(r.left) + 4, y: Math.round(r.top) + 4, width: Math.max(20, Math.round(r.width) - 8), height: Math.max(20, Math.round(r.height) - 8) };
});
console.log('thumbnail rect', JSON.stringify(rect));

const helper = await context.newPage();
const brightness = async () => {
  const png = await page.screenshot({ clip: rect });
  return helper.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return Math.round((sum / (d.length / 4)) * 10) / 10;
  }, png.toString('base64'));
};

const methods = {
  none: '',
  'opacity on #secondary': 'ytd-watch-flexy #secondary { opacity: 0.07 !important; }',
  'opacity on #secondary-inner': 'ytd-watch-flexy #secondary-inner { opacity: 0.07 !important; }',
  'opacity on #secondary without view-transition-name':
    'ytd-watch-flexy #secondary { opacity: 0.07 !important; view-transition-name: none !important; }',
  'filter brightness on #secondary': 'ytd-watch-flexy #secondary { filter: brightness(0.07) !important; }',
  'opacity + filter on #secondary': 'ytd-watch-flexy #secondary { opacity: 0.07 !important; filter: brightness(0.5) !important; }',
};
for (const [name, css] of Object.entries(methods)) {
  await page.evaluate((css) => {
    let s = document.getElementById('__probe-dim');
    if (!s) {
      s = document.createElement('style');
      s.id = '__probe-dim';
      document.head.append(s);
    }
    s.textContent = `html, body, ytd-app { background: #000 !important; } ${css}`;
  }, css);
  await page.waitForTimeout(600);
  console.log(`${name.padEnd(55)} mean luminance ${await brightness()}`);
}
await browser.close();

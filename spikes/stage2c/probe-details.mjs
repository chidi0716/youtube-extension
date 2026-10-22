// 階段 2c 實測（第二次）：補充觀察
// - 左側導覽與迷你導覽中 Shorts 入口的內部結構（找出不依賴顯示文字的辨識方式）；
// - 搜尋結果中個別 Shorts 項目（ytd-video-renderer）的結構；
// - 觀看頁播放器內 .ytp-fullscreen-grid 的結構與顯示狀態。
// 不載入擴充功能。只嘗試一次，遇到驗證頁就結束，不嘗試繞過。
//   node spikes/stage2c/probe-details.mjs > spikes/stage2c/results-details.txt
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const context = await browser.newContext({ locale: process.env.LOCALE ?? 'en-US', viewport: { width: 1400, height: 1000 } });
const page = await context.newPage();
const stop = async (why) => {
  console.log(`${why}; stopping`, page.url());
  await browser.close();
  process.exit(2);
};
const blocked = async () => /unusual traffic|not a robot/i.test(await page.evaluate(() => document.body.innerText.slice(0, 5000)));

await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) await stop('verification page');
await page.waitForTimeout(5000);

const outline = (el, depth = 0, max = 4) => {
  // 在頁面中執行的函式不能參考外部變數，所以這裡只是說明用途；實際在 evaluate 內重寫。
  return [el, depth, max];
};
void outline;

console.log('== guide entries (inner structure of the 2nd entry and its neighbours)');
console.log(
  await page.evaluate(() => {
    const desc = (e, depth, max) => {
      if (!e || depth > max) return '';
      const attrs = [...e.attributes].filter((a) => a.name !== 'style').map((a) => `${a.name}${a.value ? '=' + a.value.slice(0, 50) : ''}`).join(' ');
      const kids = [...e.children].map((c) => desc(c, depth + 1, max)).filter(Boolean).join('');
      return `${'  '.repeat(depth)}<${e.tagName.toLowerCase()} ${attrs}>\n${kids}`;
    };
    const entries = [...document.querySelectorAll('ytd-guide-entry-renderer')].slice(0, 3);
    return entries.map((e) => desc(e, 0, 7)).join('\n----\n');
  }),
);

console.log('\n== mini guide entries');
console.log(
  await page.evaluate(() =>
    [...document.querySelectorAll('ytd-mini-guide-entry-renderer')]
      .map((e) => {
        const a = e.querySelector('a');
        return `${[...e.attributes].map((x) => `${x.name}=${x.value.slice(0, 40)}`).join(' ')} | a: ${a ? [...a.attributes].map((x) => `${x.name}=${x.value.slice(0, 40)}`).join(' ') : '-'}`;
      })
      .join('\n'),
  ),
);

const box = page.locator('input[name="search_query"]').first();
await box.click();
await box.fill(process.env.QUERY ?? 'funny cats shorts');
await box.press('Enter');
await page.waitForTimeout(6000);
if (await blocked()) await stop('verification page');

console.log('\n== search: individual shorts in ytd-video-renderer');
console.log(
  await page.evaluate(() => {
    const r = [...document.querySelectorAll('ytd-video-renderer')].find((v) => v.querySelector('a#thumbnail[href^="/shorts/"]'));
    if (!r) return 'none';
    const links = [...r.querySelectorAll('a[href^="/shorts/"]')].map((a) => `${a.id || a.className.split(' ')[0]}`);
    const overlays = [...r.querySelectorAll('[overlay-style], ytd-thumbnail-overlay-time-status-renderer, badge-shape')]
      .map((o) => `${o.tagName.toLowerCase()} overlay-style=${o.getAttribute('overlay-style')}`)
      .slice(0, 4);
    return `attrs=[${[...r.attributes].map((x) => x.name).join(',')}] links=${links.join(',')} overlays=${overlays.join(' | ')} parent=${r.parentElement?.tagName.toLowerCase()}`;
  }),
);

const link = page.locator('ytd-video-renderer a#thumbnail[href^="/watch"]').first();
if (!(await link.count())) await stop('no video in search results');
await link.click();
await page.waitForTimeout(8000);
if (await blocked()) await stop('verification page');
if ((await page.locator('ytd-watch-flexy').count()) === 0) await stop('no watch page');

console.log('\n== watch: .ytp-fullscreen-grid structure', page.url());
console.log(
  await page.evaluate(() => {
    const desc = (e, depth, max) => {
      if (!e || depth > max) return '';
      const s = getComputedStyle(e);
      const cls = typeof e.className === 'string' ? e.className : '';
      const kids = [...e.children].slice(0, 4).map((c) => desc(c, depth + 1, max)).filter(Boolean).join('');
      return `${'  '.repeat(depth)}<${e.tagName.toLowerCase()} class="${cls.slice(0, 90)}"> display=${s.display} children=${e.children.length}\n${kids}`;
    };
    const grid = document.querySelector('.ytp-fullscreen-grid');
    const player = document.querySelector('#movie_player');
    return `player class: ${player?.className}\n${desc(grid, 0, 4)}`;
  }),
);

await browser.close();

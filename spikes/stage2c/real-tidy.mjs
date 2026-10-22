// T30 實測：在真實的 YouTube 首頁與搜尋頁上（載入擴充功能的建置），開啟「隱藏 Shorts」「顯示完整影片標題」
// 「停用縮圖自動預覽」，確認 utils/youtube/dom.ts 的選擇器在目前的頁面上有作用。
// 只載入首頁一次、站內搜尋一次，遇到驗證頁就結束，不嘗試繞過。截圖含第三方內容，只存在 .cache/。
//   npm run build && node spikes/stage2c/real-tidy.mjs > spikes/stage2c/results-real-tidy.txt
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const cache = join(here, '.cache');
const profile = join(cache, 'profile-real-tidy');
rmSync(profile, { recursive: true, force: true });
mkdirSync(profile, { recursive: true });
const EXT_ID = 'bkjlangdjfpllnkcpfpdlajchbginjdj';

const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  locale: 'en-US',
  viewport: { width: 1400, height: 1000 },
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
  args: [`--disable-extensions-except=${join(root, '.output', 'chrome-mv3')}`, `--load-extension=${join(root, '.output', 'chrome-mv3')}`],
});
const page = context.pages()[0] ?? (await context.newPage());
const stop = async (why) => {
  console.log(`${why}; stopping`, page.url());
  await context.close();
  process.exit(2);
};
const blocked = async () => /unusual traffic|not a robot/i.test(await page.evaluate(() => document.body.innerText.slice(0, 5000)));

// 設定頁開啟三個只靠樣式的選項
const options = await context.newPage();
await options.goto(`chrome-extension://${EXT_ID}/options.html`);
await options.waitForFunction(() => [...document.querySelectorAll('#tidy-groups input')].every((i) => !i.disabled));
const state = (on) => options.evaluate((on) => chrome.storage.sync.set({ tidyHideShorts: on, tidyFullTitles: on, tidyNoThumbnailPreview: on }), on);
await state(false);

const measure = () =>
  page.evaluate(() => {
    const vis = (el) => el.getClientRects().length > 0;
    const titles = [...document.querySelectorAll('#video-title, .ytLockupMetadataViewModelTitle')].filter(vis);
    return {
      html: document.documentElement.className,
      shortsLinksVisible: [...document.querySelectorAll('a[href^="/shorts/"]')].filter(vis).length,
      shortsShelvesVisible: [...document.querySelectorAll('grid-shelf-view-model, ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]')].filter(vis).length,
      guideShortsVisible: [...document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')].filter((e) => vis(e) && /^\s*Shorts\s*$/.test(e.textContent)).length,
      titles: titles.length,
      truncatedTitles: titles.filter((t) => t.scrollHeight > t.clientHeight + 1).length,
      maxTitleHeight: Math.max(0, ...titles.map((t) => Math.round(t.getBoundingClientRect().height))),
    };
  });

await page.bringToFront();
await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) await stop('verification page');
await page.waitForTimeout(5000);
console.log('home, options off:', JSON.stringify(await measure()));
await state(true);
await page.waitForTimeout(800);
console.log('home, options on :', JSON.stringify(await measure()));

const box = page.locator('input[name="search_query"]').first();
await box.click();
await box.fill(process.env.QUERY ?? 'cat videos');
await box.press('Enter');
await page.waitForTimeout(6000);
if (await blocked()) await stop('verification page');
console.log('search, options on :', JSON.stringify(await measure()));
await page.screenshot({ path: join(cache, 'real-search-on.png') });
await state(false);
await page.waitForTimeout(800);
console.log('search, options off:', JSON.stringify(await measure()));
await page.screenshot({ path: join(cache, 'real-search-off.png') });

// 縮圖預覽：開啟選項後，游標停在第一個影片的縮圖上
await state(true);
await page.waitForTimeout(500);
const thumb = page.locator('ytd-video-renderer a#thumbnail[href^="/watch"]').first();
if (await thumb.count()) {
  await thumb.hover();
  await page.waitForTimeout(3000);
  console.log(
    'search hover with preview off:',
    JSON.stringify(
      await page.evaluate(() => {
        const prev = document.querySelector('ytd-app > #video-preview');
        return { previewExists: !!prev, previewVisible: !!prev && prev.getClientRects().length > 0, display: prev ? getComputedStyle(prev).display : null };
      }),
    ),
  );
}
await context.close();

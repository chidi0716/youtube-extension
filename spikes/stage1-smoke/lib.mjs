// 本機假觀看頁測試共用的工具：啟動載入擴充功能的 Chromium、以 route 提供假頁面與測試影片。
// 瀏覽器對 www.youtube.com 的請求全部由本機檔案回應，其他網址一律拒絕，不會連外。
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
export const root = join(here, '..', '..');
export const extDir = join(root, '.output', 'chrome-mv3');
export const shots = process.env.SHOTS ?? join(root, 'specs', 'notes', 'screenshots');
export const EXT_ID = 'bkjlangdjfpllnkcpfpdlajchbginjdj';
export const WATCH = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
mkdirSync(shots, { recursive: true });

const fixture = readFileSync(join(here, 'fixtures', 'watch.html'), 'utf8');
const video = readFileSync(join(here, 'fixtures', 'test.webm'));
const thumb = readFileSync(join(here, 'fixtures', 'thumb.jpg'));

export async function launch({ lang = 'en-US', name = 'fixture', viewport = { width: 1280, height: 900 }, colorScheme } = {}) {
  const profile = join(here, '.cache', `profile-${name}-${lang}`);
  rmSync(profile, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    // HEADED=1 時以有視窗的模式執行（搭配 xvfb-run），切換分頁才會改變 document.visibilityState。
    headless: !process.env.HEADED,
    locale: lang,
    viewport,
    ...(colorScheme ? { colorScheme } : {}),
    args: [
      `--lang=${lang}`,
      `--disable-extensions-except=${extDir}`,
      `--load-extension=${extDir}`,
      // 讓測試影片可以在沒有使用者操作時播放。
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === 'chrome-extension:') return route.continue();
    if (url.hostname === 'www.youtube.com' && url.pathname === '/__fixture/test.webm') {
      // 支援 Range 請求，瀏覽器才能跳轉到還沒下載的位置。
      const range = /bytes=(\d*)-(\d*)/.exec(route.request().headers()['range'] ?? '');
      if (!range) {
        return route.fulfill({
          status: 200,
          contentType: 'video/webm',
          headers: { 'Accept-Ranges': 'bytes' },
          body: video,
        });
      }
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), video.length - 1) : video.length - 1;
      return route.fulfill({
        status: 206,
        contentType: 'video/webm',
        headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${video.length}` },
        body: video.subarray(start, end + 1),
      });
    }
    if (url.hostname === 'www.youtube.com') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: fixture });
    }
    // 純音訊模式的縮圖：以測試影片的一格畫面代替。
    if (url.hostname === 'i.ytimg.com' && /^\/vi\/[A-Za-z0-9_-]{11}\/hqdefault\.jpg$/.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'image/jpeg', body: thumb });
    }
    return route.abort();
  });
  return context;
}

export function reporter() {
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok: !!ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  };
  /** 本環境無法驗證的項目：列出但不算通過或失敗。 */
  const skip = (name, detail = '') => {
    console.log(`SKIP  ${name}${detail ? `  (${detail})` : ''}`);
  };
  const summary = () => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    return failed.length === 0;
  };
  return { check, skip, summary, results };
}

/** 等工具列出現並把它與 toolbar 內的按鈕準備好。 */
export async function openWatch(page, url = WATCH) {
  await page.goto(url);
  await page.waitForSelector('yte-toolbar', { state: 'attached', timeout: 10_000 });
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1, null, { timeout: 10_000 });
}

export const button = (page, id) => page.locator(`yte-toolbar .yte-btn[data-button="${id}"]`);

export async function pressed(page, id) {
  return page.evaluate((id) => {
    const b = document.querySelector('yte-toolbar').shadowRoot.querySelector(`.yte-btn[data-button="${id}"]`);
    return { pressed: b.getAttribute('aria-pressed'), on: b.hasAttribute('data-on'), disabled: b.getAttribute('aria-disabled') };
  }, id);
}

/** 截圖：裁到指定的視窗區域（預設為播放器到工具列下方）。 */
export async function shot(page, name, clip) {
  const area =
    clip ??
    (await page.evaluate(() => {
      const p = document.querySelector('#player').getBoundingClientRect();
      const t = document.querySelector('yte-toolbar')?.getBoundingClientRect() ?? p;
      const panel = document.querySelector('yte-toolbar')?.shadowRoot.querySelector('.yte-panel')?.getBoundingClientRect();
      const top = Math.max(0, Math.min(p.top, t.top) - 16);
      const bottom = Math.max(p.bottom, t.bottom + 40, panel ? panel.bottom + 16 : 0);
      return { x: 0, y: top, width: Math.ceil(Math.max(p.right, t.right) + 24), height: Math.ceil(Math.min(window.innerHeight, bottom) - top) };
    }));
  await page.screenshot({ path: join(shots, name), clip: area });
}

export const viewportShot = (page, name) => page.screenshot({ path: join(shots, name) });

export async function spaNavigate(page, linkId = 'next') {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator(`#${linkId}`).click();
  await page.waitForTimeout(400);
}

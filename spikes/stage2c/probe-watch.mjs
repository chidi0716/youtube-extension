// 階段 2b／2c 實測：從 YouTube 首頁以站內搜尋與點擊進入觀看頁（直接載入觀看頁在本環境會被驗證頁擋住），
// 觀察：
// - 搜尋頁：Shorts 區塊的上層結構、左側導覽 Shorts 入口的標記、縮圖預覽元素的位置、標題內層元素的樣式；
// - 觀看頁：播放器上與畫質、語音軌相關的方法與回傳值，片尾元素、彈出對話框的容器，推薦清單的結構。
// 不載入擴充功能。只嘗試一次，遇到驗證頁就結束，不嘗試繞過。
//   QUERY='…' node spikes/stage2c/probe-watch.mjs > spikes/stage2c/results-watch.txt
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '.cache');
mkdirSync(cache, { recursive: true });

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
const blocked = async () => /unusual traffic|not a robot/i.test(await page.evaluate(() => document.body.innerText.slice(0, 5000)));

await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) await stop('verification page');
await page.waitForTimeout(5000);

// 左側導覽的 Shorts 入口（展開的導覽與收合的迷你導覽）
console.log('== guide shorts entry');
console.log(
  await page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')) {
      if (!/shorts/i.test(e.textContent)) continue;
      const a = e.querySelector('a');
      out.push(
        `${e.tagName.toLowerCase()} attrs=[${[...e.attributes].map((x) => x.name).join(',')}] a.attrs=[${a ? [...a.attributes].map((x) => `${x.name}=${x.value.slice(0, 60)}`).join(' ') : ''}] endpoint=${JSON.stringify(e.data?.navigationEndpoint ?? e.data?.serviceEndpoint ?? null)?.slice(0, 300)}`,
      );
    }
    return out.join('\n');
  }),
);

const box = page.locator('input[name="search_query"]').first();
await box.click();
await box.fill(process.env.QUERY ?? 'cat videos');
await box.press('Enter');
await page.waitForTimeout(6000);
if (await blocked()) await stop('verification page');

console.log('\n== search: shorts shelf ancestors');
console.log(
  await page.evaluate(() => {
    const shelf = document.querySelector('grid-shelf-view-model');
    const out = [];
    for (let e = shelf; e && e !== document.body && out.length < 10; e = e.parentElement) {
      out.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} attrs=[${[...e.attributes].map((x) => x.name).join(',')}]`);
    }
    const sec = shelf?.closest('ytd-item-section-renderer');
    return `${out.join('\n  < ')}\n  section children: ${sec ? [...sec.querySelector('#contents').children].map((c) => c.tagName.toLowerCase()).join(', ') : '-'}\n  grid-shelf attrs: ${shelf ? [...shelf.attributes].map((x) => `${x.name}=${x.value.slice(0, 80)}`).join(' ') : '-'}`;
  }),
);

console.log('\n== search: other result types containing /shorts/ links');
console.log(
  await page.evaluate(() => {
    const kinds = new Map();
    for (const a of document.querySelectorAll('a[href^="/shorts/"]')) {
      const item = a.closest('ytd-video-renderer, ytd-reel-item-renderer, ytm-shorts-lockup-view-model, yt-lockup-view-model, ytd-rich-item-renderer');
      const k = item?.tagName.toLowerCase() ?? 'none';
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }
    return JSON.stringify([...kinds]);
  }),
);

console.log('\n== search: title inner styles');
console.log(
  await page.evaluate(() => {
    const out = [];
    for (const sel of ['ytd-video-renderer a#video-title', 'yt-lockup-view-model h3 a', 'ytm-shorts-lockup-view-model h3']) {
      const el = document.querySelector(sel);
      if (!el) {
        out.push(`${sel}: none`);
        continue;
      }
      const desc = (e) => {
        const s = getComputedStyle(e);
        return `${e.tagName.toLowerCase()}.${typeof e.className === 'string' ? e.className.split(/\s+/).slice(0, 3).join('.') : ''} clamp=${s.webkitLineClamp} display=${s.display} overflow=${s.overflow} maxH=${s.maxHeight} h=${e.getBoundingClientRect().height}`;
      };
      out.push(`${sel}: ${desc(el)}\n    child: ${el.firstElementChild ? desc(el.firstElementChild) : '-'}\n    parent: ${desc(el.parentElement)}`);
    }
    return out.join('\n');
  }),
);

// 縮圖預覽元素的位置
const thumb = page.locator('ytd-video-renderer a#thumbnail[href^="/watch"]').first();
if (await thumb.count()) {
  await thumb.hover();
  await page.waitForTimeout(3000);
  console.log('\n== search: preview ancestors');
  console.log(
    await page.evaluate(() => {
      const prev = document.querySelector('#video-preview');
      const out = [];
      for (let e = prev; e && e !== document.body && out.length < 6; e = e.parentElement) {
        out.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}`);
      }
      const inner = prev?.firstElementChild;
      const moving = document.querySelectorAll('ytd-moving-thumbnail-renderer, #mouseover-overlay > *').length;
      return `${out.join(' < ')}\n  first child: ${inner ? inner.tagName.toLowerCase() : '-'}\n  moving thumbnails: ${moving}`;
    }),
  );
  await page.mouse.move(5, 5);
}

const link = page.locator('ytd-video-renderer a#thumbnail[href^="/watch"]').first();
if (!(await link.count())) await stop('no video in search results');
await link.click();
await page.waitForTimeout(8000);
if (await blocked()) await stop('verification page');
if ((await page.locator('ytd-watch-flexy').count()) === 0) await stop('no watch page');

console.log('\n== watch', page.url());
console.log(
  await page.evaluate(() => {
    const p = document.querySelector('#movie_player');
    if (!p) return 'no #movie_player';
    const names = new Set();
    for (let o = p; o && o !== HTMLElement.prototype; o = Object.getPrototypeOf(o)) {
      for (const n of Object.getOwnPropertyNames(o)) {
        try {
          if (typeof p[n] === 'function' && /quality|audio|track|lang/i.test(n)) names.add(n);
        } catch {}
      }
    }
    const call = (n, ...args) => {
      try {
        return typeof p[n] === 'function' ? JSON.stringify(p[n](...args))?.slice(0, 800) : 'n/a';
      } catch (e) {
        return `throws ${e}`;
      }
    };
    const v = document.querySelector('#movie_player video');
    return [
      `methods: ${[...names].sort().join(', ')}`,
      `getAvailableQualityLevels: ${call('getAvailableQualityLevels')}`,
      `getPlaybackQuality: ${call('getPlaybackQuality')}`,
      `getAvailableQualityData: ${call('getAvailableQualityData')}`,
      `getPlaybackQualityLabel: ${call('getPlaybackQualityLabel')}`,
      `getAvailableAudioTracks: ${call('getAvailableAudioTracks')}`,
      `getAudioTrack: ${call('getAudioTrack')}`,
      `video: readyState=${v?.readyState} duration=${v?.duration} paused=${v?.paused}`,
      `error text: ${document.querySelector('.ytp-error')?.textContent?.trim().slice(0, 120) ?? '-'}`,
    ].join('\n');
  }),
);

console.log('\n== watch: player overlay elements');
console.log(
  await page.evaluate(() => {
    const sels = [
      '.ytp-ce-element',
      '.ytp-ce-video',
      '.ytp-ce-channel',
      '.ytp-endscreen-content',
      '.html5-endscreen',
      '.ytp-autonav-endscreen',
      '.ytp-autonav-endscreen-countdown-overlay',
      '.ytp-cards-teaser',
      '.ytp-cards-button',
      '.ytp-suggestion-set',
      '.ytp-fullscreen-grid',
      '.ytp-videowall-still',
    ];
    const p = document.querySelector('#movie_player');
    const top = p ? [...p.children].map((c) => `${c.tagName.toLowerCase()}.${typeof c.className === 'string' ? c.className.split(/\s+/).slice(0, 2).join('.') : ''}`) : [];
    return `${sels.map((s) => `${s}: ${document.querySelectorAll(s).length}`).join('\n')}\nplayer children: ${top.join(', ')}`;
  }),
);

console.log('\n== watch: popup container and secondary');
console.log(
  await page.evaluate(() => {
    const pc = document.querySelector('ytd-popup-container');
    const sec = document.querySelector('ytd-watch-flexy #secondary #related, ytd-watch-flexy #related');
    const kinds = new Map();
    for (const c of sec?.querySelectorAll('ytd-item-section-renderer #contents > *, ytd-watch-next-secondary-results-renderer #items > *') ?? []) {
      const k = c.tagName.toLowerCase();
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }
    const shortsInRelated = sec?.querySelectorAll('a[href^="/shorts/"]').length ?? 0;
    const shelf = sec?.querySelector('a[href^="/shorts/"]');
    const chain = [];
    for (let e = shelf; e && e !== sec && chain.length < 10; e = e.parentElement) chain.push(e.tagName.toLowerCase());
    return `popup container: ${pc ? `${pc.tagName.toLowerCase()} parent=${pc.parentElement?.tagName.toLowerCase()} children=${pc.children.length}` : 'none'}\nrelated kinds: ${JSON.stringify([...kinds])}\nshorts links in related: ${shortsInRelated}\nfirst shorts chain: ${chain.join(' < ')}`;
  }),
);

await browser.close();

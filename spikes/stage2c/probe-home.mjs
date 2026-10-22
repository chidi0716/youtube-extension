// 階段 2c 實測：觀察 YouTube 首頁與搜尋結果頁（未登入、不載入擴充功能）的公開結構，
// 找出 Shorts 區塊與項目、左側導覽的 Shorts 入口、影片標題的截斷方式、縮圖自動預覽的元素。
// YouTube 顯示驗證頁時直接結束，不嘗試繞過。只載入首頁一次、站內搜尋一次。
//   node spikes/stage2c/probe-home.mjs > spikes/stage2c/results-home.txt
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

const describeShorts = () =>
  page.evaluate(() => {
    const tag = (el) => {
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((c) => c && c !== 'style-scope').slice(0, 3).join('.') : '';
      const attrs = ['is-shorts', 'is-reel', 'is-slim-media', 'page-subtype', 'is-show-less-hidden', 'hidden']
        .filter((a) => el.hasAttribute?.(a))
        .map((a) => `[${a}]`)
        .join('');
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}${attrs}`;
    };
    const chain = (el, stopAt) => {
      const out = [];
      for (let e = el; e && e !== document.body && out.length < 14; e = e.parentElement) {
        out.push(tag(e));
        if (stopAt && e.matches(stopAt)) break;
      }
      return out.join(' < ');
    };
    const links = [...document.querySelectorAll('a[href^="/shorts"]')];
    const chains = new Map();
    for (const a of links) {
      const c = chain(a, '#contents, ytd-section-list-renderer, ytd-guide-renderer, ytd-mini-guide-renderer');
      chains.set(c, (chains.get(c) ?? 0) + 1);
    }
    return {
      url: location.href,
      shortsLinks: links.length,
      chains: [...chains.entries()].map(([c, n]) => `${n}x ${c}`),
    };
  });

const describeTitles = () =>
  page.evaluate(() => {
    const seen = new Map();
    const candidates = document.querySelectorAll(
      '#video-title, a#video-title-link, .yt-lockup-metadata-view-model__title, h3 a, yt-formatted-string#video-title',
    );
    for (const el of candidates) {
      const s = getComputedStyle(el);
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((c) => c && c !== 'style-scope').slice(0, 4).join('.') : '';
      const container = el.closest(
        'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model, ytd-grid-video-renderer, ytd-reel-item-renderer',
      );
      const key = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''} in ${container?.tagName.toLowerCase() ?? '?'}`;
      if (seen.has(key)) continue;
      const parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
      seen.set(key, {
        clamp: s.webkitLineClamp,
        display: s.display,
        overflow: s.overflow,
        maxHeight: s.maxHeight,
        textOverflow: s.textOverflow,
        whiteSpace: s.whiteSpace,
        parentTag: el.parentElement?.tagName.toLowerCase(),
        parentClamp: parent?.webkitLineClamp,
        parentMaxHeight: parent?.maxHeight,
        truncated: el.scrollHeight > el.clientHeight + 1,
      });
    }
    return [...seen.entries()].map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  });

const describeGuide = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')].slice(0, 12).map((e) => {
      const a = e.querySelector('a');
      return `${e.tagName.toLowerCase()} href=${a?.getAttribute('href')} title=${a?.getAttribute('title')} text=${e.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)}`;
    }),
  );

await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) await stop('verification page');
await page.waitForTimeout(6000);
console.log('== home');
console.log(JSON.stringify(await describeShorts(), null, 2));
console.log('titles:\n  ' + (await describeTitles()).join('\n  '));
console.log('guide:\n  ' + (await describeGuide()).join('\n  '));
console.log('home feed items:', await page.evaluate(() => document.querySelectorAll('ytd-rich-item-renderer').length));

// 站內搜尋一次
const box = page.locator('input[name="search_query"]').first();
await box.click();
await box.fill(process.env.QUERY ?? 'cat videos');
await box.press('Enter');
await page.waitForTimeout(6000);
if (/unusual traffic|not a robot/i.test(await page.evaluate(() => document.body.innerText.slice(0, 5000)))) await stop('verification page');
console.log('\n== search');
console.log(JSON.stringify(await describeShorts(), null, 2));
console.log('titles:\n  ' + (await describeTitles()).join('\n  '));

// 縮圖自動預覽：游標停在第一個一般影片的縮圖上，觀察出現的元素
const thumb = page.locator('ytd-video-renderer a#thumbnail[href^="/watch"]').first();
if (await thumb.count()) {
  await thumb.hover();
  await page.waitForTimeout(4000);
  const preview = await page.evaluate(() => {
    const vids = [...document.querySelectorAll('video')].map((v) => {
      const chain = [];
      for (let e = v; e && e !== document.body && chain.length < 10; e = e.parentElement) chain.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}`);
      const r = v.getBoundingClientRect();
      return `${chain.join(' < ')} paused=${v.paused} rect=${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    });
    const prev = document.querySelector('ytd-video-preview, #video-preview');
    const s = prev ? getComputedStyle(prev) : null;
    return {
      videos: vids,
      previewEl: prev
        ? `${prev.tagName.toLowerCase()}#${prev.id} hidden=${prev.hasAttribute('hidden')} active=${prev.hasAttribute('active')} display=${s.display} attrs=${[...prev.attributes].map((a) => a.name).join(',')}`
        : null,
      thumbAttrs: (() => {
        const t = document.querySelector('ytd-video-renderer ytd-thumbnail');
        return t ? [...t.attributes].map((a) => a.name).join(',') : null;
      })(),
    };
  });
  console.log('hover preview:', JSON.stringify(preview, null, 2));
  await page.screenshot({ path: join(cache, 'search-hover.png') });
}

await browser.close();

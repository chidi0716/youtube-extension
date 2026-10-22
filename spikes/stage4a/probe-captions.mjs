// T21a 實測：從 YouTube 首頁以站內搜尋與點擊進入觀看頁（直接載入觀看頁會被驗證頁擋住），
// 觀察播放器影片資料中的字幕清單結構（欄位名稱、字幕網址的網域與參數名稱），並試著以頁面本身的 fetch
// 取得 fmt=vtt 的字幕，記錄回應的狀態與開頭。不載入擴充功能。只嘗試一次，遇到驗證頁就結束，不嘗試繞過。
//   QUERY='…' node spikes/stage4a/probe-captions.mjs > spikes/stage4a/results-captions.txt
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
const blocked = async () => /unusual traffic|not a robot/i.test(await page.evaluate(() => document.body.innerText.slice(0, 5000)));

await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) await stop('verification page');
await page.waitForTimeout(5000);
const box = page.locator('input[name="search_query"]').first();
await box.click();
await box.fill(process.env.QUERY ?? 'ted talk subtitles');
await box.press('Enter');
await page.waitForTimeout(6000);
if (await blocked()) await stop('verification page');
const link = page.locator('ytd-video-renderer a#thumbnail[href^="/watch"]').first();
if (!(await link.count())) await stop('no video in search results');
await link.click();
await page.waitForTimeout(8000);
if (await blocked()) await stop('verification page');
if ((await page.locator('ytd-watch-flexy').count()) === 0) await stop('no watch page');
console.log('watch', page.url());

const info = await page.evaluate(() => {
  const p = document.querySelector('#movie_player');
  const resp = p?.getPlayerResponse?.();
  const list = resp?.captions?.playerCaptionsTracklistRenderer;
  const keys = (o) => (o && typeof o === 'object' ? Object.keys(o) : []);
  const tracks = list?.captionTracks ?? [];
  return {
    playability: resp?.playabilityStatus?.status ?? null,
    hasCaptions: !!resp?.captions,
    captionsKeys: keys(resp?.captions),
    tracklistKeys: keys(list),
    trackCount: tracks.length,
    trackKeys: keys(tracks[0]),
    tracks: tracks.slice(0, 6).map((t) => {
      let url = null;
      try {
        const u = new URL(t.baseUrl, location.origin);
        url = { host: u.host, path: u.pathname, params: [...u.searchParams.keys()] };
      } catch {}
      return {
        languageCode: t.languageCode,
        kind: t.kind ?? null,
        vssId: t.vssId,
        name: t.name?.simpleText ?? t.name?.runs?.map((r) => r.text).join('') ?? null,
        isTranslatable: t.isTranslatable,
        url,
      };
    }),
    firstBaseUrl: tracks[0]?.baseUrl ?? null,
  };
});
const { firstBaseUrl, ...shown } = info;
console.log(JSON.stringify(shown, null, 2));

if (firstBaseUrl) {
  for (const fmt of ['vtt', null]) {
    const res = await page.evaluate(
      async ({ base, fmt }) => {
        const u = new URL(base, location.origin);
        if (fmt) u.searchParams.set('fmt', fmt);
        try {
          const r = await fetch(u.href, { credentials: 'include' });
          const text = await r.text();
          return { status: r.status, type: r.headers.get('content-type'), length: text.length, head: text.slice(0, 160) };
        } catch (e) {
          return { error: String(e) };
        }
      },
      { base: firstBaseUrl, fmt },
    );
    console.log(`fetch fmt=${fmt ?? '(default)'}:`, JSON.stringify(res));
  }
}
await browser.close();

// T06b 實測：在 YouTube 首頁用 YouTube 自己的「外觀」選單（未登入時在右上角 ⋮ 設定選單）切換
// 深色／淺色主題，記錄切換前後 <html>、<body>、ytd-app 的屬性差異，以及切換期間的屬性變動
// （MutationObserver）、是否重新載入、整頁背景色。不載入擴充功能；
// YouTube 顯示驗證頁時直接結束，不嘗試繞過。
//   node spikes/T06b/probe-menu-attrs.mjs
//   DEVICE=dark INITIAL_PREF=f6=400 OPTIONS="Light theme,Dark theme" node spikes/T06b/probe-menu-attrs.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const context = await browser.newContext({ colorScheme: process.env.DEVICE ?? 'light', locale: 'en-US', viewport: { width: 1280, height: 900 } });
if (process.env.INITIAL_PREF) {
  await context.addCookies([{ name: 'PREF', value: process.env.INITIAL_PREF, domain: '.youtube.com', path: '/' }]);
}
const page = await context.newPage();
let loads = 0;
page.on('load', () => loads++);

const snapshot = () =>
  page.evaluate(() => {
    const attrs = (el) =>
      el ? Object.fromEntries([...el.attributes].map((a) => [a.name, a.value.length > 80 ? a.value.slice(0, 80) + '…' : a.value])) : null;
    const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
    return {
      html: attrs(document.documentElement),
      body: attrs(document.body),
      ytdApp: attrs(document.querySelector('ytd-app')),
      masthead: attrs(document.querySelector('ytd-masthead')),
      bg: {
        html: bg(document.documentElement),
        body: bg(document.body),
        ytdApp: bg(document.querySelector('ytd-app')),
        masthead: bg(document.querySelector('ytd-masthead #background') ?? document.querySelector('ytd-masthead')),
      },
      baseBackground: getComputedStyle(document.documentElement).getPropertyValue('--yt-spec-base-background').trim(),
      textPrimary: getComputedStyle(document.documentElement).getPropertyValue('--yt-spec-text-primary').trim(),
      pref: document.cookie.split('; ').find((c) => c.startsWith('PREF=')) ?? null,
      darkAttrElements: document.querySelectorAll('[dark]').length,
      darkAttrTags: [...new Set([...document.querySelectorAll('[dark]')].map((e) => e.tagName.toLowerCase()))].slice(0, 30),
    };
  });

const diff = (a, b) => {
  const out = {};
  for (const k of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    if ((a ?? {})[k] !== (b ?? {})[k]) out[k] = [(a ?? {})[k] ?? '(none)', (b ?? {})[k] ?? '(none)'];
  }
  return out;
};

await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) {
  console.log('verification page; stopping', page.url());
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(5000);

// 記錄 <html>、<body>、ytd-app 上所有屬性變動，以及子樹中 dark 屬性的變動次數。
await page.evaluate(() => {
  window.__mutations = [];
  window.__subtreeDark = 0;
  const obs = new MutationObserver((list) => {
    for (const m of list) {
      const t = m.target;
      const who =
        t === document.documentElement ? 'html' : t === document.body ? 'body' : t.tagName.toLowerCase() === 'ytd-app' ? 'ytd-app' : null;
      if (who) window.__mutations.push({ t: Math.round(performance.now()), who, attr: m.attributeName, old: m.oldValue, now: t.getAttribute(m.attributeName) });
    }
  });
  obs.observe(document.documentElement, { attributes: true, attributeOldValue: true });
  obs.observe(document.body, { attributes: true, attributeOldValue: true });
  const app = document.querySelector('ytd-app');
  if (app) obs.observe(app, { attributes: true, attributeOldValue: true });
  new MutationObserver((list) => (window.__subtreeDark += list.length)).observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['dark'],
  });
});

let before = await snapshot();
console.log('initial', JSON.stringify(before, null, 1));

for (const option of (process.env.OPTIONS ?? 'Dark theme,Light theme,Dark theme').split(',')) {
  await page.locator('ytd-topbar-menu-button-renderer button, #buttons button[aria-label="Settings"]').first().click();
  await page.waitForTimeout(800);
  await page.locator('tp-yt-iron-dropdown').getByText(/^Appearance:/).first().click();
  await page.waitForTimeout(800);
  const item = page.locator('tp-yt-iron-dropdown').getByText(option, { exact: true }).first();
  if ((await item.count()) === 0) {
    console.log(`option "${option}" not in menu`);
    await page.keyboard.press('Escape');
    continue;
  }
  await page.evaluate(() => {
    window.__mutations = [];
    window.__subtreeDark = 0;
    window.__clickAt = Math.round(performance.now());
  });
  const loadsBefore = loads;
  await item.click();
  await page.waitForTimeout(3000);
  const after = await snapshot();
  const muts = await page.evaluate(() => ({
    list: window.__mutations?.map((m) => ({ ...m, dt: m.t - window.__clickAt })) ?? null,
    subtreeDark: window.__subtreeDark,
  }));
  console.log(`\n=== after "${option}" reloaded=${loads !== loadsBefore || muts.list === null}`);
  console.log('html diff', JSON.stringify(diff(before.html, after.html)));
  console.log('body diff', JSON.stringify(diff(before.body, after.body)));
  console.log('ytd-app diff', JSON.stringify(diff(before.ytdApp, after.ytdApp)));
  console.log('masthead diff', JSON.stringify(diff(before.masthead, after.masthead)));
  console.log('bg', JSON.stringify(after.bg), 'base', after.baseBackground, 'text', after.textPrimary);
  console.log('pref', after.pref, 'dark elements', after.darkAttrElements, JSON.stringify(after.darkAttrTags));
  console.log('mutations on html/body/ytd-app', JSON.stringify(muts.list));
  console.log('dark attribute mutations in subtree', muts.subtreeDark);
  before = after;
}
console.log('\nfinal', JSON.stringify(before.html));
await browser.close();

// T06d 實測：YouTube 首頁（未登入）頂端列的設定按鈕 → 設定選單 → 「外觀」子選單的 DOM 結構。
// 記錄每一層的 tag、屬性（不含長文字），找出不依顯示文字的辨識方式。
// 以英文與繁體中文介面各載入一次，比較結構是否相同。不載入擴充功能；遇到驗證頁就結束。
//   node spikes/T06d/probe-menu-structure.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});

/** 元素樹（只列出 tag、id、重要屬性與短文字），略過 svg 內部。 */
const dumpTree = (root, maxDepth = 14) =>
  root.evaluate((el, maxDepth) => {
    const out = [];
    const walk = (e, d) => {
      if (d > maxDepth) return;
      const attrs = [...e.attributes]
        .filter((a) => !['style', 'd'].includes(a.name))
        .map((a) => (a.value ? `${a.name}="${a.value.slice(0, 60)}"` : a.name));
      const ownText = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').slice(0, 40);
      const r = e.getBoundingClientRect();
      out.push(`${'  '.repeat(d)}${e.tagName.toLowerCase()} ${attrs.join(' ')}${ownText ? `  «${ownText}»` : ''}${r.width === 0 ? '  [hidden]' : ''}`);
      if (e.tagName.toLowerCase() === 'svg') return;
      for (const c of e.children) walk(c, d + 1);
    };
    walk(el, 0);
    return out.join('\n');
  }, maxDepth);

for (const [locale, hl] of [
  ['en-US', 'en'],
  ['zh-TW', 'zh-TW'],
]) {
  const context = await browser.newContext({ locale, viewport: { width: 1280, height: 900 } });
  await context.addCookies([{ name: 'PREF', value: `hl=${hl}&f6=80000`, domain: '.youtube.com', path: '/' }]);
  const page = await context.newPage();
  await page.goto(`https://www.youtube.com/?hl=${hl}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) {
    console.log('verification page; stopping', page.url());
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(5000);
  console.log(`\n######## ${locale}`);
  console.log('--- masthead #end / #buttons');
  console.log(await dumpTree(page.locator('ytd-masthead #end').first(), 6));

  // 設定按鈕：頂端列右側的選單按鈕
  await page.locator('ytd-masthead #end ytd-topbar-menu-button-renderer button').first().click();
  await page.waitForTimeout(1500);
  const dropdowns = await page.evaluate(() =>
    [...document.querySelectorAll('tp-yt-iron-dropdown')].map((d) => ({
      visible: d.getBoundingClientRect().height > 0 && getComputedStyle(d).display !== 'none',
      parent: d.parentElement?.tagName.toLowerCase(),
      attrs: [...d.attributes].map((a) => a.name).join(' '),
    })),
  );
  console.log('--- dropdowns', JSON.stringify(dropdowns));
  const popup = page.locator('ytd-popup-container tp-yt-iron-dropdown:visible').first();
  console.log('--- settings menu');
  console.log(await dumpTree(popup, 12));

  // 外觀項目：先看看有沒有專用的元件
  const candidates = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('ytd-popup-container *')].map((e) => e.tagName.toLowerCase()).filter((t) => /theme|appearance/.test(t)))],
  );
  console.log('--- theme-like tags in popup', JSON.stringify(candidates));
  const appearance = page.locator('ytd-popup-container ytd-toggle-theme-compact-link-renderer').first();
  if (await appearance.count()) {
    await appearance.click();
    await page.waitForTimeout(1500);
    console.log('--- after clicking the appearance item');
    console.log(await dumpTree(page.locator('ytd-popup-container tp-yt-iron-dropdown:visible').first(), 14));
  } else {
    console.log('no ytd-toggle-theme-compact-link-renderer');
  }
  await context.close();
}
await browser.close();

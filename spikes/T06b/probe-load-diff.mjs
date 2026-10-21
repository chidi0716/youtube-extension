// T06b 實測：比較 YouTube 首頁以深色（f6=400）與淺色（f6=80000）載入時，除了 <html dark> 以外
// 還有哪些差異：<html>/<body>/ytd-app 的 inline style（CSS 變數）、<style> 元素、樣式表連結，
// 以及各元素上的顏色相關 CSS 變數。不載入擴充功能；YouTube 顯示驗證頁時直接結束。
//   node spikes/T06b/probe-load-diff.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});

async function collect(pref) {
  const context = await browser.newContext({ colorScheme: 'light', locale: 'en-US', viewport: { width: 1280, height: 900 } });
  await context.addCookies([{ name: 'PREF', value: pref, domain: '.youtube.com', path: '/' }]);
  const page = await context.newPage();
  await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (new URL(page.url()).hostname !== 'www.youtube.com' || (await page.locator('ytd-app').count()) === 0) {
    console.log('verification page; stopping', page.url());
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(6000);
  const data = await page.evaluate(() => {
    const styleDecl = (el) => {
      const out = {};
      if (!el) return out;
      for (let i = 0; i < el.style.length; i++) {
        const p = el.style[i];
        out[p] = el.style.getPropertyValue(p).trim();
      }
      return out;
    };
    // 包含 inline style 的元素（只看 body 外層幾個主要元素與所有帶 dark 字樣屬性的元素）
    const themedAttrs = [];
    for (const el of document.querySelectorAll('*')) {
      for (const a of el.attributes) {
        if (/dark|theme|light/i.test(a.name)) themedAttrs.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} [${a.name}=${a.value.slice(0, 40)}]`);
      }
    }
    const counts = {};
    for (const t of themedAttrs) counts[t] = (counts[t] ?? 0) + 1;
    const styles = [...document.querySelectorAll('style')].map((s) => {
      const text = s.textContent ?? '';
      let h = 0;
      for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
      return `${s.id || '-'}:${s.getAttribute('nonce') ? 'n' : ''}:${text.length}:${h}`;
    });
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
    const appStyle = styleDecl(document.querySelector('ytd-app'));
    const cssVars = {};
    const cs = getComputedStyle(document.querySelector('ytd-app'));
    for (const name of ['--yt-spec-base-background', '--yt-spec-text-primary', '--yt-spec-general-background-a', '--yt-sys-color-baseline--base-background', '--yt-frosted-glass-desktop']) {
      cssVars[name] = cs.getPropertyValue(name).trim();
    }
    return {
      htmlStyle: styleDecl(document.documentElement),
      bodyStyle: styleDecl(document.body),
      appStyle,
      themedAttrs: counts,
      styles,
      links,
      cssVars,
      stylesheetsCount: document.styleSheets.length,
      adoptedCount: document.adoptedStyleSheets?.length ?? 0,
    };
  });
  await context.close();
  return data;
}

const dark = await collect('f6=400');
const light = await collect('f6=80000');

const diffObj = (a, b) => {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) out[k] = [a[k] ?? '(none)', b[k] ?? '(none)'];
  return out;
};
console.log('html inline style diff (dark, light)', JSON.stringify(diffObj(dark.htmlStyle, light.htmlStyle), null, 1));
console.log('body inline style diff', JSON.stringify(diffObj(dark.bodyStyle, light.bodyStyle)));
console.log('ytd-app inline style diff', JSON.stringify(diffObj(dark.appStyle, light.appStyle)));
console.log('theme-like attributes diff', JSON.stringify(diffObj(dark.themedAttrs, light.themedAttrs), null, 1));
console.log('<style> only in dark', JSON.stringify(dark.styles.filter((s) => !light.styles.includes(s))));
console.log('<style> only in light', JSON.stringify(light.styles.filter((s) => !dark.styles.includes(s))));
console.log('stylesheet links only in dark', JSON.stringify(dark.links.filter((s) => !light.links.includes(s))));
console.log('stylesheet links only in light', JSON.stringify(light.links.filter((s) => !dark.links.includes(s))));
console.log('counts dark', dark.stylesheetsCount, dark.adoptedCount, 'light', light.stylesheetsCount, light.adoptedCount);
console.log('css vars on ytd-app dark', JSON.stringify(dark.cssVars));
console.log('css vars on ytd-app light', JSON.stringify(light.cssVars));
console.log('html inline style property count dark', Object.keys(dark.htmlStyle).length, 'light', Object.keys(light.htmlStyle).length);
await browser.close();

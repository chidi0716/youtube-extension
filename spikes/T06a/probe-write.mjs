// T06a 實測：在真實 YouTube 首頁以 document.cookie 寫入修改後的 PREF（與擴充功能相同的字串格式），
// 重新載入後確認 YouTube 依新的偏好繪製，且沒有把 cookie 改回去。不載入擴充功能；
// YouTube 顯示驗證頁時直接結束，不嘗試繞過。
//   node spikes/T06a/probe-write.mjs
import { chromium } from 'playwright-core';

const COOKIE_ATTRS = 'domain=.youtube.com; path=/; max-age=34560000; secure; samesite=lax';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});

const cases = [
  { name: '深色 → 淺色', initial: 'f5=30000&f6=408&hl=en', write: 'f5=30000&f6=80008&hl=en', expectDark: false },
  { name: '淺色 → 深色', initial: 'f6=80000&hl=en', write: 'f6=400&hl=en', expectDark: true },
  { name: '未設定 → 深色', initial: 'hl=en', write: 'hl=en&f6=400', expectDark: true },
];

for (const c of cases) {
  const context = await browser.newContext({ locale: 'en-US' });
  await context.addCookies([{ name: 'PREF', value: c.initial, domain: '.youtube.com', path: '/', secure: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (new URL(page.url()).hostname !== 'www.youtube.com') {
    console.log('verification page; stopping', page.url());
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(3000);
  const before = await page.evaluate(() => document.documentElement.hasAttribute('dark'));
  await page.evaluate(([value, attrs]) => {
    document.cookie = `PREF=${value}; ${attrs}`;
  }, [c.write, COOKIE_ATTRS]);
  await page.evaluate(() => location.replace(location.href));
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);
  const after = await page.evaluate(() => ({
    dark: document.documentElement.hasAttribute('dark'),
    pref: document.cookie.split('; ').find((x) => x.startsWith('PREF=')) ?? null,
  }));
  const jar = (await context.cookies('https://www.youtube.com/')).filter((x) => x.name === 'PREF');
  console.log(
    `${c.expectDark === after.dark ? 'OK  ' : 'FAIL'} ${c.name}: before.dark=${before} after=${JSON.stringify(after)} cookies=${jar.length} (${jar.map((x) => x.domain).join(',')})`,
  );
  await context.close();
}
await browser.close();

// 階段 2b、2c（004 第 1、4 節、005 頁面整理）在本機假頁面上的驗收檢查與截圖。
// 假頁面：fixtures/watch.html（＋ stage2c-watch.js 的附加模擬）、home.html、search.html、shorts.html。
//   npm install --no-save playwright-core@1.56.1 && npm run build
//   node spikes/stage1-smoke/convenience-test.mjs            # 全部
//   ONLY=T27 node spikes/stage1-smoke/convenience-test.mjs   # 只跑某個任務
import { EXT_ID, WATCH, button, launch, openWatch, reporter, shot, spaNavigate } from './lib.mjs';

const { check, skip, summary } = reporter();
const only = process.env.ONLY;
const want = (task) => !only || only.split(',').includes(task);

/**
 * 每個任務用一個新的瀏覽器設定檔。options.open 為 false 時不先打開觀看頁；
 * options.permissions 給剪貼簿等權限。
 */
async function section(task, fn, options = {}) {
  if (!want(task)) return;
  console.log(`\n== ${task}`);
  const context = await launch({ name: `conv-${task}`, lang: options.lang, viewport: options.viewport });
  if (options.permissions) await context.grantPermissions(options.permissions, { origin: 'https://www.youtube.com' });
  const page = context.pages()[0] ?? (await context.newPage());
  page.on('pageerror', (err) => console.log('  pageerror:', String(err).slice(0, 200)));
  try {
    if (options.open !== false) await openWatch(page, options.url ?? WATCH);
    await fn(page, context);
  } catch (err) {
    check(`${task} script`, false, String(err).split('\n').slice(0, 3).join(' | '));
    const { root } = await import('./lib.mjs');
    await page.screenshot({ path: `${root}/spikes/stage1-smoke/.cache/error-conv-${task}.png` }).catch(() => {});
  } finally {
    await context.close();
  }
}

const openMore = async (page) => {
  if ((await page.locator('yte-toolbar .yte-more').count()) === 0) await button(page, 'more').click();
  await page.waitForTimeout(200);
};
const fixtureQuality = (page) => page.evaluate(() => window.__fixtureQuality());
const fixtureLog = (page, type) => page.evaluate((type) => window.__fixtureLog.filter((e) => !type || e.type === type), type);

// ---------------------------------------------------------------------------
// T27 鎖定畫質（004 第 1 節）
// ---------------------------------------------------------------------------
await section('T27', async (page) => {
  const select = page.locator('yte-toolbar #yte-more-qualityLock-select');
  await openMore(page);
  const options = await select.locator('option').allInnerTexts();
  check(
    '「更多」面板有鎖定畫質下拉選單，選項依序為關閉、最高、2160p–480p，預設關閉（FR-1）',
    options.join('|') === 'Off (automatic)|Highest available|2160p|1440p|1080p|720p|480p' && (await select.inputValue()) === 'off',
    options.join(', '),
  );
  const before = await fixtureQuality(page);
  check('鎖定關閉時不改變 YouTube 的畫質', before.quality === 'medium' && before.range === null, JSON.stringify(before));

  await select.selectOption('1080');
  await page.waitForTimeout(400);
  const q1 = await fixtureQuality(page);
  check('鎖定 1080p 後，有 4K 的影片切換到 1080p（FR-2）', q1.quality === 'hd1080' && q1.range?.join() === 'hd1080,hd1080', JSON.stringify(q1));
  check('面板中顯示目前選擇的畫質（FR-6）', (await select.inputValue()) === '1080');
  check('「更多」按鈕不顯示開啟狀態（FR-6）', (await button(page, 'more').getAttribute('aria-pressed')) !== 'true');
  await shot(page, 'T27-more-quality-lock.png');
  await page.keyboard.press('Escape');

  // 最高只有 720p 的影片
  await spaNavigate(page, 'next');
  await page.waitForTimeout(600);
  const q2 = await fixtureQuality(page);
  check('換到最高只有 720p 的影片，播放畫質為 720p（FR-2）', q2.quality === 'hd720', JSON.stringify(q2));

  // YouTube 自動改變畫質
  await page.evaluate(() => window.__fixtureAutoQuality('small'));
  await page.waitForTimeout(500);
  const q3 = await fixtureQuality(page);
  const autoLog = (await fixtureLog(page, 'quality')).slice(-2).map((e) => `${e.quality}:${e.source}`);
  check('播放途中 YouTube 自動改變畫質時切回鎖定的畫質（FR-3）', q3.quality === 'hd720', autoLog.join(' → '));

  // 使用者從齒輪手動改成 480p
  await page.locator('#movie_player .ytp-settings-button').click();
  await page.locator('#movie_player .ytp-settings-menu button[data-quality="large"]').click();
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('video').dispatchEvent(new Event('playing')));
  await page.waitForTimeout(300);
  const q4 = await fixtureQuality(page);
  check('手動在 YouTube 齒輪改成 480p，這部影片維持 480p（FR-4）', q4.quality === 'large', JSON.stringify(q4));
  // 之後 YouTube 自動調整也不再強制（這部影片已交給使用者）
  await page.evaluate(() => window.__fixtureAutoQuality('medium'));
  await page.waitForTimeout(400);
  check('手動選擇後，這部影片不再被強制切換（FR-4）', (await fixtureQuality(page)).quality === 'medium');

  // 換下一部影片恢復鎖定
  await spaNavigate(page, 'next2');
  await page.waitForTimeout(600);
  const q5 = await fixtureQuality(page);
  check('換下一部影片恢復鎖定 1080p（FR-4）', q5.quality === 'hd1080', JSON.stringify(q5));

  // 重新整理後仍生效
  await page.reload();
  await page.waitForSelector('yte-toolbar', { state: 'attached' });
  await page.waitForTimeout(800);
  const q6 = await fixtureQuality(page);
  await openMore(page);
  check('重新整理後設定仍生效（FR-5）', q6.quality === 'hd1080' && (await select.inputValue()) === '1080', JSON.stringify(q6));

  // 最高可用畫質
  await page.goto(WATCH);
  await page.waitForSelector('yte-toolbar', { state: 'attached' });
  await openMore(page);
  await select.selectOption('max');
  await page.waitForTimeout(400);
  check('「最高可用畫質」使用影片的最高畫質（FR-1）', (await fixtureQuality(page)).quality === 'hd2160');

  // 關閉：交還給 YouTube
  await select.selectOption('off');
  await page.waitForTimeout(300);
  const released = (await fixtureLog(page)).some((e) => e.type === 'range' && e.min === 'auto');
  await page.evaluate(() => window.__fixtureAutoQuality('hd720'));
  await page.waitForTimeout(400);
  const q7 = await fixtureQuality(page);
  check('選「關閉」後交還給 YouTube 自動決定畫質', released && q7.quality === 'hd720' && q7.range === null, JSON.stringify(q7));
}, { viewport: { width: 1280, height: 1300 } });

if (!summary()) process.exitCode = 1;
void EXT_ID;
void skip;

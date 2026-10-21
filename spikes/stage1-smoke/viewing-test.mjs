// 階段 2（003 觀看輔助功能）在本機假觀看頁上的驗收檢查與截圖。
//   npm install --no-save playwright-core@1.56.1 && npm run build
//   node spikes/stage1-smoke/viewing-test.mjs            # 全部
//   ONLY=T06 node spikes/stage1-smoke/viewing-test.mjs   # 只跑某個任務
import { WATCH, button, launch, openWatch, pressed, reporter, shot, spaNavigate } from './lib.mjs';

const { check, summary } = reporter();
const only = process.env.ONLY;
const want = (task) => !only || only.split(',').includes(task);

async function section(task, fn) {
  if (!want(task)) return;
  console.log(`\n== ${task}`);
  const context = await launch({ name: task });
  const page = context.pages()[0] ?? (await context.newPage());
  page.on('pageerror', (err) => console.log('  pageerror:', String(err).slice(0, 200)));
  try {
    await openWatch(page);
    await fn(page, context);
  } catch (err) {
    check(`${task} script`, false, String(err).split('\n')[0]);
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// T06 深色模式、子母畫面
// ---------------------------------------------------------------------------
await section('T06', async (page) => {
  const isDark = () => page.evaluate(() => document.documentElement.hasAttribute('dark'));

  await button(page, 'darkMode').click();
  await page.waitForTimeout(200);
  let p = await pressed(page, 'darkMode');
  check('深色模式按鈕切換 YouTube 主題，按鈕顯示開啟狀態（FR-10、001 FR-9）', (await isDark()) && p.pressed === 'true' && p.on);
  await shot(page, 'T06-dark-mode-on.png');

  await page.reload();
  await openWatch(page);
  await page.waitForTimeout(500);
  p = await pressed(page, 'darkMode');
  check('重新整理後自動套用記住的深色模式（FR-1）', (await isDark()) && p.pressed === 'true');

  await page.locator('#fixture-theme-toggle').click();
  await page.waitForTimeout(300);
  p = await pressed(page, 'darkMode');
  check('從 YouTube 選單切換主題時按鈕同步（FR-12）', !(await isDark()) && p.pressed === 'false');

  await page.reload();
  await openWatch(page);
  await page.waitForTimeout(500);
  check('從 YouTube 選單切換後，記住的狀態也跟著更新', !(await isDark()) && (await pressed(page, 'darkMode')).pressed === 'false');

  await button(page, 'darkMode').click();
  await spaNavigate(page);
  check('換頁後深色模式持續生效（FR-3）', (await isDark()) && (await pressed(page, 'darkMode')).pressed === 'true');
  await button(page, 'darkMode').click();

  // 子母畫面
  const pipEnabled = await page.evaluate(() => document.pictureInPictureEnabled);
  await button(page, 'pip').click();
  await page.waitForTimeout(800);
  const inPip = await page.evaluate(() => document.pictureInPictureElement?.tagName ?? null);
  p = await pressed(page, 'pip');
  check('子母畫面按鈕開啟原生子母畫面（FR-30）', pipEnabled && inPip === 'VIDEO' && p.pressed === 'true', `enabled=${pipEnabled} element=${inPip}`);
  await shot(page, 'T06-pip-on.png');
  // 模擬使用者從子母畫面視窗本身關閉
  await page.evaluate(() => document.exitPictureInPicture());
  await page.waitForTimeout(300);
  check('從子母畫面視窗關閉時按鈕同步（FR-31）', (await pressed(page, 'pip')).pressed === 'false');
  await page.reload();
  await openWatch(page);
  check('子母畫面不記住狀態（FR-33）', (await pressed(page, 'pip')).pressed === 'false');
});

if (!summary()) process.exitCode = 1;
void WATCH;

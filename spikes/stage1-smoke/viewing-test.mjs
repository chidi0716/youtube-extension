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

// ---------------------------------------------------------------------------
// T07 劇院模式
// ---------------------------------------------------------------------------
await section('T07', async (page) => {
  // 回傳畫面上某一點最上層的元素屬於哪個區域
  const hitAt = (selector, dx = 0.5, dy = 0.5) =>
    page.evaluate(
      ({ selector, dx, dy }) => {
        const el = document.querySelector(selector);
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width * dx, r.top + Math.min(r.height * dy, 20));
        if (!top) return null;
        if (top.closest('yte-toolbar')) return 'toolbar';
        if (top.classList.contains('yte-cinema-overlay')) return 'overlay';
        if (top.closest('#movie_player')) return 'player';
        return top.tagName.toLowerCase() + (top.id ? `#${top.id}` : '');
      },
      { selector, dx, dy },
    );

  await button(page, 'cinema').click();
  await page.waitForTimeout(200);
  const p = await pressed(page, 'cinema');
  const hits = {
    player: await hitAt('#movie_player'),
    toolbar: await hitAt('yte-toolbar', 0.02),
    title: await hitAt('ytd-watch-metadata h1', 0.1),
    masthead: await hitAt('#masthead-container', 0.02),
    secondary: await hitAt('#secondary'),
  };
  check(
    '劇院模式：播放器與工具列以外都被遮罩（FR-20）',
    p.pressed === 'true' &&
      hits.player === 'player' &&
      hits.toolbar === 'toolbar' &&
      hits.title === 'overlay' &&
      hits.masthead === 'overlay' &&
      hits.secondary === 'overlay',
    JSON.stringify(hits),
  );
  const opacity = await page.evaluate(() => getComputedStyle(document.querySelector('.yte-cinema-overlay')).backgroundColor);
  check('遮罩約 90% 不透明', opacity === 'rgba(0, 0, 0, 0.9)', opacity);
  await page.screenshot({ path: `${(await import('./lib.mjs')).shots}/T07-cinema-on.png` });

  // 工具列仍可用：在劇院模式中展開面板
  await button(page, 'help').click();
  await page.waitForTimeout(300);
  const panelVisible = await page.evaluate(() => !!document.querySelector('yte-toolbar').shadowRoot.querySelector('.yte-panel'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const stillOnAfterPanelEsc = (await pressed(page, 'cinema')).pressed === 'true';
  check('劇院模式中工具列仍可用；Esc 先收起面板', panelVisible && stillOnAfterPanelEsc);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('按 Esc 關閉劇院模式（FR-21）', (await pressed(page, 'cinema')).pressed === 'false' && (await page.locator('.yte-cinema-overlay').count()) === 0);

  await button(page, 'cinema').click();
  await page.mouse.click(1200, 700);
  await page.waitForTimeout(200);
  check('點遮罩關閉劇院模式（FR-21）', (await pressed(page, 'cinema')).pressed === 'false');

  await button(page, 'cinema').click();
  await page.reload();
  await openWatch(page);
  check('劇院模式不記住狀態（FR-22）', (await pressed(page, 'cinema')).pressed === 'false' && (await page.locator('.yte-cinema-overlay').count()) === 0);
});

if (!summary()) process.exitCode = 1;
void WATCH;

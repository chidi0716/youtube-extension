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
    check(`${task} script`, false, String(err).split('\n').slice(0, 3).join(' | '));
    await page.screenshot({ path: `${(await import('./lib.mjs')).root}/spikes/stage1-smoke/.cache/error-${task}.png` }).catch(() => {});
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

// ---------------------------------------------------------------------------
// T08 浮動播放器
// ---------------------------------------------------------------------------
await section('T08', async (page) => {
  const { shots } = await import('./lib.mjs');
  const info = () =>
    page.evaluate(() => {
      const c = document.querySelector('#player-container');
      const r = c.getBoundingClientRect();
      return {
        floating: c.classList.contains('yte-floating'),
        left: Math.round(r.left),
        top: Math.round(r.top),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        width: Math.round(r.width),
        height: Math.round(r.height),
        vw: document.documentElement.clientWidth,
        vh: window.innerHeight,
        paused: document.querySelector('video').paused,
        controls: !!document.querySelector('yte-floating-controls'),
      };
    });
  const scrollTo = async (y) => {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(500);
  };

  await page.evaluate(() => document.querySelector('video').play());
  await button(page, 'floating').click();
  await page.waitForTimeout(200);
  let s = await info();
  check('開啟浮動播放器，播放器在畫面內時不浮動（FR-40）', (await pressed(page, 'floating')).pressed === 'true' && !s.floating);

  await scrollTo(1200);
  s = await info();
  check(
    '捲出畫面時縮小並固定在右下角繼續播放（FR-40）',
    s.floating && s.controls && !s.paused && Math.abs(s.right - (s.vw - 16)) <= 1 && Math.abs(s.bottom - (s.vh - 16)) <= 1,
    JSON.stringify(s),
  );
  check('寬度約為視窗的 25%（最小 320px）且維持影片比例（FR-43）', s.width === Math.max(320, Math.round(s.vw * 0.25)) && Math.abs(s.height - Math.round(s.width * 9 / 16)) <= 1, `${s.width}x${s.height}`);
  await page.screenshot({ path: `${shots}/T08-floating-bottom-right.png` });

  // 拖到左上方，放開時貼齊左上角
  await page.mouse.move(s.left + 60, s.top + 18);
  await page.mouse.down();
  await page.mouse.move(400, 300, { steps: 8 });
  await page.mouse.move(200, 200, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  s = await info();
  check('拖到其他角落，放開時貼齊最近的角落（FR-41）', s.floating && s.left === 16 && s.top === 56 + 16, JSON.stringify(s));
  await page.screenshot({ path: `${shots}/T08-floating-top-left.png` });

  await page.reload();
  await openWatch(page);
  await scrollTo(1200);
  s = await info();
  check('重新整理後浮動播放器仍開啟，位置仍在左上角（FR-41、FR-1）', (await pressed(page, 'floating')).pressed === 'true' && s.floating && s.left === 16 && s.top === 72, JSON.stringify(s));

  // ✕：暫時回到原位置，直到下次捲動離開
  await page.locator('yte-floating-controls .close').click();
  await page.waitForTimeout(300);
  s = await info();
  const afterClose = !s.floating && !s.controls;
  await scrollTo(1400);
  const stillBack = !(await info()).floating;
  await scrollTo(0);
  await scrollTo(1200);
  const floatsAgain = (await info()).floating;
  check('✕ 後回到原位置，捲回原位再捲出去時重新浮動（FR-42）', afterClose && stillBack && floatsAgain, `close=${afterClose} still=${stillBack} again=${floatsAgain}`);

  await scrollTo(0);
  await spaNavigate(page);
  await scrollTo(1200);
  check('換頁後浮動播放器持續生效（FR-3）', (await info()).floating);

  await scrollTo(0);
  await button(page, 'floating').click();
  await scrollTo(1200);
  check('關閉浮動播放器後不再浮動', !(await info()).floating && (await pressed(page, 'floating')).pressed === 'false');
});

// ---------------------------------------------------------------------------
// T09 循環播放
// ---------------------------------------------------------------------------
await section('T09', async (page) => {
  const panel = (sel) => page.locator(`yte-toolbar .yte-panel ${sel}`);
  const status = () => panel('.yte-loop-status').innerText();
  // 測試影片 30 秒，以 4 倍速播放縮短等待時間；在頁面上記錄跳轉次數。
  await page.evaluate(() => {
    const v = document.querySelector('video');
    v.playbackRate = 4;
    v.muted = true;
    window.__seeks = 0;
    v.addEventListener('seeked', () => window.__seeks++);
  });

  await button(page, 'loop').click();
  await page.waitForTimeout(300);
  await shot(page, 'T09-loop-panel.png');

  // 重複 3 次
  await panel('#yte-loop-times').fill('3');
  await panel('.yte-button-primary').click();
  await page.waitForTimeout(500);
  const onWhileRunning = (await pressed(page, 'loop')).on;
  await page.locator('#title h1').click({ position: { x: 5, y: 5 } }); // 點外面收起面板，循環繼續進行
  await page.waitForTimeout(300);
  const onWithPanelClosed = (await pressed(page, 'loop')).on;
  check('循環進行中按鈕顯示開啟狀態（FR-52）', onWhileRunning && onWithPanelClosed);
  await page.waitForFunction(() => document.querySelector('video').ended, null, { timeout: 40_000 });
  await button(page, 'loop').click();
  await page.waitForTimeout(200);
  const repeat = { status: await status(), seeks: await page.evaluate(() => window.__seeks), on: (await pressed(page, 'loop')).on };
  check('循環「3 次」播完第 3 次後停止（FR-50、FR-51）', repeat.status === 'Played 3 times' && repeat.seeks === 2, JSON.stringify(repeat));

  // 循環片段 00:10–00:20
  await panel('.yte-radio:nth-of-type(2) input').check();
  await panel('#yte-loop-start').fill('00:00:10');
  await panel('#yte-loop-end').fill('00:00:20');
  await panel('.yte-button-primary').click();
  const samples = [];
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    samples.push(await page.evaluate(() => document.querySelector('video').currentTime));
  }
  const segStatus = await status();
  const inRange = samples.slice(4).every((t) => t >= 9.5 && t <= 20.8);
  const playedMatch = /Played (\d+) times/.exec(segStatus);
  check(
    '循環片段 00:10–00:20 會一直在這段重複（FR-50）',
    inRange && playedMatch && Number(playedMatch[1]) >= 2,
    `status=${segStatus} min=${Math.min(...samples.slice(4)).toFixed(1)} max=${Math.max(...samples).toFixed(1)}`,
  );
  await shot(page, 'T09-loop-segment-running.png');

  await panel('.yte-button-secondary').click();
  await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => document.querySelector('video').currentTime);
  await page.waitForTimeout(3000);
  const t2 = await page.evaluate(() => document.querySelector('video').currentTime);
  check(
    '按「停止」結束循環（FR-51）',
    (await panel('.yte-button-secondary').isDisabled()) && (t2 > 20.5 || t2 > t1),
    `t1=${t1.toFixed(1)} t2=${t2.toFixed(1)}`,
  );

  // 不合法的片段時「開始循環」停用
  await panel('#yte-loop-end').fill('00:00:05');
  const disabled = await panel('.yte-button-primary').isDisabled();
  check('片段的開始晚於結束時無法開始循環', disabled);
  await panel('#yte-loop-end').fill('00:00:20');

  // 換頁時自動停止
  await panel('.yte-button-primary').click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await spaNavigate(page);
  check('換到另一部影片時循環自動停止（FR-53）', !(await pressed(page, 'loop')).on);
});

if (!summary()) process.exitCode = 1;
void WATCH;

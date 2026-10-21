// 階段 2（003 觀看輔助功能）在本機假觀看頁上的驗收檢查與截圖。
//   npm install --no-save playwright-core@1.56.1 && npm run build
//   node spikes/stage1-smoke/viewing-test.mjs            # 全部
//   ONLY=T06 node spikes/stage1-smoke/viewing-test.mjs   # 只跑某個任務
import { WATCH, button, launch, openWatch, pressed, reporter, shot, spaNavigate } from './lib.mjs';

const { check, skip, summary } = reporter();
const only = process.env.ONLY;
const want = (task) => !only || only.split(',').includes(task);

async function section(task, fn, options = {}) {
  if (!want(task)) return;
  console.log(`\n== ${task}`);
  const context = await launch({ name: task, colorScheme: options.colorScheme });
  if (options.pref) {
    await context.addCookies([{ name: 'PREF', value: options.pref, domain: '.youtube.com', path: '/', secure: true, sameSite: 'Lax' }]);
  }
  const page = context.pages()[0] ?? (await context.newPage());
  page.on('pageerror', (err) => console.log('  pageerror:', String(err).slice(0, 200)));
  try {
    await openWatch(page, options.url ?? WATCH);
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
// 深色模式（T06d）：由擴充功能操作 YouTube 自己的「外觀」選單。假觀看頁模擬 YouTube 的帳號／設定選單與
// 外觀子選單（選項的順序與文字刻意與 YouTube 不同，只有 data 中的動作代號相同）。
const prefOf = (page) =>
  page.context().cookies('https://www.youtube.com/').then((cs) => cs.find((c) => c.name === 'PREF')?.value ?? null);
const isDarkPage = (page) => page.evaluate(() => document.documentElement.hasAttribute('dark'));
const menuLog = (page) => page.evaluate(() => window.__fixtureMenuLog.join(' > '));
const menuState = (page) =>
  page.evaluate(() => ({
    open: document.getElementById('fixture-dropdown').style.display !== 'none',
    busyClass: document.documentElement.classList.contains('yte-theme-menu-busy'),
  }));
const tooltipOf = (page, id) =>
  page.evaluate((id) => {
    const tip = document.querySelector('yte-toolbar').shadowRoot.querySelector(`.yte-btn[data-button="${id}"]`).closest('.yte-btn-wrap').querySelector('.yte-tooltip');
    return { text: tip.textContent, notice: tip.hasAttribute('data-notice') };
  }, id);

/** 開始記錄每個畫面中選單是否看得見（實際不透明度 > 0 且顯示中）；存在 sessionStorage，重新載入後也讀得到。 */
const watchMenuVisibility = (page) =>
  page.evaluate(() => {
    sessionStorage.setItem('__menuFrames', JSON.stringify({ open: 0, visible: 0 }));
    const counts = { open: 0, visible: 0 };
    const start = performance.now();
    const loop = () => {
      const d = document.getElementById('fixture-dropdown');
      if (d.style.display !== 'none') {
        counts.open++;
        let o = 1;
        for (let e = d; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
        if (o > 0) counts.visible++;
      }
      sessionStorage.setItem('__menuFrames', JSON.stringify(counts));
      if (performance.now() - start < 4000) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.__noReload = true;
  });
const menuFrames = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('__menuFrames') ?? '{}'));

/** 按深色模式按鈕，等選單操作完成。 */
async function pressDark(page) {
  await watchMenuVisibility(page);
  await button(page, 'darkMode').click();
  await page.waitForTimeout(2500);
  return { reloaded: !(await page.evaluate(() => window.__noReload === true)), frames: await menuFrames(page) };
}

await section(
  'T06',
  async (page) => {
    // 起始：YouTube 外觀為淺色（f6 含淺色旗標），另有其他偏好欄位。
    let p = await pressed(page, 'darkMode');
    check('起始為淺色時按鈕為關閉（FR-12）', !(await isDarkPage(page)) && p.pressed === 'false');
    await page.evaluate(() => {
      const v = document.querySelector('video');
      v.muted = true;
      return v.play();
    });
    await page.waitForTimeout(800);

    let r = await pressDark(page);
    let log = await menuLog(page);
    p = await pressed(page, 'darkMode');
    check(
      '按按鈕：操作 YouTube 的外觀選單（選單按鈕 → 外觀 → 依動作代號選深色），整頁變成深色（FR-10、FR-11）',
      (await isDarkPage(page)) && p.pressed === 'true' && log === 'open > appearance > select:TOGGLE_DARK_THEME_ON > close',
      log,
    );
    check('主題偏好由 YouTube（假頁面）寫入，擴充功能沒有自行修改', (await prefOf(page)) === 'f5=30000&f6=408&hl=en&tz=UTC', await prefOf(page));
    check(
      '操作期間 YouTube 的選單沒有被看見，完成後選單關閉、暫時的 class 移除（FR-11）',
      r.frames.open > 0 && r.frames.visible === 0 && !(await menuState(page)).open && !(await menuState(page)).busyClass,
      `${JSON.stringify(r.frames)} ${JSON.stringify(await menuState(page))}`,
    );
    check('影片持續播放，頁面沒有被擴充功能重新載入', !r.reloaded && !(await page.evaluate(() => document.querySelector('video').paused)));
    await shot(page, 'T06d-dark-from-light.png');

    // 再按一次回到淺色
    await page.evaluate(() => (window.__fixtureMenuLog = []));
    r = await pressDark(page);
    log = await menuLog(page);
    check(
      '再按一次：選淺色，回到淺色',
      !(await isDarkPage(page)) && (await pressed(page, 'darkMode')).pressed === 'false' && log === 'open > appearance > select:TOGGLE_DARK_THEME_OFF > close' && r.frames.visible === 0,
      `${log} ${JSON.stringify(r.frames)}`,
    );

    await page.reload();
    await openWatch(page, page.url());
    check('重新整理後維持 YouTube 的主題', !(await isDarkPage(page)) && (await pressed(page, 'darkMode')).pressed === 'false');

    // 使用者從 YouTube 選單切換主題
    await page.locator('#fixture-theme-toggle').click();
    await page.waitForTimeout(300);
    check('從 YouTube 選單切換主題時按鈕同步（FR-12）', (await isDarkPage(page)) && (await pressed(page, 'darkMode')).pressed === 'true');
    await page.locator('#fixture-theme-toggle').click();
    await page.waitForTimeout(300);
    check('再從選單切回淺色，按鈕同步', !(await isDarkPage(page)) && (await pressed(page, 'darkMode')).pressed === 'false');

    // 工具列關閉時不改變主題（FR-14）
    await page.locator('#fixture-theme-toggle').click();
    await page.waitForTimeout(200);
    await button(page, 'close').click();
    await page.waitForTimeout(300);
    check('工具列關閉時不改變 YouTube 的主題（FR-14）', (await isDarkPage(page)) && (await page.locator('yte-toolbar').count()) === 0);
  },
  { pref: 'f5=30000&f6=80008&hl=en&tz=UTC' },
);

await section(
  'T06',
  async (page) => {
    // 模擬未登入時的 YouTube：選擇後由 YouTube 自己重新載入頁面
    check('起始為深色時按鈕為開啟', (await isDarkPage(page)) && (await pressed(page, 'darkMode')).pressed === 'true');
    await watchMenuVisibility(page);
    const loaded = page.waitForEvent('load', { timeout: 10_000 }).then(
      () => true,
      () => false,
    );
    await button(page, 'darkMode').click();
    const reloaded = await loaded;
    await openWatch(page, page.url());
    const frames = await menuFrames(page);
    check(
      'YouTube 選擇後自己重新載入頁面時：重新載入前選單沒有被看見，載入後為淺色',
      reloaded && frames.open > 0 && frames.visible === 0 && !(await isDarkPage(page)) && (await pressed(page, 'darkMode')).pressed === 'false',
      `reloaded=${reloaded} ${JSON.stringify(frames)} pref=${await prefOf(page)}`,
    );
    await shot(page, 'T06d-light-from-dark.png');
  },
  { pref: 'f6=400', url: `${WATCH}&fixture_menu_reload=1` },
);

await section(
  'T06',
  async (page) => {
    // 起始：沒有明確的主題偏好（使用裝置主題），裝置為深色
    check('使用裝置主題時，按鈕依目前實際顯示的主題（FR-13）', (await isDarkPage(page)) && (await pressed(page, 'darkMode')).pressed === 'true', String(await prefOf(page)));
    await pressDark(page);
    check(
      '按下後選擇明確的淺色主題（FR-13）',
      !(await isDarkPage(page)) && (await menuLog(page)).includes('select:TOGGLE_DARK_THEME_OFF') && (await prefOf(page)) === 'hl=en&f6=80000',
      `${await menuLog(page)} ${await prefOf(page)}`,
    );
  },
  { pref: 'hl=en', colorScheme: 'dark' },
);

for (const [flag, what] of [
  ['fixture_no_appearance=1', '選單中沒有「外觀」項目'],
  ['fixture_no_menu_button=1', '頂端列沒有選單按鈕'],
]) {
  await section(
    'T06',
    async (page) => {
      // 找不到選單或選項（例如 YouTube 改版）：不做任何修改，按鈕短暫顯示原因（FR-15）
      const logs = [];
      page.on('console', (m) => logs.push(m.text()));
      const prefBefore = await prefOf(page);
      await watchMenuVisibility(page);
      await button(page, 'darkMode').click();
      // 等操作結束、提示出現（提示只顯示幾秒）
      await page
        .waitForFunction(
          () => document.querySelector('yte-toolbar').shadowRoot.querySelector('.yte-btn[data-button="darkMode"]').closest('.yte-btn-wrap').querySelector('.yte-tooltip[data-notice]'),
          null,
          { timeout: 7000 },
        )
        .catch(() => {});
      const tip = await tooltipOf(page, 'darkMode');
      const state = await menuState(page);
      const frames = await menuFrames(page);
      check(
        `${what}：不做任何修改，選單關閉且沒有被看見（FR-15）`,
        !(await isDarkPage(page)) && (await prefOf(page)) === prefBefore && !state.open && !state.busyClass && frames.visible === 0,
        `pref=${await prefOf(page)} ${JSON.stringify(state)} ${JSON.stringify(frames)} log=${await menuLog(page)}`,
      );
      check(
        `${what}：按鈕提示顯示「無法切換」並在 console 記錄原因（FR-15）`,
        tip.notice && tip.text === "Can't switch. Please use YouTube's Appearance setting." && logs.some((l) => l.includes("could not use YouTube's appearance menu")),
        `${JSON.stringify(tip)} ${logs.filter((l) => l.includes('youtube-extension')).join(' | ')}`,
      );
      if (flag === 'fixture_no_appearance=1') await shot(page, 'T06d-unavailable.png');
    },
    { pref: 'f6=80000', url: `${WATCH}&${flag}` },
  );
}

await section('T06', async (page) => {
  let p;
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
// T07 劇院模式（T07a：分區調暗）
// ---------------------------------------------------------------------------
// 假觀看頁的播放器位於多層形成堆疊脈絡的祖先容器內（#primary-inner、#player、#player-container-inner），
// 重現專案擁有者回報的情境。劇院模式開啟時以 document.elementFromPoint 檢查播放器與工具列沒有被蓋住。
const cinemaOn = (page) => page.evaluate(() => document.documentElement.classList.contains('yte-cinema'));

/** 劇院模式的檢查：各檢查點最上層的元素、各區域實際的不透明度（含祖先）、頁面背景色。 */
const cinemaProbe = (page) =>
  page.evaluate(() => {
    const classify = (x, y) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return 'none';
      if (el.closest('yte-toolbar')) return 'toolbar';
      if (el.closest('#movie_player')) return 'player';
      if (el.closest('.yte-cinema-overlay')) return 'overlay';
      return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '');
    };
    const center = (el) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    const opacity = (el) => {
      let o = 1;
      for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
      return Math.round(o * 1000) / 1000;
    };
    const shadow = document.querySelector('yte-toolbar').shadowRoot;
    const btn = (id) => shadow.querySelector(`.yte-btn[data-button="${id}"]`);
    const points = {
      playerCenter: center(document.querySelector('#movie_player')),
      playerControls: center(document.querySelector('.ytp-chrome-bottom')),
      playButton: center(document.querySelector('#fixture-play')),
      toolbarVideo: center(btn('video')),
      toolbarCinema: center(btn('cinema')),
      toolbarClose: center(btn('close')),
    };
    const panel = shadow.querySelector('.yte-panel');
    if (panel) points.toolbarPanel = center(panel);
    const hits = Object.fromEntries(Object.entries(points).map(([k, [x, y]]) => [k, classify(x, y)]));
    const regions = {
      masthead: document.querySelector('#masthead-container'),
      title: document.querySelector('ytd-watch-metadata h1'),
      description: document.querySelector('#fixture-description'),
      comments: document.querySelector('#comments'),
      secondary: document.querySelector('#secondary a'),
    };
    return {
      hits,
      dimmed: Object.fromEntries(Object.entries(regions).map(([k, el]) => [k, opacity(el)])),
      bright: { player: opacity(document.querySelector('#movie_player')), toolbar: opacity(document.querySelector('yte-toolbar')) },
      background: [document.documentElement, document.body, document.querySelector('ytd-app')].map((el) => getComputedStyle(el).backgroundColor),
    };
  });

const protectedHits = (hits) => Object.values(hits).every((h) => h === 'player' || h === 'toolbar') && hits.playerCenter === 'player' && hits.toolbarCinema === 'toolbar';

await section('T07', async (page) => {
  const { shots } = await import('./lib.mjs');
  // 先確認假頁面確實重現回報的問題：以舊做法（整頁遮罩，播放器容器與工具列提高 z-index）會被蓋住。
  const old = await page.evaluate(() => {
    const overlay = document.createElement('div');
    overlay.className = 'yte-cinema-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2200;background:rgba(0,0,0,0.9)';
    document.body.append(overlay);
    const container = document.querySelector('#player-container');
    const host = document.querySelector('yte-toolbar');
    container.style.zIndex = '2201';
    host.style.position = 'relative';
    host.style.zIndex = '2201';
    const at = (el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === overlay ? 'overlay' : top?.closest('#movie_player') ? 'player' : top?.closest('yte-toolbar') ? 'toolbar' : top?.tagName;
    };
    const result = {
      player: at(document.querySelector('#movie_player')),
      toolbar: at(host.shadowRoot.querySelector('.yte-btn[data-button="cinema"]')),
    };
    overlay.remove();
    container.style.zIndex = '';
    host.style.position = '';
    host.style.zIndex = '';
    return result;
  });
  check('假觀看頁重現回報的問題：舊做法（整頁遮罩＋提高 z-index）會連播放器與工具列一起蓋住', old.player === 'overlay' && old.toolbar === 'overlay', JSON.stringify(old));

  await button(page, 'cinema').click();
  await page.waitForTimeout(200);
  let probe = await cinemaProbe(page);
  check(
    '劇院模式開啟：播放器中央、控制列、工具列按鈕位置最上層都是播放器或工具列（FR-20a）',
    (await pressed(page, 'cinema')).pressed === 'true' && (await cinemaOn(page)) && protectedHits(probe.hits),
    JSON.stringify(probe.hits),
  );
  check(
    '頂端列、標題、說明、留言、側欄都變暗到約 93%，播放器與工具列亮度正常（FR-20、FR-20a）',
    Object.values(probe.dimmed).every((o) => o <= 0.1) && probe.bright.player === 1 && probe.bright.toolbar === 1,
    `${JSON.stringify(probe.dimmed)} ${JSON.stringify(probe.bright)}`,
  );
  check('頁面背景變成黑色（FR-20）', probe.background.every((c) => c === 'rgb(0, 0, 0)'), probe.background.join(', '));
  await page.screenshot({ path: `${shots}/T07a-cinema-light.png` });

  // 播放器的控制項可以點：播放／暫停
  const pausedBefore = await page.evaluate(() => document.querySelector('video').paused);
  await page.locator('#fixture-play').click();
  await page.waitForTimeout(300);
  const pausedAfter = await page.evaluate(() => document.querySelector('video').paused);
  check('劇院模式中播放器控制項可以點擊，且不會關閉劇院模式（FR-20a）', pausedBefore !== pausedAfter && (await cinemaOn(page)), `paused ${pausedBefore}→${pausedAfter}`);
  await page.evaluate(() => document.querySelector('video').pause());

  // 工具列的面板可以展開與點擊
  await button(page, 'help').click();
  await page.waitForTimeout(300);
  // 面板展開在工具列下方，捲到畫面內再檢查
  await page.evaluate(() => document.querySelector('yte-toolbar').shadowRoot.querySelector('.yte-panel').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  probe = await cinemaProbe(page);
  check('劇院模式中工具列面板可以展開，面板位置最上層是工具列（FR-20a）', probe.hits.toolbarPanel === 'toolbar' && (await cinemaOn(page)), JSON.stringify(probe.hits));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Esc 先收起面板，劇院模式維持', (await cinemaOn(page)) && (await page.locator('yte-toolbar .yte-panel').count()) === 0);

  // 站內換到另一部影片時繼續生效（FR-3）
  await page.evaluate(() => {
    history.pushState({}, '', '/watch?v=bbbbbbbbbbb');
    document.dispatchEvent(new CustomEvent('yt-navigate-finish'));
  });
  await page.waitForTimeout(300);
  check('換到另一部影片時劇院模式繼續生效（FR-3）', (await cinemaOn(page)) && protectedHits((await cinemaProbe(page)).hits));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('按 Esc 關閉劇院模式（FR-21）', (await pressed(page, 'cinema')).pressed === 'false' && !(await cinemaOn(page)));

  // 點變暗區域中的連結：關閉劇院模式，但不會開啟連結
  await button(page, 'cinema').click();
  const urlBefore = page.url();
  const titleBefore = await page.locator('h1').innerText();
  await page.locator('#next').click();
  await page.waitForTimeout(300);
  check(
    '點變暗區域中的連結：關閉劇院模式，不會開啟連結（FR-21）',
    !(await cinemaOn(page)) && page.url() === urlBefore && (await page.locator('h1').innerText()) === titleBefore,
    page.url(),
  );

  // 點變暗的頂端列（其中的按鈕不會被觸發）
  await button(page, 'cinema').click();
  const darkBefore = await page.evaluate(() => document.documentElement.hasAttribute('dark'));
  await page.locator('#fixture-theme-toggle').click();
  await page.waitForTimeout(300);
  check(
    '點變暗的頂端列關閉劇院模式，頂端列的按鈕不會被觸發（FR-21）',
    !(await cinemaOn(page)) && (await page.evaluate(() => document.documentElement.hasAttribute('dark'))) === darkBefore,
  );

  // 點變暗區域的空白處
  await button(page, 'cinema').click();
  await page.mouse.click(1200, 700);
  await page.waitForTimeout(200);
  check('點變暗區域的空白處關閉劇院模式（FR-21）', (await pressed(page, 'cinema')).pressed === 'false' && !(await cinemaOn(page)));

  await button(page, 'cinema').click();
  await page.reload();
  await openWatch(page);
  check('劇院模式不記住狀態（FR-22）', (await pressed(page, 'cinema')).pressed === 'false' && !(await cinemaOn(page)));
});

await section(
  'T07',
  async (page) => {
    const { shots } = await import('./lib.mjs');
    // 深色主題下也一樣
    await button(page, 'cinema').click();
    await page.waitForTimeout(200);
    const probe = await cinemaProbe(page);
    check(
      '深色主題：播放器與工具列沒有被蓋住，其他區域變暗、背景黑色（FR-20、FR-20a）',
      (await page.evaluate(() => document.documentElement.hasAttribute('dark'))) &&
        protectedHits(probe.hits) &&
        Object.values(probe.dimmed).every((o) => o <= 0.1) &&
        probe.bright.player === 1 &&
        probe.bright.toolbar === 1 &&
        probe.background.every((c) => c === 'rgb(0, 0, 0)'),
      `${JSON.stringify(probe.hits)} ${JSON.stringify(probe.dimmed)} ${probe.background.join(', ')}`,
    );
    await page.screenshot({ path: `${shots}/T07a-cinema-dark.png` });
  },
  { pref: 'f6=400' },
);

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

// ---------------------------------------------------------------------------
// T10 更多選單
// ---------------------------------------------------------------------------
await section('T10', async (page, context) => {
  const { shots } = await import('./lib.mjs');
  const row = (id) => page.locator(`yte-toolbar .yte-more-item[data-item="${id}"]`);
  const sw = (id) => row(id).locator('[role="switch"]');
  const isOn = async (id) => (await sw(id).getAttribute('aria-checked')) === 'true';
  const openMore = async () => {
    if ((await page.locator('yte-toolbar .yte-more').count()) === 0) await button(page, 'more').click();
    await page.waitForTimeout(200);
  };
  const v = (expr) => page.evaluate(new Function(`const v = document.querySelector('video'); return ${expr};`));

  await openMore();
  const names = await page.locator('yte-toolbar .yte-more-name').allInnerTexts();
  check('更多面板列出 5 個開關（FR-60 至 FR-64）', names.length === 5, names.join(', '));
  await shot(page, 'T10-more-panel.png');

  // 切換分頁時自動暫停
  await sw('smartPause').click();
  await page.evaluate(() => document.querySelector('video').play());
  await page.waitForTimeout(500);
  const other = await context.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  await page.waitForTimeout(500);
  const hiddenState = await page.evaluate(() => document.visibilityState);
  const pausedWhileHidden = await v('v.paused');
  await page.bringToFront();
  await page.waitForTimeout(500);
  const resumed = !(await v('v.paused'));
  if (hiddenState !== 'hidden') {
    // Playwright 控制的 Chromium（headless 與 Xvfb 下的有視窗模式皆同）切換分頁時
    // document.visibilityState 仍是 visible，無法模擬；狀態機以單元測試驗證。
    skip('切換分頁時影片暫停、回來時繼續（FR-60）', '本環境切換分頁時 visibilityState 不會變成 hidden');
    skip('原本就暫停的影片回來時不會自動播放（FR-60）', '同上');
  } else {
    check('切換分頁時影片暫停、回來時繼續（FR-60）', pausedWhileHidden && resumed, `paused=${pausedWhileHidden} resumed=${resumed}`);
    await page.evaluate(() => document.querySelector('video').pause());
    await other.bringToFront();
    await page.waitForTimeout(300);
    await page.bringToFront();
    await page.waitForTimeout(500);
    check('原本就暫停的影片回來時不會自動播放（FR-60）', await v('v.paused'));
  }
  await other.close();

  // 自動播放
  await openMore();
  const ytAutoplay = () => page.evaluate(() => document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-checked'));
  const initial = (await isOn('autoplay')) === ((await ytAutoplay()) === 'true');
  await sw('autoplay').click();
  await page.waitForTimeout(200);
  const afterOurs = { ours: await isOn('autoplay'), yt: await ytAutoplay() };
  // 點 YouTube 自己的開關（點在面板外，面板會收起，所以之後重新打開）
  await page.locator('.ytp-button[data-tooltip-target-id="ytp-autonav-toggle-button"]').click();
  await page.waitForTimeout(200);
  await openMore();
  const afterYt = { ours: await isOn('autoplay'), yt: await ytAutoplay() };
  check(
    '自動播放開關控制 YouTube 本身的開關，狀態雙向同步（FR-61）',
    initial && afterOurs.ours === false && afterOurs.yt === 'false' && afterYt.ours === true && afterYt.yt === 'true',
    `${JSON.stringify(afterOurs)} ${JSON.stringify(afterYt)}`,
  );

  // 純音訊模式
  await sw('audioOnly').click();
  await page.evaluate(() => document.querySelector('video').play());
  await page.waitForTimeout(800);
  const audio = await page.evaluate(() => {
    const video = document.querySelector('video');
    const container = document.querySelector('.html5-video-container');
    return {
      opacity: getComputedStyle(video).opacity,
      bg: getComputedStyle(container).backgroundImage,
      playing: !video.paused,
      muted: video.muted,
    };
  });
  check(
    '純音訊模式顯示縮圖、聲音照常播放（FR-62）',
    audio.opacity === '0' && audio.bg.includes('i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg') && audio.playing && !audio.muted,
    JSON.stringify(audio),
  );
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await shot(page, 'T10-audio-only.png');
  await openMore();
  await sw('audioOnly').click();

  // 滑鼠滾輪調整音量
  await sw('wheelVolume').click();
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('video').volume = 0.5;
  });
  const box = await page.locator('#movie_player').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(300);
  const up = { volume: await v('Math.round(v.volume * 100)'), scroll: await page.evaluate(() => window.scrollY) };
  const hintText = await page.evaluate(() => document.querySelector('yte-volume-hint')?.shadowRoot.querySelector('.hint')?.textContent ?? null);
  await page.screenshot({ path: `${shots}/T10-wheel-volume.png`, clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  await page.mouse.wheel(0, 100);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(300);
  const down = await v('Math.round(v.volume * 100)');
  check(
    '滾輪在播放器上調整音量（每格 5%）並顯示目前音量（FR-63）',
    up.volume === 55 && up.scroll === scrollBefore && hintText === '55%' && down === 45,
    `up=${up.volume} hint=${hintText} down=${down} scroll=${up.scroll}`,
  );
  await page.mouse.move(box.x + 20, box.y + box.height + 200);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  const scrolled = await page.evaluate(() => window.scrollY);
  check('游標不在播放器上時滾輪照常捲動頁面（FR-63）', scrolled > 0 && (await v('Math.round(v.volume * 100)')) === 45, `scrollY=${scrolled}`);
  await page.evaluate(() => window.scrollTo(0, 0));

  // 隱藏留言
  await openMore();
  await sw('hideComments').click();
  const hiddenNow = await page.evaluate(() => getComputedStyle(document.querySelector('#comments')).display === 'none');
  await page.reload();
  await openWatch(page);
  await page.waitForTimeout(500);
  const hiddenAfterReload = await page.evaluate(() => getComputedStyle(document.querySelector('#comments')).display === 'none');
  check('隱藏留言開啟後重新整理，留言區仍隱藏（FR-64、FR-1）', hiddenNow && hiddenAfterReload);

  // 記住狀態與換頁後持續生效
  await openMore();
  const remembered = { smartPause: await isOn('smartPause'), wheelVolume: await isOn('wheelVolume'), hideComments: await isOn('hideComments') };
  await page.keyboard.press('Escape');
  await spaNavigate(page);
  const afterNav = await page.evaluate(() => getComputedStyle(document.querySelector('#comments')).display === 'none');
  check('開關狀態被記住，換頁後持續生效（FR-1、FR-3）', remembered.smartPause && remembered.wheelVolume && remembered.hideComments && afterNav, JSON.stringify(remembered));

  await openMore();
  await sw('hideComments').click();
  check('關閉隱藏留言後留言區恢復', await page.evaluate(() => getComputedStyle(document.querySelector('#comments')).display !== 'none'));
});

// ---------------------------------------------------------------------------
// 「啟用」關閉時停用所有觀看輔助功能（QUESTIONS Q11 的目前做法）
// ---------------------------------------------------------------------------
await section('DISABLE', async (page, context) => {
  const { EXT_ID } = await import('./lib.mjs');
  await button(page, 'more').click();
  await page.locator('yte-toolbar .yte-more-item[data-item="hideComments"] [role="switch"]').click();
  await page.keyboard.press('Escape');
  await button(page, 'cinema').click();
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => ({
    cinema: document.documentElement.classList.contains('yte-cinema'),
    commentsHidden: getComputedStyle(document.querySelector('#comments')).display === 'none',
  }));

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${EXT_ID}/popup.html`);
  await popup.waitForFunction(() => !!document.querySelector('h1')?.textContent);
  await popup.waitForTimeout(300);
  await popup.locator('#enabled').uncheck();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({
    toolbar: !!document.querySelector('yte-toolbar'),
    cinema: document.documentElement.classList.contains('yte-cinema'),
    commentsHidden: getComputedStyle(document.querySelector('#comments')).display === 'none',
  }));
  check(
    '關閉「啟用」時移除工具列並還原頁面修改（Q11）',
    before.cinema && before.commentsHidden && !after.toolbar && !after.cinema && !after.commentsHidden,
    `${JSON.stringify(before)} → ${JSON.stringify(after)}`,
  );
  await popup.locator('#enabled').check();
  await page.waitForTimeout(800);
  const again = await page.evaluate(() => getComputedStyle(document.querySelector('#comments')).display === 'none');
  check('重新啟用後再次套用記住的設定（Q11）', again && (await page.locator('yte-toolbar').count()) === 1);
  await popup.close();
});

if (!summary()) process.exitCode = 1;
void WATCH;

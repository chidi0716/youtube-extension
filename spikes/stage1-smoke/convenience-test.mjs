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

// ---------------------------------------------------------------------------
// T28 複製連結（004 第 4 節）
// ---------------------------------------------------------------------------
const linkRows = (page) =>
  page.evaluate(() =>
    [...document.querySelector('yte-toolbar').shadowRoot.querySelectorAll('.yte-copylink-row')].map((row) => ({
      kind: row.dataset.kind,
      name: row.querySelector('.yte-copylink-name').textContent,
      preview: row.querySelector('.yte-copylink-preview').textContent,
      full: row.querySelector('.yte-copylink-preview').title,
      status: row.querySelector('.yte-copylink-status').textContent,
    })),
  );
const clipboard = (page) => page.evaluate(() => navigator.clipboard.readText());
const seek = (page, s) =>
  page.evaluate(async (s) => {
    const v = document.querySelector('video');
    v.pause();
    v.currentTime = s;
    await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
  }, s);

await section(
  'T28',
  async (page, context) => {
    const order = await page.evaluate(() =>
      [...document.querySelector('yte-toolbar').shadowRoot.querySelectorAll('.yte-group')].map((g) =>
        [...g.querySelectorAll('.yte-btn')].map((b) => b.dataset.button),
      ),
    );
    check(
      '工具列左組在「截圖」右邊加入「連結」按鈕（FR-30、001 FR-6）',
      order[0].join() === 'video,mp3,thumbnail,subtitles,screenshot,link',
      order[0].join(),
    );

    await button(page, 'help').click();
    await page.waitForTimeout(200);
    const helpLink = await page.evaluate(() => {
      const li = document.querySelector('yte-toolbar').shadowRoot.querySelector('.yte-help-item[data-button="link"]');
      return li ? { name: li.querySelector('.yte-help-name').textContent, desc: li.querySelector('.yte-help-desc').textContent, icon: !!li.querySelector('svg path') } : null;
    });
    check('說明面板同步列出「連結」（FR-30、001 FR-17）', helpLink?.name === 'Link' && helpLink.icon && helpLink.desc.length > 10, JSON.stringify(helpLink));
    await page.keyboard.press('Escape');

    await button(page, 'link').click();
    await page.waitForSelector('yte-toolbar .yte-copylink-row');
    let rows = await linkRows(page);
    check(
      '連結面板有三個選項，順序為目前時間、Markdown、不含時間（FR-31）',
      rows.map((r) => r.kind).join() === 'time,markdown,plain',
      rows.map((r) => r.name).join(', '),
    );
    check(
      '目前時間是 0 秒時，選項 1 與 3 相同，不加 ?t=0（FR-33）',
      rows[0].full === 'https://youtu.be/jNQXAC9IVRw' && rows[2].full === rows[0].full && rows[1].full === '[Fixture video（00:00）](https://youtu.be/jNQXAC9IVRw)',
      rows.map((r) => r.full).join(' | '),
    );

    // 播放到 23.6 秒（假影片長 30 秒；83 秒的例子由單元測試涵蓋）
    await seek(page, 23.6);
    await page.waitForTimeout(200);
    rows = await linkRows(page);
    check(
      '預覽顯示實際會複製的文字，時間隨播放位置更新並無條件捨去（FR-31、FR-32）',
      rows[0].full === 'https://youtu.be/jNQXAC9IVRw?t=23' && rows[1].full === '[Fixture video（00:23）](https://youtu.be/jNQXAC9IVRw?t=23)' && rows[2].full === 'https://youtu.be/jNQXAC9IVRw',
      rows.map((r) => r.full).join(' | '),
    );
    await seek(page, 3);
    await page.evaluate(() => document.querySelector('video').play());
    await page.waitForTimeout(2300);
    await page.evaluate(() => document.querySelector('video').pause());
    const playing = (await linkRows(page))[0].full;
    check('播放中預覽的時間跟著前進（FR-32）', /\?t=(5|6)$/.test(playing), playing);

    // 複製
    await seek(page, 23.6);
    await page.locator('yte-toolbar .yte-copylink-row[data-kind="markdown"]').click();
    await page.waitForTimeout(150);
    const copiedMd = await clipboard(page);
    rows = await linkRows(page);
    check(
      '點 Markdown 選項複製 [標題（00:23）](https://youtu.be/ID?t=23)，並顯示「已複製」（FR-31）',
      copiedMd === '[Fixture video（00:23）](https://youtu.be/jNQXAC9IVRw?t=23)' && rows[1].status === 'Copied',
      `${copiedMd} / ${rows[1].status}`,
    );
    await shot(page, 'T28-link-panel-copied.png');
    await page.waitForTimeout(2200);
    check('「已複製」約 2 秒後消失（FR-31）', (await linkRows(page))[1].status === '');
    await page.locator('yte-toolbar .yte-copylink-row[data-kind="time"]').click();
    await page.waitForTimeout(150);
    check('點目前時間的連結複製 https://youtu.be/ID?t=23（FR-31）', (await clipboard(page)) === 'https://youtu.be/jNQXAC9IVRw?t=23');
    await page.locator('yte-toolbar .yte-copylink-row[data-kind="plain"]').click();
    await page.waitForTimeout(150);
    check('點不含時間的連結複製 https://youtu.be/ID（FR-31）', (await clipboard(page)) === 'https://youtu.be/jNQXAC9IVRw');

    // 換頁後（釘選面板）更新為新影片
    await page.locator('yte-toolbar .yte-panel-pin, yte-toolbar [aria-label="Pin panel"]').first().click();
    await spaNavigate(page, 'next');
    await page.waitForTimeout(500);
    rows = await linkRows(page);
    check(
      '釘選的面板換頁後顯示新影片的連結與標題',
      rows[2]?.full === 'https://youtu.be/aaaaaaaaaaa' && rows[1]?.full.startsWith('[Fixture video aaaaaaaaaaa（'),
      rows.map((r) => r.full).join(' | '),
    );

    // 播放清單中的影片：不帶播放清單參數
    await page.goto('https://www.youtube.com/watch?v=bbbbbbbbbbb&list=PLabcdefghijklmnop&index=3&pp=xyz');
    await page.waitForSelector('yte-toolbar', { state: 'attached' });
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1);
    await seek(page, 12.2);
    await button(page, 'link').click();
    await page.waitForSelector('yte-toolbar .yte-copylink-row');
    await page.locator('yte-toolbar .yte-copylink-row[data-kind="time"]').click();
    await page.waitForTimeout(150);
    const fromList = await clipboard(page);
    check('從播放清單打開的影片，複製的連結不含播放清單參數（FR-35）', fromList === 'https://youtu.be/bbbbbbbbbbb?t=12', fromList);

    // 複製失敗：瀏覽器拒絕剪貼簿存取
    const cdp = await context.newCDPSession(page);
    for (const allowWithoutSanitization of [false, true]) {
      await cdp.send('Browser.setPermission', {
        permission: { name: 'clipboard-write', allowWithoutSanitization },
        setting: 'denied',
        origin: 'https://www.youtube.com',
      });
    }
    await page.locator('yte-toolbar .yte-copylink-row[data-kind="markdown"]').click();
    await page.waitForTimeout(300);
    const manual = await page.evaluate(() => {
      const root = document.querySelector('yte-toolbar').shadowRoot;
      const ta = root.querySelector('.yte-copylink-manual-text');
      return {
        error: root.querySelector('.yte-copylink-manual [role="alert"]')?.textContent ?? null,
        value: ta?.value ?? null,
        selected: ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : null,
        focused: root.activeElement === ta,
      };
    });
    if (manual.error === null && manual.value === null) {
      skip('複製失敗時顯示錯誤與可以手動選取的文字框（FR-34）', '本環境無法讓瀏覽器拒絕剪貼簿寫入');
    } else {
      check(
        '複製失敗時顯示錯誤，並改為顯示可以手動選取的文字框（FR-34）',
        !!manual.error && manual.value === '[Fixture video（00:12）](https://youtu.be/bbbbbbbbbbb?t=12)' && manual.selected === manual.value && manual.focused,
        JSON.stringify(manual),
      );
      await shot(page, 'T28-link-panel-copy-failed.png');
    }
  },
  { permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1280, height: 1100 } },
);

if (!summary()) process.exitCode = 1;
void EXT_ID;
void skip;

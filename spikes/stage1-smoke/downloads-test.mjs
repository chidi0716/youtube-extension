// 階段 4a（002：縮圖、截圖、字幕直接下載、影片／MP3 面板的未連線狀態）在本機假觀看頁上的驗收檢查與截圖。
// 縮圖各尺寸與字幕檔由 lib.mjs 的 route 回應（不連外）；下載的檔案存到 .cache/downloads-<任務>/，
// 以瀏覽器設定檔的偏好指定，並以 Chrome DevTools Protocol 把 Playwright 的下載攔截改回瀏覽器預設，
// 讓檔名維持擴充功能以 downloads API 指定的名稱。
//   npm install --no-save playwright-core@1.56.1 && npm run build
//   PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 node spikes/stage1-smoke/downloads-test.mjs
//   ONLY=T17 … # 只跑某個任務
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { EXT_ID, WATCH, button, captionRequests, launch, openWatch, reporter, root, shot, spaNavigate, thumbnailRequests } from './lib.mjs';

const { check, skip, summary } = reporter();
const only = process.env.ONLY;
const want = (task) => !only || only.split(',').includes(task);
if (!process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS) {
  console.log('請以 PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 執行：背景腳本（service worker）的請求才會由假頁面回應。');
  process.exit(2);
}

async function section(task, fn, options = {}) {
  if (!want(task)) return;
  console.log(`\n== ${task}`);
  const downloads = join(root, 'spikes', 'stage1-smoke', '.cache', `downloads-${task}`);
  rmSync(downloads, { recursive: true, force: true });
  mkdirSync(downloads, { recursive: true });
  const context = await launch({
    name: `dl-${task}`,
    lang: options.lang,
    viewport: options.viewport ?? { width: 1280, height: 1000 },
    downloadDir: downloads,
    userAgent: options.userAgent,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  page.on('pageerror', (err) => console.log('  pageerror:', String(err).slice(0, 200)));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'default' });
  try {
    if (options.open !== false) await openWatch(page, options.url ?? WATCH);
    await fn(page, context, downloads);
  } catch (err) {
    check(`${task} script`, false, String(err).split('\n').slice(0, 3).join(' | '));
    await page.screenshot({ path: `${root}/spikes/stage1-smoke/.cache/error-dl-${task}.png` }).catch(() => {});
  } finally {
    await context.close();
  }
}

/** 等下載資料夾出現指定名稱的檔案（下載完成、不是 .crdownload）。 */
async function waitForFile(dir, name, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (existsSync(join(dir, name))) return readFileSync(join(dir, name));
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
const listFiles = (dir) => readdirSync(dir).filter((f) => !f.endsWith('.crdownload')).sort();

/** JPEG／PNG 的寬高（讀檔頭）。 */
function imageSize(buf) {
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return { type: 'jpg', width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

const panelText = (page) => page.evaluate(() => document.querySelector('yte-toolbar').shadowRoot.querySelector('.yte-panel')?.innerText ?? '');
const tooltipOf = (page, id) =>
  page.evaluate((id) => {
    const tip = document.querySelector('yte-toolbar').shadowRoot.querySelector(`.yte-btn[data-button="${id}"] + .yte-tooltip`);
    return { text: tip?.textContent, notice: tip?.hasAttribute('data-notice') };
  }, id);

// ---------------------------------------------------------------------------
// T17 截圖與縮圖（002 FR-30 至 FR-32、FR-50 至 FR-53）
// ---------------------------------------------------------------------------
await section('T17', async (page, context, dl) => {
  // ---- 縮圖 ----
  await button(page, 'thumbnail').click();
  await page.waitForSelector('yte-toolbar .yte-thumb-row', { timeout: 8000 });
  const rows = await page.evaluate(() =>
    [...document.querySelector('yte-toolbar').shadowRoot.querySelectorAll('.yte-thumb-row')].map((r) => ({
      key: r.dataset.key,
      size: r.querySelector('.yte-thumb-size').textContent.replace(/\s+/g, ' '),
      preview: r.querySelector('img').complete && r.querySelector('img').naturalWidth > 0,
    })),
  );
  const requested = [...new Set(thumbnailRequests.filter((r) => r.startsWith('jNQXAC9IVRw/')))].sort();
  check(
    '縮圖面板只列出實際存在的尺寸，404 與 120×90 預設圖不列出（FR-30）',
    rows.map((r) => r.key).join() === 'hqdefault,mqdefault' && requested.length === 4,
    `${rows.map((r) => `${r.key}=${r.size}`).join(', ')}；背景腳本檢查了 ${requested.join(', ')}`,
  );
  check('每個尺寸有預覽小圖（FR-30）', rows.every((r) => r.preview));
  await shot(page, 'T17-thumbnail-panel.png');

  await page.locator('yte-toolbar .yte-thumb-row[data-key="hqdefault"]').click();
  const thumbFile = await waitForFile(dl, 'Fixture video [jNQXAC9IVRw].jpg');
  const thumbSize = thumbFile && imageSize(thumbFile);
  check(
    '點尺寸即下載該圖片，檔名「標題 [ID].jpg」、尺寸正確、維持 JPG（FR-31、FR-8）',
    thumbSize?.type === 'jpg' && thumbSize.width === 480 && thumbSize.height === 360,
    `${listFiles(dl).join(', ')} ${JSON.stringify(thumbSize)}`,
  );
  await page.waitForTimeout(200);
  check('下載後該列顯示「已存到下載資料夾」', /Saved to Downloads/.test(await panelText(page)));

  // 全部尺寸都有的影片；200 但內容是 120×90 預設圖的尺寸也要排除
  await page.keyboard.press('Escape');
  await spaNavigate(page, 'next');
  await button(page, 'thumbnail').click();
  await page.waitForSelector('yte-toolbar .yte-thumb-row');
  const all = await page.evaluate(() => [...document.querySelector('yte-toolbar').shadowRoot.querySelectorAll('.yte-thumb-row')].map((r) => r.querySelector('.yte-thumb-size').textContent.replace(/\s+/g, '')));
  check('有全部尺寸的影片列出 1280×720、640×480、480×360、320×180（FR-30）', all.join() === '1280×720,640×480,480×360,320×180', all.join());
  await page.locator('yte-toolbar .yte-thumb-row').first().click();
  const maxFile = await waitForFile(dl, 'Fixture video aaaaaaaaaaa [aaaaaaaaaaa].jpg');
  check('下載的最高畫質縮圖為 1280×720', JSON.stringify(maxFile && imageSize(maxFile)) === '{"type":"jpg","width":1280,"height":720}');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__fixtureNavigate('bbbbbbbbbbb'));
  await page.waitForTimeout(300);
  await button(page, 'thumbnail').click();
  await page.waitForSelector('yte-toolbar .yte-thumb-row');
  const keysB = await page.evaluate(() => [...document.querySelector('yte-toolbar').shadowRoot.querySelectorAll('.yte-thumb-row')].map((r) => r.dataset.key));
  check('回應 200 但內容是 120×90 預設圖的尺寸不列出（plan 3.8）', !keysB.includes('maxresdefault') && keysB.length === 3, keysB.join());
  await page.keyboard.press('Escape');

  // ---- 截圖 ----
  await page.evaluate(async () => {
    const v = document.querySelector('video');
    v.currentTime = 12.4;
    await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
  });
  const native = await page.evaluate(() => ({ w: document.querySelector('video').videoWidth, h: document.querySelector('video').videoHeight }));
  await button(page, 'screenshot').click();
  const png = await waitForFile(dl, 'Fixture video bbbbbbbbbbb [bbbbbbbbbbb] 00m12s.png');
  const pngSize = png && imageSize(png);
  check(
    '截圖以原始影片解析度存成 PNG，檔名「標題 [ID] 00m12s.png」（FR-50、FR-51）',
    pngSize?.type === 'png' && pngSize.width === native.w && pngSize.height === native.h,
    `${listFiles(dl).filter((f) => f.endsWith('.png')).join(', ')} ${JSON.stringify(pngSize)} 影片 ${native.w}×${native.h}`,
  );
  await page.waitForTimeout(150);
  const tip = await tooltipOf(page, 'screenshot');
  check('擷取成功後按鈕短暫顯示完成提示（FR-52）', tip.notice && tip.text === 'Screenshot saved', JSON.stringify(tip));
  await shot(page, 'T17-screenshot-saved.png');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(2800);
  const tipAfter = await tooltipOf(page, 'screenshot');
  check('提示數秒後恢復為按鈕名稱', !tipAfter.notice && tipAfter.text === 'Screenshot', JSON.stringify(tipAfter));

  // 截圖的內容只有影片畫面：與直接把 <video> 畫到 canvas 的結果相同，不含 YouTube 的控制列（假頁面的按鈕疊在影片上）
  const pixelCheck = await page.evaluate(async (b64) => {
    const v = document.querySelector('video');
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    // 假頁面的「Play/Pause」「Autoplay」按鈕在影片右下角；截圖該處應是影片畫面（與 <video> 本身相同）
    const fromShot = ctx.getImageData(c.width - 40, c.height - 20, 1, 1).data.join();
    ctx.drawImage(v, 0, 0);
    const fromVideo = ctx.getImageData(c.width - 40, c.height - 20, 1, 1).data.join();
    return { fromShot, fromVideo };
  }, png.toString('base64'));
  check('截圖不含播放器的控制列或疊加資訊（FR-50）', pixelCheck.fromShot === pixelCheck.fromVideo, JSON.stringify(pixelCheck));

  // 影片還沒載入時：顯示錯誤提示（FR-52）
  await page.evaluate(() => {
    const v = document.querySelector('video');
    v.removeAttribute('src');
    v.load();
  });
  await button(page, 'screenshot').click();
  await page.waitForTimeout(150);
  const failTip = await tooltipOf(page, 'screenshot');
  check('無法擷取時顯示錯誤提示（FR-52）', failTip.notice && failTip.text === "The video isn't ready yet", JSON.stringify(failTip));

  // 縮圖與截圖不需要橋接程式（FR-32、FR-53）：本環境沒有橋接程式，以上都已完成
  check('縮圖與截圖不需要橋接程式（FR-32、FR-53）', listFiles(dl).length === 3, listFiles(dl).join(', '));
});

if (!summary()) process.exitCode = 1;
void EXT_ID;
void skip;
void captionRequests;

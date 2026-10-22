// 假觀看頁（watch.html）的附加模擬：階段 2b、2c（004、005）需要的 YouTube 行為。
// 由 watch.html 最後以 <script src="/__fixture/stage2c-watch.js"> 載入，內容全部是假的。
// 分開成獨立檔案，讓 watch.html 本身（深色模式等其他任務也會修改）只多一行。
(function () {
  const player = document.getElementById('movie_player');
  const video = player.querySelector('video');
  const videoId = () => new URL(location.href).searchParams.get('v');

  // 每部假影片的設定：最高畫質、語音軌的情況。
  //   single：只有一個語音軌；dubbed：原始語音＋自動配音，預設播放自動配音；original：多語音軌，預設就是原始語音。
  const VIDEOS = {
    jNQXAC9IVRw: { max: 'hd2160', audio: 'single' },
    aaaaaaaaaaa: { max: 'hd720', audio: 'dubbed' },
    bbbbbbbbbbb: { max: 'hd1080', audio: 'single' },
    ccccccccccc: { max: 'hd1080', audio: 'original' },
    ddddddddddd: { max: 'hd1080', audio: 'dubbed' },
  };
  const config = () => VIDEOS[videoId()] ?? { max: 'hd1080', audio: 'single' };

  // 給測試讀取的紀錄
  window.__fixtureLog = [];
  const log = (entry) => window.__fixtureLog.push({ t: Math.round(performance.now()), ...entry });

  // -------------------------------------------------------------------------
  // 畫質（004 第 1 節）：模擬 YouTube 播放器的畫質方法（名稱依真實播放器上列出的方法）。
  // - 影片一開始以 YouTube 自動決定的畫質（medium）播放；
  // - 畫質改變時 <video> 發出 resize 事件（真實的 <video> 在解析度改變時會發出）；
  // - window.__fixtureAutoQuality(q) 模擬 YouTube 自動改變畫質（例如網路變慢）；
  // - 播放器的設定（齒輪）選單可以手動選畫質與語音軌。
  // -------------------------------------------------------------------------
  const ORDER = ['highres', 'hd2880', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
  const levels = () => ORDER.slice(ORDER.indexOf(config().max));
  let quality = 'medium';
  let range = null;
  const changeQuality = (q, source) => {
    if (q === quality) return;
    quality = q;
    log({ type: 'quality', quality: q, source });
    player.dataset.quality = q;
    setTimeout(() => video.dispatchEvent(new Event('resize')), 30);
  };
  player.getAvailableQualityLevels = () => [...levels(), 'auto'];
  player.getPlaybackQuality = () => quality;
  player.setPlaybackQualityRange = (min, max) => {
    range = min === 'auto' ? null : [min, max];
    log({ type: 'range', min, max });
  };
  player.setPlaybackQuality = (q) => {
    if (q === 'auto') {
      log({ type: 'quality-auto' });
      return;
    }
    if (levels().includes(q)) changeQuality(q, 'api');
  };
  window.__fixtureAutoQuality = (q) => changeQuality(q, 'youtube-auto');
  window.__fixtureQuality = () => ({ quality, range });

  // -------------------------------------------------------------------------
  // 語音軌（005 FR-10 至 FR-13）：物件結構依真實播放器的 getAudioTrack() 回傳值
  // （id、內含 name／id／isDefault／isAutoDubbed 的物件、xtags）。
  // -------------------------------------------------------------------------
  const track = (id, name, isDefault, isAutoDubbed) => ({
    id,
    Nb: { name, id, isDefault, isAutoDubbed },
    xtags: '',
    captionTracks: [],
  });
  const tracksFor = () => {
    switch (config().audio) {
      case 'dubbed':
        return [track('en.4', 'English original', true, false), track('es.3', 'Spanish (auto-dubbed)', false, true), track('ja.3', 'Japanese (auto-dubbed)', false, true)];
      case 'original':
        return [track('en.4', 'English original', true, false), track('es.3', 'Spanish (auto-dubbed)', false, true)];
      default:
        return [track('und', 'Default', true, false)];
    }
  };
  let tracks = tracksFor();
  let currentTrack = tracks.find((t) => t.Nb.isAutoDubbed) ?? tracks[0];
  if (config().audio === 'original') currentTrack = tracks[0];
  player.getAvailableAudioTracks = () => (tracks.length > 1 ? tracks.slice() : []);
  player.getAudioTrack = () => currentTrack;
  player.setAudioTrack = (t) => {
    const found = tracks.find((x) => x === t);
    if (!found) return false;
    currentTrack = found;
    log({ type: 'audio', id: found.id, source: 'api', time: video.currentTime });
    return true;
  };
  window.__fixtureAudio = () => ({ id: currentTrack.id, time: video.currentTime });

  const resetForVideo = () => {
    quality = 'medium';
    range = null;
    tracks = tracksFor();
    currentTrack = config().audio === 'dubbed' ? tracks.find((t) => t.Nb.isAutoDubbed) : tracks[0];
    renderSettingsMenu();
  };

  // 設定（齒輪）選單：畫質與語音軌。點選即手動改變（YouTube 自己的處理也會取消畫質範圍）。
  const style = document.createElement('style');
  style.textContent = `
    .ytp-settings-button { position: absolute; right: 12px; top: 12px; z-index: 20; }
    .ytp-settings-menu { position: absolute; right: 12px; top: 44px; z-index: 30; padding: 8px; border-radius: 12px;
      background: rgba(28, 28, 28, 0.9); color: #fff; font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
    .ytp-settings-menu[hidden] { display: none; }
    .ytp-settings-menu button { border: 0; background: none; color: inherit; text-align: left; font: inherit; padding: 2px 8px; }
  `;
  document.head.append(style);
  const gear = document.createElement('button');
  gear.className = 'ytp-button ytp-settings-button';
  gear.type = 'button';
  gear.textContent = 'Settings';
  const menu = document.createElement('div');
  menu.className = 'ytp-popup ytp-settings-menu';
  menu.hidden = true;
  player.append(gear, menu);
  gear.addEventListener('click', () => (menu.hidden = !menu.hidden));
  function renderSettingsMenu() {
    menu.replaceChildren();
    for (const q of levels()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.quality = q;
      b.textContent = q;
      b.addEventListener('click', () => {
        range = null;
        changeQuality(q, 'user');
        menu.hidden = true;
      });
      menu.append(b);
    }
    for (const t of tracks.length > 1 ? tracks : []) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.audio = t.id;
      b.textContent = t.Nb.name;
      b.addEventListener('click', () => {
        currentTrack = t;
        log({ type: 'audio', id: t.id, source: 'user', time: video.currentTime });
        menu.hidden = true;
      });
      menu.append(b);
    }
  }
  renderSettingsMenu();

  // -------------------------------------------------------------------------
  // 片尾推薦卡片與結尾畫面（005 FR-20 至 FR-22）。class 名稱依真實播放器（results-watch.txt、
  // results-details.txt）與公開觀察：
  // - 片尾卡片 .ytp-ce-element（在 .ytp-player-content.ytp-iv-player-content 中），最後 8 秒顯示；
  // - 播完後：播放器加上 ended-mode；自動播放關閉時顯示 .html5-endscreen.videowall-endscreen
  //   （.ytp-endscreen-content 中的推薦影片格子），以及 .ytp-fullscreen-grid 中的推薦格子（假設：新版播放器
  //   在播完時也以這個格子顯示推薦影片，未在真實頁面確認）；
  // - 自動播放開啟時顯示 .ytp-autonav-endscreen-countdown-overlay 倒數，2 秒後換到下一部影片。
  // -------------------------------------------------------------------------
  const endStyle = document.createElement('style');
  endStyle.textContent = `
    .ytp-ce-element { position: absolute; z-index: 15; display: none; width: 22%; height: 22%; border-radius: 6px; background: #3a7; color: #fff; font-size: 12px; padding: 4px; cursor: pointer; }
    .ytp-ce-element.ytp-ce-element-show { display: block; }
    .ytp-ce-video { right: 4%; top: 10%; }
    .ytp-ce-channel { right: 4%; top: 40%; border-radius: 50%; width: 12%; }
    .html5-endscreen { position: absolute; inset: 0; z-index: 16; display: none; }
    .html5-video-player.ended-mode .html5-endscreen.videowall-endscreen { display: block; }
    .ytp-endscreen-content { position: absolute; inset: 8%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .ytp-videowall-still { background: #a63; color: #fff; font-size: 12px; padding: 4px; border-radius: 4px; }
    .ytp-autonav-endscreen-countdown-overlay { position: absolute; inset: 30% 25%; z-index: 17; display: none; background: rgba(0,0,0,.8); color: #fff; padding: 12px; border-radius: 8px; }
    .html5-video-player.ended-mode.fixture-autonav .ytp-autonav-endscreen-countdown-overlay { display: block; }
    .ytp-fullscreen-grid { position: absolute; inset: auto 0 0 0; height: 40%; z-index: 14; display: none; }
    .html5-video-player.ended-mode .ytp-fullscreen-grid { display: block; }
    .ytp-fullscreen-grid-stills-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 6px; }
    .ytp-fullscreen-grid-stills-container > div { height: 40px; background: #36a; color: #fff; font-size: 11px; }
  `;
  document.head.append(endStyle);
  const ivContent = document.createElement('div');
  ivContent.className = 'ytp-player-content ytp-iv-player-content';
  ivContent.innerHTML =
    '<div class="ytp-ce-element ytp-ce-video">End card: next video</div><div class="ytp-ce-element ytp-ce-channel">Channel</div>';
  const endscreen = document.createElement('div');
  endscreen.className = 'html5-endscreen ytp-player-content videowall-endscreen';
  endscreen.innerHTML = `<div class="ytp-endscreen-content">${'<a class="ytp-videowall-still" href="/watch?v=aaaaaaaaaaa">Suggested</a>'.repeat(6)}</div>`;
  const countdown = document.createElement('div');
  countdown.className = 'ytp-autonav-endscreen-countdown-overlay';
  countdown.textContent = 'Up next in 2';
  const grid = document.createElement('div');
  grid.className = 'ytp-fullscreen-grid';
  grid.innerHTML = `<div class="ytp-fullscreen-grid-main-content"><div class="ytp-fullscreen-grid-stills-container">${'<div>Suggested</div>'.repeat(8)}</div></div>`;
  player.append(ivContent, endscreen, countdown, grid);
  const autonavOn = () => player.querySelector('.ytp-autonav-toggle-button')?.getAttribute('aria-checked') === 'true';
  let autonavTimer = 0;
  window.__fixtureAutonavFired = false;
  video.addEventListener('timeupdate', () => {
    const show = video.duration - video.currentTime <= 8 && !video.ended;
    for (const el of ivContent.querySelectorAll('.ytp-ce-element')) el.classList.toggle('ytp-ce-element-show', show);
  });
  video.addEventListener('ended', () => {
    player.classList.add('ended-mode');
    player.classList.toggle('fixture-autonav', autonavOn());
    for (const el of ivContent.querySelectorAll('.ytp-ce-element')) el.classList.remove('ytp-ce-element-show');
    if (autonavOn()) {
      autonavTimer = setTimeout(() => {
        window.__fixtureAutonavFired = true;
        document.getElementById('next').click();
      }, 2000);
    }
  });
  const leaveEnded = () => {
    clearTimeout(autonavTimer);
    player.classList.remove('ended-mode', 'fixture-autonav');
  };
  video.addEventListener('play', leaveEnded);
  video.addEventListener('seeking', leaveEnded);

  // -------------------------------------------------------------------------
  // 觀看頁推薦清單（005 FR-60、FR-70）：Shorts 區塊 ytd-reel-shelf-renderer、長標題的
  // yt-lockup-view-model 與舊版 ytd-compact-video-renderer、連到 /shorts/ 的個別項目。
  // -------------------------------------------------------------------------
  const LONG = 'A recommended fixture video with a really long title that YouTube would normally cut off after two lines in the sidebar';
  const relStyle = document.createElement('style');
  relStyle.textContent = `
    #related ytd-reel-shelf-renderer, #related yt-lockup-view-model, #related ytd-compact-video-renderer { display: flex; gap: 8px; margin-top: 12px; }
    #related ytd-reel-shelf-renderer { display: block; }
    #related ytd-reel-shelf-renderer #items { display: flex; gap: 6px; }
    #related ytm-shorts-lockup-view-model-v2 { display: block; width: 100px; height: 160px; background: #c9c9ff; border-radius: 8px; }
    #related a#thumbnail { display: block; flex: none; width: 168px; aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; background: #ddd; }
    #related a#thumbnail img { width: 100%; height: 100%; object-fit: cover; display: block; }
    #related .ytLockupMetadataViewModelTitle, #related #video-title {
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; max-height: 40px; overflow: hidden;
      font-size: 14px; line-height: 20px; color: inherit; text-decoration: none; margin: 0; }
    #related .meta { color: #606060; font-size: 12px; }
    #related h3 { margin: 0; }
  `;
  document.head.append(relStyle);
  const related = document.createElement('div');
  related.id = 'related';
  const thumbHtml = (id, href) => `<ytd-thumbnail><a id="thumbnail" href="${href}"><img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt=""></a></ytd-thumbnail>`;
  related.innerHTML = `
    <yt-lockup-view-model data-fixture="video">${thumbHtml('rel1xxxxxxx', '/watch?v=rel1xxxxxxx')}<div><h3><a class="ytLockupMetadataViewModelTitle" href="/watch?v=rel1xxxxxxx"><span>${LONG}</span></a></h3><div class="meta">Related channel</div></div></yt-lockup-view-model>
    <ytd-reel-shelf-renderer id="fixture-related-shorts"><h2>Shorts</h2><yt-horizontal-list-renderer><div id="items">
      ${[1, 2, 3].map((n) => `<ytm-shorts-lockup-view-model-v2><ytm-shorts-lockup-view-model><a class="shortsLockupViewModelHostEndpoint reel-item-endpoint" href="/shorts/rsh${n}xxxxxxx">Short ${n}</a></ytm-shorts-lockup-view-model></ytm-shorts-lockup-view-model-v2>`).join('')}
    </div></yt-horizontal-list-renderer></ytd-reel-shelf-renderer>
    <ytd-compact-video-renderer data-fixture="video">${thumbHtml('rel2xxxxxxx', '/watch?v=rel2xxxxxxx')}<div><h3><span id="video-title" title="${LONG}">${LONG}</span></h3><div class="meta">Compact channel</div></div></ytd-compact-video-renderer>
    <yt-lockup-view-model data-fixture="short">${thumbHtml('rsh9xxxxxxx', '/shorts/rsh9xxxxxxx')}<div><h3><a class="ytLockupMetadataViewModelTitle" href="/shorts/rsh9xxxxxxx"><span>A short in the list</span></a></h3></div></yt-lockup-view-model>
  `;
  document.getElementById('secondary').append(related);

  // -------------------------------------------------------------------------
  // 「影片已暫停，要繼續觀看嗎？」（005 FR-30、FR-31）：ytd-popup-container（真實頁面在 ytd-app 底下）
  // 中出現 tp-yt-paper-dialog > yt-confirm-dialog-renderer，按「是」（#confirm-button）後關閉並繼續播放。
  // 對話框的元素名稱依公開觀察，未在真實頁面看到。第一次建立，之後以 display 切換（模擬重複使用）。
  // -------------------------------------------------------------------------
  // 真實頁面只有一個 ytd-popup-container（外觀選單也在其中），已存在時共用。
  let popup = document.querySelector('ytd-popup-container');
  if (!popup) {
    popup = document.createElement('ytd-popup-container');
    document.querySelector('ytd-app').append(popup);
  }
  let dialog = null;
  const showDialog = (text, onConfirm) => {
    if (!dialog) {
      dialog = document.createElement('tp-yt-paper-dialog');
      dialog.style.cssText = 'position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:2200;background:#fff;color:#0f0f0f;padding:16px 24px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.4);display:none';
      dialog.innerHTML =
        '<yt-confirm-dialog-renderer><p id="fixture-dialog-text"></p><div id="buttons"><yt-button-renderer id="cancel-button"><button type="button">Cancel</button></yt-button-renderer> <yt-button-renderer id="confirm-button"><button type="button">Yes</button></yt-button-renderer></div></yt-confirm-dialog-renderer>';
      popup.append(dialog);
    }
    dialog.querySelector('#fixture-dialog-text').textContent = text;
    const close = () => {
      dialog.style.display = 'none';
    };
    dialog.querySelector('#confirm-button button').onclick = () => {
      close();
      log({ type: 'dialog-confirm' });
      onConfirm?.();
    };
    dialog.querySelector('#cancel-button button').onclick = close;
    dialog.style.display = 'block';
  };
  // YouTube 長時間沒有互動時：暫停影片並詢問
  window.__fixtureShowContinueDialog = () => {
    video.pause();
    setTimeout(() => showDialog('Video paused. Continue watching?', () => video.play()), 50);
  };
  // 使用者自己的操作造成的確認對話框（例如從播放清單移除）：不暫停影片
  window.__fixtureShowOtherDialog = () => showDialog('Remove from playlist?', () => {});
  window.__fixtureDialogVisible = () => !!dialog && dialog.style.display !== 'none';

  // 縮圖自動預覽與站內換頁到 Shorts（與假首頁、假搜尋頁共用）
  const browse = document.createElement('script');
  browse.src = '/__fixture/browse.js';
  document.body.append(browse);

  // 測試用：站內換頁到任一部假影片（與 watch.html 中 #secondary 連結的處理相同）。
  window.__fixtureNavigate = (id) => {
    history.pushState({}, '', `/watch?v=${id}`);
    document.querySelector('h1').textContent = 'Fixture video ' + id;
    video.currentTime = 0;
    document.dispatchEvent(new CustomEvent('yt-navigate-finish'));
  };

  // 站內換頁：模擬新影片載入。以捕獲階段先處理，擴充功能的換頁處理讀到的已是新影片的狀態。
  document.addEventListener(
    'yt-navigate-finish',
    () => {
      resetForVideo();
      setTimeout(() => video.dispatchEvent(new Event('loadedmetadata')), 50);
    },
    true,
  );
})();

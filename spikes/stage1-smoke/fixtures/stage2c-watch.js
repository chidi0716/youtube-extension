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

// 假首頁、假搜尋頁與假觀看頁共用的模擬（階段 2c，005）。內容全部是假的，元素名稱與 class 依
// 2026-10-22 在真實 YouTube 首頁、搜尋頁、觀看頁上觀察到的結構（spikes/stage2c/results-*.txt）。
// - 縮圖自動預覽：游標停在縮圖（a#thumbnail）上 400ms 後，ytd-app 底下唯一的 #video-preview 移到縮圖上方
//   並播放靜音影片；離開時隱藏。
// - 站內換頁到 Shorts：點 /shorts/<ID> 連結時以 pushState 改網址並發出 yt-navigate-finish（模擬 YouTube SPA）。
(function () {
  const app = document.querySelector('ytd-app');
  if (!app) return;

  // ---- 縮圖自動預覽 ----
  const preview = document.createElement('div');
  preview.id = 'video-preview';
  preview.innerHTML =
    '<ytd-video-preview-loader><div id="inline-preview-player"><video muted loop playsinline src="/__fixture/test.webm"></video></div></ytd-video-preview-loader>';
  app.append(preview);
  const style = document.createElement('style');
  style.textContent = `
    #video-preview { position: absolute; z-index: 1000; display: none; overflow: hidden; border-radius: 12px; background: #000; cursor: pointer; }
    #video-preview[active] { display: block; }
    #video-preview video { display: block; width: 100%; height: 100%; object-fit: cover; }
  `;
  document.head.append(style);
  const previewVideo = preview.querySelector('video');
  let timer = 0;
  let current = null;
  window.__fixturePreviewStarts = 0;
  const hide = () => {
    clearTimeout(timer);
    current = null;
    preview.removeAttribute('active');
    previewVideo.pause();
  };
  document.addEventListener('mouseover', (e) => {
    const thumb = e.target.closest?.('a#thumbnail');
    if (!thumb || thumb === current || preview.contains(e.target)) return;
    clearTimeout(timer);
    current = thumb;
    timer = setTimeout(() => {
      const r = thumb.getBoundingClientRect();
      Object.assign(preview.style, {
        left: `${r.left + scrollX}px`,
        top: `${r.top + scrollY}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
      preview.setAttribute('active', '');
      preview.dataset.href = thumb.getAttribute('href');
      window.__fixturePreviewStarts++;
      void previewVideo.play().catch(() => {});
    }, 400);
  });
  document.addEventListener('mouseout', (e) => {
    if (!current) return;
    const to = e.relatedTarget;
    if (to && (current.contains(to) || preview.contains(to))) return;
    if (e.target === current || current.contains(e.target) || preview.contains(e.target)) hide();
  });
  // 真實 YouTube 的預覽蓋在縮圖上，點它也會開啟影片。
  preview.addEventListener('click', () => {
    if (preview.dataset.href) location.href = preview.dataset.href;
  });

  // ---- 站內換頁到 Shorts ----
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="/shorts/"]');
    if (!a || e.defaultPrevented) return;
    e.preventDefault();
    history.pushState({}, '', a.getAttribute('href'));
    document.dispatchEvent(new CustomEvent('yt-navigate-finish'));
  });
})();

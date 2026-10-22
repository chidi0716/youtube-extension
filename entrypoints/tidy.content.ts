// 頁面整理（005）與 CSS 開關機制（plan 3.7.2）的內容腳本（isolated world）。
// 在 document_start 執行，頁面一開始畫出來就套用 class；在 YouTube 所有頁面作用，
// 但只在 www.youtube.com 與 youtube.com（005 FR-5）。
import { startPageTidy } from '@/features/tidy';
import { createAutoContinue, createOriginalAudio, createShortsRedirect } from '@/features/tidy/scripts';
import { WATCH_HOSTS } from '@/utils/youtube/dom';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_start',
  main(ctx) {
    if (!WATCH_HOSTS.includes(location.hostname)) return;
    try {
      startPageTidy(ctx, {
        originalAudio: createOriginalAudio(),
        autoContinue: createAutoContinue(),
        shortsToWatch: createShortsRedirect(),
      });
    } catch (err) {
      // 不得讓 YouTube 頁面出錯（constitution 第 7 點）。
      console.info('[youtube-extension] page tidy failed to start', err);
    }
  },
});

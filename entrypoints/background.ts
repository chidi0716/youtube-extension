import { handleDownloadMessage } from '@/features/downloads/background';
import { handleHostMessage, onNotificationClicked, resumeDownloads } from '@/features/downloads/host-background';
import { isContentMessage } from '@/utils/messages';

export default defineBackground(() => {
  // 監聽器必須在頂層同步註冊（Firefox 事件頁面，見 specs/notes/T00-firefox-mv3.md）。
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 只接受本擴充功能自己的內容腳本或頁面送來、且格式正確的訊息。
    if (sender.id !== browser.runtime.id || !isContentMessage(message)) return;
    switch (message.type) {
      case 'openOptions':
        void browser.runtime.openOptionsPage();
        return;
      default:
        // 經由橋接程式的下載（階段 4）；縮圖、截圖、直接下載的字幕（階段 4a）。
        // 非同步處理後以 sendResponse 回覆。
        return handleHostMessage(message, sender.tab?.id, sendResponse) || handleDownloadMessage(message, sendResponse);
    }
  });
  // 點下載完成的通知：在 Finder／檔案總管中顯示檔案（002 FR-5）。
  browser.notifications.onClicked.addListener(onNotificationClicked);
  // 有進行中的下載時重新連線，繼續接收進度並補發通知（002 FR-7、plan 4.6）。
  void resumeDownloads();
});

import { handleDownloadMessage } from '@/features/downloads/background';
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
        // 縮圖、截圖、字幕（階段 4a）：非同步處理後以 sendResponse 回覆。
        return handleDownloadMessage(message, sendResponse);
    }
  });
});

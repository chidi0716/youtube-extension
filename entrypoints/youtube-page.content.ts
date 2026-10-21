// 頁面橋接腳本（main world，plan 3.5）。
// 只負責呼叫 YouTube 播放器物件的公開方法，並以事件回覆內容腳本。
// 這支腳本隨擴充功能打包、由 manifest 宣告，不是動態注入的外部程式。
import {
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
  handleBridgeRequest,
  parseBridgeRequest,
  type BridgePlayer,
} from '@/utils/youtube/bridge';
import { findPlayer } from '@/utils/youtube/dom';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    document.addEventListener(BRIDGE_REQUEST_EVENT, (event) => {
      const req = parseBridgeRequest((event as CustomEvent<unknown>).detail);
      if (!req) return;
      const player = findPlayer() as (HTMLElement & BridgePlayer) | null;
      const res = handleBridgeRequest(req, player);
      document.dispatchEvent(new CustomEvent(BRIDGE_RESPONSE_EVENT, { detail: JSON.stringify(res) }));
    });
  },
});

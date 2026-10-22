// 內容腳本 → 背景腳本的訊息型別（plan 3.1）。背景腳本只處理通過驗證的訊息。
// 下載相關的訊息（階段 4a）只帶影片 ID、尺寸代號等經過驗證的值；檔名與縮圖網址由背景腳本組出。
import { isThumbnailKey, type ThumbnailKey } from './youtube/dom';
import { isValidVideoId } from './youtube/page';

/** 標題的長度上限（字元）；過長的部分在檔名中也會被截斷。 */
export const MAX_TITLE_CHARS = 500;
/** 截圖 PNG 的 data URL 長度上限（約 48 MB 的圖片）。 */
export const MAX_SCREENSHOT_DATA_URL = 64 * 1024 * 1024;
export const SCREENSHOT_DATA_URL_PREFIX = 'data:image/png;base64,';

export type ContentMessage =
  /** 開啟擴充功能的設定頁（001 FR-17：說明面板中的連結）。 */
  | { type: 'openOptions' }
  /** 檢查縮圖各尺寸是否存在（002 FR-30）。 */
  | { type: 'getThumbnails'; videoId: string }
  /** 下載某個尺寸的縮圖（002 FR-31）。 */
  | { type: 'downloadThumbnail'; videoId: string; title: string; key: ThumbnailKey }
  /** 儲存截圖（002 FR-50、FR-51）：內容腳本畫好的 PNG。 */
  | { type: 'saveScreenshot'; videoId: string; title: string; seconds: number; dataUrl: string };

export type DownloadError = 'INVALID' | 'NOT_FOUND' | 'FETCH_FAILED' | 'EMPTY' | 'DOWNLOAD_FAILED';

export interface ThumbnailInfo {
  key: ThumbnailKey;
  width: number;
  height: number;
  url: string;
}

export type MessageResponse<T = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: DownloadError };

const isTitle = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_TITLE_CHARS;

export function isContentMessage(value: unknown): value is ContentMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  switch (m.type) {
    case 'openOptions':
      return true;
    case 'getThumbnails':
      return isValidVideoId(m.videoId);
    case 'downloadThumbnail':
      return isValidVideoId(m.videoId) && isTitle(m.title) && isThumbnailKey(m.key);
    case 'saveScreenshot':
      return (
        isValidVideoId(m.videoId) &&
        isTitle(m.title) &&
        typeof m.seconds === 'number' &&
        Number.isFinite(m.seconds) &&
        m.seconds >= 0 &&
        typeof m.dataUrl === 'string' &&
        m.dataUrl.startsWith(SCREENSHOT_DATA_URL_PREFIX) &&
        m.dataUrl.length <= MAX_SCREENSHOT_DATA_URL &&
        /^[A-Za-z0-9+/]*={0,2}$/.test(m.dataUrl.slice(SCREENSHOT_DATA_URL_PREFIX.length, SCREENSHOT_DATA_URL_PREFIX.length + 4096))
      );
    default:
      return false;
  }
}

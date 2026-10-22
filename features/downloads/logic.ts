// 不需要橋接程式的下載（階段 4a）與未連線狀態的純邏輯（002 FR-2、FR-30、FR-40、FR-43）。
import { THUMBNAIL_PLACEHOLDER_SIZE } from '@/utils/youtube/dom';

// ---------------------------------------------------------------------------
// 縮圖（FR-30、plan 3.8）
// ---------------------------------------------------------------------------

/** 縮圖是否實際存在：排除 404 等錯誤，以及 YouTube 的 120×90 預設圖。 */
export function isRealThumbnail(status: number, width: number, height: number): boolean {
  if (status < 200 || status >= 300) return false;
  if (!(width > 0 && height > 0)) return false;
  return !(width === THUMBNAIL_PLACEHOLDER_SIZE.width && height === THUMBNAIL_PLACEHOLDER_SIZE.height);
}

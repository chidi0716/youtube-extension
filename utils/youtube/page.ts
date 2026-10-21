// 目前頁面的類型、影片 ID 與換頁事件（plan 3.4）。
// URL 判斷都是純函式；只有 onNavigate 會碰到 DOM。
import { NAVIGATE_FINISH_EVENT, WATCH_HOSTS } from './dom';

export type PageType = 'watch' | 'shorts' | 'embed' | 'home' | 'search' | 'channel' | 'other';

/** YouTube 影片 ID：11 碼英數字、`-`、`_`（002 FR-71）。 */
export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isValidVideoId(id: unknown): id is string {
  return typeof id === 'string' && VIDEO_ID_PATTERN.test(id);
}

function toUrl(url: string | URL): URL | null {
  try {
    return typeof url === 'string' ? new URL(url) : url;
  } catch {
    return null;
  }
}

export function getPageType(url: string | URL): PageType {
  const u = toUrl(url);
  if (!u) return 'other';
  const path = u.pathname;
  if (path === '/watch') return 'watch';
  if (path.startsWith('/shorts/')) return 'shorts';
  if (path.startsWith('/embed/')) return 'embed';
  if (path === '/' || path === '') return 'home';
  if (path === '/results') return 'search';
  if (/^\/(@[^/]+|channel\/|c\/|user\/)/.test(path)) return 'channel';
  return 'other';
}

/** 影片觀看頁的影片 ID；不是觀看頁或 ID 不合法時回傳 null。 */
export function getVideoId(url: string | URL): string | null {
  const u = toUrl(url);
  if (!u || getPageType(u) !== 'watch') return null;
  const id = u.searchParams.get('v');
  return isValidVideoId(id) ? id : null;
}

/**
 * 是否要顯示工具列的觀看頁（001 FR-1）：網址路徑為 `/watch`、帶有合法影片 ID，
 * 而且是 www.youtube.com（m.youtube.com、music.youtube.com 版面不同，不處理）。
 */
export function isWatchPage(url: string | URL): boolean {
  const u = toUrl(url);
  return !!u && WATCH_HOSTS.includes(u.hostname) && getVideoId(u) !== null;
}

/** 監聽 YouTube 換頁完成事件；回傳取消監聽的函式。 */
export function onNavigate(callback: () => void, target: EventTarget = document): () => void {
  target.addEventListener(NAVIGATE_FINISH_EVENT, callback);
  return () => target.removeEventListener(NAVIGATE_FINISH_EVENT, callback);
}

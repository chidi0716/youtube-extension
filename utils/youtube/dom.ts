// ★ 所有依賴 YouTube 頁面結構的選擇器、事件名稱與播放器方法都集中在這個模組
//   （constitution 第 7 點）。YouTube 改版時只需要修改這裡。
//
// 規則：找不到預期的元素時回傳 null，由呼叫端安靜地放棄該功能並在 console 記錄，
// 不得丟出例外讓 YouTube 頁面出錯。

/** YouTube 單頁應用完成換頁時，在 document 上發出的事件。 */
export const NAVIGATE_FINISH_EVENT = 'yt-navigate-finish';

/** 會出現影片觀看頁的網域（不含 m.youtube.com、music.youtube.com 等版面不同的子網域）。 */
export const WATCH_HOSTS: readonly string[] = ['www.youtube.com', 'youtube.com'];

export const SELECTORS = {
  /** 觀看頁的根元素。 */
  watchRoot: 'ytd-watch-flexy',
  /** 播放器（同時也是播放器 API 物件）。 */
  player: '#movie_player',
  /** 播放器內的主要 <video>。 */
  video: '#movie_player video.html5-main-video',
  /** 播放器下方的欄位；工具列插在這裡的最前面，也就是標題的上方。 */
  belowPlayer: 'ytd-watch-flexy #below',
  /** 影片標題與資訊區塊（在 #below 之內，可能包在其他容器裡）。 */
  metadata: 'ytd-watch-metadata',
  /**
   * 包住播放器的容器（一般模式在 #player 內，YouTube 劇院模式時會被移到加寬的容器）。
   * 劇院模式（003 FR-20）提高它的 z-index；浮動播放器（FR-40）把它改成固定定位。
   */
  playerContainer: 'ytd-watch-flexy #player-container',
  /** 固定在頁面頂端的標題列；浮動播放器不蓋住它（003 FR-40）。 */
  masthead: '#masthead-container',
} as const;

/** 標題列的預設高度（找不到標題列時使用）。 */
const DEFAULT_MASTHEAD_HEIGHT = 56;

export interface ToolbarAnchor {
  /** 工具列要插入的父元素。 */
  parent: Element;
  /** 工具列要插在這個元素前面；null 表示放在 parent 的最前面。 */
  before: Element | null;
}

/** 找出工具列的掛載位置：播放器正下方、影片標題上方（001 FR-2）。 */
export function findToolbarAnchor(doc: Document = document): ToolbarAnchor | null {
  const below = doc.querySelector(SELECTORS.belowPlayer);
  if (!below) return null;
  // 工具列插在「#below 中包含標題區塊的那個子元素」前面。
  let before = below.querySelector(SELECTORS.metadata);
  while (before && before.parentElement !== below) before = before.parentElement;
  if (!before) return null;
  return { parent: below, before };
}

export function findPlayer(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(SELECTORS.player);
}

export function findPlayerContainer(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(SELECTORS.playerContainer);
}

/** 頁面頂端被固定標題列蓋住的高度。 */
export function mastheadHeight(doc: Document = document): number {
  const masthead = doc.querySelector(SELECTORS.masthead);
  if (!masthead) return DEFAULT_MASTHEAD_HEIGHT;
  const rect = masthead.getBoundingClientRect();
  return rect.height > 0 ? Math.max(0, Math.round(rect.bottom)) : 0;
}

export function findVideo(doc: Document = document): HTMLVideoElement | null {
  return doc.querySelector<HTMLVideoElement>(SELECTORS.video);
}

// ---------------------------------------------------------------------------
// 主題（003 深色模式）
// ---------------------------------------------------------------------------

/** YouTube 以 <html> 上的這個屬性切換深色主題，顏色變數會跟著換值。 */
export const DARK_THEME_ATTRIBUTE = 'dark';

export function isDarkTheme(doc: Document = document): boolean {
  return doc.documentElement.hasAttribute(DARK_THEME_ATTRIBUTE);
}

export function setDarkTheme(dark: boolean, doc: Document = document): void {
  doc.documentElement.toggleAttribute(DARK_THEME_ATTRIBUTE, dark);
}

// ---------------------------------------------------------------------------
// 播放器 API（只在 main world 的頁面橋接腳本中使用）
// ---------------------------------------------------------------------------

/** 播放器元素上我們會用到的方法；每個都可能不存在，呼叫前要檢查。 */
export interface YtPlayerApi {
  getVideoData?: () => { video_id?: unknown; title?: unknown; isLive?: unknown } | undefined;
  getPlayerResponse?: () =>
    | { videoDetails?: { isLive?: unknown; isUpcoming?: unknown; lengthSeconds?: unknown; title?: unknown } }
    | undefined;
  getDuration?: () => unknown;
  getCurrentTime?: () => unknown;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  getVolume?: () => unknown;
  setVolume?: (volume: number) => void;
  isMuted?: () => unknown;
  unMute?: () => void;
}

export interface VideoData {
  videoId: string;
  title: string;
  /** 秒；未知時為 0。 */
  duration: number;
  isLive: boolean;
  isUpcoming: boolean;
}

const toNumber = (value: unknown): number => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
};

/** 從播放器讀出目前影片的資料；讀不到影片 ID 時回傳 null。 */
export function readVideoData(player: YtPlayerApi): VideoData | null {
  const data = player.getVideoData?.();
  const details = player.getPlayerResponse?.()?.videoDetails;
  const videoId = typeof data?.video_id === 'string' ? data.video_id : '';
  if (!videoId) return null;
  const title =
    typeof data?.title === 'string' && data.title
      ? data.title
      : typeof details?.title === 'string'
        ? details.title
        : '';
  const duration = toNumber(player.getDuration?.()) || toNumber(details?.lengthSeconds);
  return {
    videoId,
    title,
    duration,
    isLive: data?.isLive === true || details?.isLive === true,
    isUpcoming: details?.isUpcoming === true,
  };
}

export function readCurrentTime(player: YtPlayerApi): number {
  return toNumber(player.getCurrentTime?.());
}

export function readVolume(player: YtPlayerApi): { volume: number; muted: boolean } {
  return { volume: toNumber(player.getVolume?.()), muted: player.isMuted?.() === true };
}

export function writeVolume(player: YtPlayerApi, volume: number): void {
  player.setVolume?.(volume);
  if (volume > 0 && player.isMuted?.() === true) player.unMute?.();
}

export function writeSeek(player: YtPlayerApi, seconds: number): void {
  player.seekTo?.(seconds, true);
}

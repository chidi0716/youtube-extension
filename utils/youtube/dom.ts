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
  /** 播放器內包住 <video> 的容器；純音訊模式在這裡顯示縮圖（003 FR-62）。 */
  videoContainer: '#movie_player .html5-video-container',
  /** 播放器上 YouTube 自己的「自動播放」開關；aria-checked 表示開或關（003 FR-61）。 */
  autoplayToggle: '#movie_player .ytp-autonav-toggle-button',
  /** 觀看頁的留言區（003 FR-64）。 */
  comments: 'ytd-watch-flexy #comments',
} as const;

/**
 * 劇院模式（003 FR-20、plan 3.7）調暗的頁面區域：播放器容器與工具列以外的各個區塊。
 * 依 2026-10-21 從站內換頁進入的真實觀看頁確認（spikes/T07a/results-real-*.txt）。
 * 工具列（yte-toolbar）插在 #below 的最前面，所以 #below 只調暗工具列以外的子元素。
 * 播放器容器與它的祖先都不在這個清單中（播放器位於多層堆疊脈絡內，不能靠提高 z-index）。
 */
export const CINEMA_DIMMED_REGIONS: readonly string[] = [
  // 頂端列
  '#masthead-container',
  // 左側導覽（觀看頁預設收合成抽屜）
  'tp-yt-app-drawer#guide',
  'ytd-mini-guide-renderer',
  // 播放器欄位（#primary）以外的欄位：右側欄（推薦影片、播放清單、聊天室、資訊面板）等
  'ytd-watch-flexy #columns > :not(#primary)',
  // 播放器下方：標題、頻道、說明、留言（視窗較窄時推薦影片也在這裡）
  'ytd-watch-flexy #below > :not(yte-toolbar)',
  // 播放器欄位中播放器與 #below 以外的區塊
  'ytd-watch-flexy #primary-inner > :not(#player):not(#below)',
  // YouTube 劇院模式（加寬播放器）時的全寬區：播放器以外的資訊面板
  'ytd-watch-flexy #full-bleed-container > :not(#player-full-bleed-container)',
  // 部分版面在右側的固定選單（說明、留言等按鈕）與問卷
  'ytd-watch-flexy #fixed-side-menu',
  'ytd-watch-flexy #survey',
  // YouTube「環境模式」在播放器周圍的光暈（與播放器容器是兄弟元素）
  'ytd-watch-flexy #cinematics-container',
];

/** 元素是否位於劇院模式調暗的區域中（不含播放器與工具列）。 */
export function isInCinemaDimmedRegion(el: Element): boolean {
  if (el.closest(`${SELECTORS.player}, yte-toolbar`)) return false;
  return el.closest(CINEMA_DIMMED_REGIONS.join(', ')) !== null;
}

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

/** 影片縮圖的網址（i.ytimg.com，所有影片都有 hqdefault）。純音訊模式使用（003 FR-62）。 */
export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

export interface AutoplayToggle {
  /** 帶 aria-checked 的元素。 */
  indicator: Element;
  /** 要點擊的按鈕。 */
  button: HTMLElement;
}

/** YouTube 播放器上的自動播放開關；找不到時回傳 null。 */
export function findAutoplayToggle(doc: Document = document): AutoplayToggle | null {
  const indicator = doc.querySelector(SELECTORS.autoplayToggle);
  const button = indicator?.closest<HTMLElement>('button') ?? null;
  return indicator && button ? { indicator, button } : null;
}

export function isAutoplayOn(toggle: AutoplayToggle): boolean {
  return toggle.indicator.getAttribute('aria-checked') === 'true';
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

// ---------------------------------------------------------------------------
// YouTube「外觀」選單（003 FR-10 至 FR-15、plan 3.7、T06d）。依 2026-10-21 在 YouTube 首頁（未登入）
// 的實測，見 specs/notes/T06d-dark-mode-menu.md：
// - 頂端列右側的選單按鈕（未登入：設定按鈕；已登入：頭像按鈕）是 ytd-topbar-menu-button-renderer，
//   打開的選單放在 ytd-popup-container 的 tp-yt-iron-dropdown 中；
// - 「外觀」項目是專用的元件 ytd-toggle-theme-compact-link-renderer；
// - 點「外觀」後，子選單（#submenu）中的每個選項是 ytd-compact-link-renderer。選項沒有不依文字的
//   DOM 屬性，但元件的 data（只有頁面的 main world 讀得到）中有動作代號：
//   serviceEndpoint.signalServiceEndpoint.actions[].signalAction.signal 為
//   TOGGLE_DARK_THEME_ON（深色主題）或 TOGGLE_DARK_THEME_OFF（淺色主題），與介面語言無關。
//   頁面橋接腳本依此在選項上加上 THEME_OPTION_ATTRIBUTE，內容腳本再點擊。
// ---------------------------------------------------------------------------

export const APPEARANCE_MENU = {
  /** 已登入時的頭像按鈕（本環境無法登入，未實測）。 */
  avatarButton: 'ytd-masthead #end button#avatar-btn',
  /** 頂端列右側的選單按鈕元件；最右邊的一個是頭像（已登入）或設定（未登入）。 */
  menuButtonRenderer: 'ytd-masthead #end #buttons ytd-topbar-menu-button-renderer',
  /** 打開的彈出選單（操作期間以暫時的 class 讓它不可見）。 */
  popup: 'ytd-popup-container tp-yt-iron-dropdown',
  /** 選單中的「外觀」項目。 */
  appearanceItem: 'ytd-popup-container ytd-toggle-theme-compact-link-renderer',
  /** 「外觀」子選單中的選項。 */
  themeOption: 'ytd-popup-container #submenu ytd-compact-link-renderer',
  /** 選項中實際處理點擊的連結。 */
  themeOptionLink: 'a#endpoint',
} as const;

/** 頁面橋接腳本在外觀選項上加的屬性，值為 dark 或 light。 */
export const THEME_OPTION_ATTRIBUTE = 'data-yte-theme-option';

/** 外觀選項的動作代號與對應的主題。 */
export const THEME_OPTION_SIGNALS: Readonly<Record<string, 'dark' | 'light'>> = {
  TOGGLE_DARK_THEME_ON: 'dark',
  TOGGLE_DARK_THEME_OFF: 'light',
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** 從外觀選項元件的 data 取出它代表的主題；不是深色或淺色選項（例如「使用裝置主題」）時回傳 null。 */
export function themeOptionOf(data: unknown): 'dark' | 'light' | null {
  const endpoint = asRecord(asRecord(asRecord(data)?.serviceEndpoint)?.signalServiceEndpoint);
  const actions = Array.isArray(endpoint?.actions) ? endpoint.actions : [];
  for (const action of actions) {
    const signal = asRecord(asRecord(action)?.signalAction)?.signal;
    if (typeof signal === 'string' && Object.hasOwn(THEME_OPTION_SIGNALS, signal)) return THEME_OPTION_SIGNALS[signal]!;
  }
  return null;
}

/**
 * main world 用：在目前外觀子選單的選項上標記它代表的主題（先清除舊的標記）。
 * 只加上資料屬性，不點擊、不修改其他東西。回傳找到哪些選項。
 */
export function markThemeOptions(doc: Document = document): { dark: boolean; light: boolean } {
  const found = { dark: false, light: false };
  for (const el of doc.querySelectorAll(`[${THEME_OPTION_ATTRIBUTE}]`)) el.removeAttribute(THEME_OPTION_ATTRIBUTE);
  for (const el of doc.querySelectorAll(APPEARANCE_MENU.themeOption)) {
    const theme = themeOptionOf((el as Element & { data?: unknown }).data);
    if (!theme) continue;
    el.setAttribute(THEME_OPTION_ATTRIBUTE, theme);
    found[theme] = true;
  }
  return found;
}

/** 打開帳號／設定選單的按鈕：已登入時的頭像按鈕，否則頂端列最右邊的選單按鈕。 */
export function findAccountMenuButton(doc: Document = document): HTMLElement | null {
  const avatar = doc.querySelector<HTMLElement>(APPEARANCE_MENU.avatarButton);
  if (avatar) return avatar;
  const renderers = doc.querySelectorAll(APPEARANCE_MENU.menuButtonRenderer);
  return renderers.length > 0 ? renderers[renderers.length - 1]!.querySelector<HTMLElement>('button') : null;
}

/** 已打開、顯示中的彈出選單。 */
export function findOpenPopup(doc: Document = document): HTMLElement | null {
  for (const el of doc.querySelectorAll<HTMLElement>(APPEARANCE_MENU.popup)) {
    if (el.getAttribute('aria-hidden') !== 'true' && el.style.display !== 'none' && el.getClientRects().length > 0) return el;
  }
  return null;
}

/** 顯示中的「外觀」項目。 */
export function findAppearanceItem(doc: Document = document): HTMLElement | null {
  const el = doc.querySelector<HTMLElement>(APPEARANCE_MENU.appearanceItem);
  return el && el.getClientRects().length > 0 ? el : null;
}

/** 已被橋接腳本標記、顯示中的深色或淺色選項（點擊的目標）。 */
export function findThemeOption(theme: 'dark' | 'light', doc: Document = document): HTMLElement | null {
  const option = doc.querySelector<HTMLElement>(`${APPEARANCE_MENU.themeOption}[${THEME_OPTION_ATTRIBUTE}="${theme}"]`);
  if (!option || option.getClientRects().length === 0) return null;
  return option.querySelector<HTMLElement>(APPEARANCE_MENU.themeOptionLink) ?? option;
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

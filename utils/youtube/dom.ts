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
// 即時切換主題（003 FR-11、plan 3.7、T06b）。依 2026-10-21 在 YouTube 首頁的實測，
// 見 specs/notes/T06b-dark-mode-instant.md：
// - YouTube 依載入時的主題輸出不同的主樣式表：其中 `:root` 的顏色變數預設值就是載入時的主題，
//   另有 `[dark]`、`[light]` 兩組覆寫。所以以深色載入的頁面只移除 `dark` 不會變淺色，
//   必須在 <html> 加上 `light`；以淺色載入的頁面加上 `dark` 即可。
// - 除了 <html>，YouTube 還會在下列元素上依主題設定布林屬性（深色時存在、淺色時不存在），
//   這些元素的部分顏色依屬性決定。YouTube 換頁時可能依載入時的主題把屬性改回去。
// ---------------------------------------------------------------------------

/** YouTube 樣式表中把顏色變數設為淺色值的屬性（YouTube 載入時不會自己加上）。 */
export const LIGHT_THEME_ATTRIBUTE = 'light';

/** 依主題設定布林屬性的 YouTube 元素：深色時屬性存在，淺色時不存在。 */
export const THEMED_ELEMENTS: ReadonlyArray<{ readonly selector: string; readonly attributes: readonly string[] }> = [
  { selector: 'ytd-masthead', attributes: ['dark', 'page-dark-theme'] },
  { selector: 'ytd-watch-flexy', attributes: ['is-dark-theme'] },
  { selector: 'ytd-playlist-panel-renderer', attributes: ['is-dark-theme'] },
  { selector: 'ytd-feed-nudge-renderer', attributes: ['is-dark-mode'] },
];

export interface ThemeAttributeChange {
  /** null 表示 <html>。 */
  selector: string | null;
  attribute: string;
  present: boolean;
}

/** 切換為深色或淺色主題時，每個主題屬性應有的狀態。 */
export function themeAttributeChanges(theme: 'dark' | 'light'): ThemeAttributeChange[] {
  const dark = theme === 'dark';
  return [
    { selector: null, attribute: DARK_THEME_ATTRIBUTE, present: dark },
    { selector: null, attribute: LIGHT_THEME_ATTRIBUTE, present: !dark },
    ...THEMED_ELEMENTS.flatMap(({ selector, attributes }) =>
      attributes.map((attribute) => ({ selector, attribute, present: dark })),
    ),
  ];
}

/** 所有主題屬性的名稱（給 MutationObserver 的 attributeFilter）。 */
export const THEME_ATTRIBUTE_NAMES: readonly string[] = [
  ...new Set(themeAttributeChanges('dark').map((c) => c.attribute)),
];

/** 把頁面上的主題屬性設成指定主題應有的狀態；只改動不同的屬性。回傳改動的數量。 */
export function applyThemeAttributes(theme: 'dark' | 'light', doc: Document = document): number {
  let changed = 0;
  for (const { selector, attribute, present } of themeAttributeChanges(theme)) {
    const targets = selector === null ? [doc.documentElement] : doc.querySelectorAll(selector);
    for (const el of targets) {
      if (el.hasAttribute(attribute) === present) continue;
      el.toggleAttribute(attribute, present);
      changed++;
    }
  }
  return changed;
}

/**
 * YouTube 依載入時的主題，以比 [dark]／[light] 更優先的 `:root:root` 固定少數顏色變數
 * （實測 4–6 個，例如「訂閱」按鈕的文字色）。只切換屬性時這些變數不會變，需要另外覆寫。
 */
export const PINNED_THEME_SELECTOR = ':root:root';

/** 樣式規則屬於哪一組主題變數：固定值、深色、淺色；都不是時回傳 null。 */
export function themeRuleKind(selectorText: string): 'pinned' | 'dark' | 'light' | null {
  const parts = selectorText.split(',').map((s) => s.trim());
  if (parts.includes(PINNED_THEME_SELECTOR)) return 'pinned';
  if (parts.includes(`[${DARK_THEME_ATTRIBUTE}]`)) return 'dark';
  if (parts.includes(`[${LIGHT_THEME_ATTRIBUTE}]`)) return 'light';
  return null;
}

export interface ThemeVariables {
  /** 被 `:root:root` 固定的變數名稱。 */
  pinned: Set<string>;
  /** YouTube 樣式表中 [dark]、[light] 規則定義的變數值。 */
  dark: Map<string, string>;
  light: Map<string, string>;
}

/** 讀取頁面樣式表中的主題變數。讀不到的樣式表（例如跨來源）略過。 */
export function collectThemeVariables(doc: Document = document): ThemeVariables {
  const vars: ThemeVariables = { pinned: new Set(), dark: new Map(), light: new Map() };
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      // 以欄位判斷規則種類（不用 instanceof，Firefox 內容腳本中的頁面物件也適用）。
      const { selectorText, style } = rule as Partial<CSSStyleRule>;
      const kind = typeof selectorText === 'string' && style ? themeRuleKind(selectorText) : null;
      if (kind && style) {
        for (let i = 0; i < style.length; i++) {
          const name = style.item(i);
          if (!name.startsWith('--')) continue;
          if (kind === 'pinned') vars.pinned.add(name);
          else vars[kind].set(name, style.getPropertyValue(name).trim());
        }
      }
      // @media、@layer、@supports 等群組規則與巢狀規則
      const nested = (rule as Partial<CSSGroupingRule>).cssRules;
      if (nested) walk(nested);
    }
  };
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      walk(sheet.cssRules);
    } catch {
      // 無法讀取的樣式表（SecurityError）
    }
  }
  return vars;
}

/**
 * 頁面實際顯示的背景色（CSS 色彩字串）：優先取整頁容器 ytd-app，透明時改看 <html>、<body>。
 * 用來確認即時切換是否生效（003 FR-16）。都透明時回傳 null。
 */
export function pageBackgroundColor(doc: Document = document): string | null {
  const view = doc.defaultView;
  if (!view) return null;
  for (const el of [doc.querySelector('ytd-app'), doc.documentElement, doc.body]) {
    if (!el) continue;
    const color = view.getComputedStyle(el).backgroundColor;
    if (color && color !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(color)) return color;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 主題偏好（003 FR-10 至 FR-13，plan 3.7）：YouTube 把「外觀」設定存在 PREF cookie。
// 格式依實測與公開資料確認，見 specs/notes/T06a-dark-mode.md：
// - cookie 值是以 & 分隔的 key=value，例如 "f5=30000&f6=400&hl=en&tz=UTC"；
// - f6 是十六進位的旗標；0x400 為深色主題、0x80000 為淺色主題，兩者都沒有時依 YouTube 預設
//   （帳號設為「使用裝置主題」時也是如此）；其他位元與其他欄位屬於別的偏好，必須原樣保留。
// - cookie 屬性：網域 .youtube.com、路徑 /、Secure、SameSite=Lax，YouTube 設定的期限為 400 天。
// ---------------------------------------------------------------------------

export const PREF_COOKIE = 'PREF';
export const PREF_THEME_FIELD = 'f6';
export const THEME_DARK_FLAG = 0x400;
export const THEME_LIGHT_FLAG = 0x80000;
const PREF_COOKIE_ATTRIBUTES = 'domain=.youtube.com; path=/; max-age=34560000; secure; samesite=lax';

/** YouTube「外觀」設定：深色、淺色，或沒有明確設定（依 YouTube 預設或裝置主題）。 */
export type ThemePreference = 'dark' | 'light' | 'device';

/** 從 document.cookie 字串取出 PREF 的值；沒有時回傳 null。 */
export function readPrefCookie(cookieString: string): string | null {
  for (const part of cookieString.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${PREF_COOKIE}=`)) return trimmed.slice(PREF_COOKIE.length + 1);
  }
  return null;
}

/** 解析 PREF 值為依序排列的欄位；值保持原始文字（不做 URL 解碼），以便原樣寫回。 */
export function parsePref(value: string | null): Array<[key: string, value: string]> {
  if (!value) return [];
  return value
    .split('&')
    .filter((part) => part.length > 0)
    .map((part) => {
      const eq = part.indexOf('=');
      return eq === -1 ? [part, ''] : [part.slice(0, eq), part.slice(eq + 1)];
    });
}

export function serializePref(fields: ReadonlyArray<readonly [string, string]>): string {
  return fields.map(([k, v]) => `${k}=${v}`).join('&');
}

/** 解析 f6 旗標；欄位不存在時為 0，格式不對時回傳 null（不能安全地修改）。 */
function themeFlags(fields: ReadonlyArray<readonly [string, string]>): number | null {
  const raw = fields.find(([k]) => k === PREF_THEME_FIELD)?.[1];
  if (raw === undefined || raw === '') return 0;
  return /^[0-9a-fA-F]{1,8}$/.test(raw) ? Number.parseInt(raw, 16) : null;
}

/** 目前 PREF 中的主題偏好；f6 格式不對時視為沒有明確設定。 */
export function readThemePreference(prefValue: string | null): ThemePreference {
  const flags = themeFlags(parsePref(prefValue));
  if (flags === null) return 'device';
  if (flags & THEME_DARK_FLAG) return 'dark';
  if (flags & THEME_LIGHT_FLAG) return 'light';
  return 'device';
}

/**
 * 回傳把主題改成深色或淺色後的 PREF 值：只改 f6 的兩個主題位元，其他位元與欄位（含順序）原樣保留；
 * 原本沒有 f6 時加在最後。f6 格式不對時回傳 null，不修改。
 */
export function withThemePreference(prefValue: string | null, theme: 'dark' | 'light'): string | null {
  const fields = parsePref(prefValue);
  const flags = themeFlags(fields);
  if (flags === null) return null;
  // >>> 0：以無號 32 位元處理，最高位元被設定時也不會變成負數。
  const next = ((flags & ~(THEME_DARK_FLAG | THEME_LIGHT_FLAG)) | (theme === 'dark' ? THEME_DARK_FLAG : THEME_LIGHT_FLAG)) >>> 0;
  const hex = next.toString(16);
  const index = fields.findIndex(([k]) => k === PREF_THEME_FIELD);
  if (index === -1) fields.push([PREF_THEME_FIELD, hex]);
  else fields[index] = [PREF_THEME_FIELD, hex];
  return serializePref(fields);
}

/** 寫入 PREF cookie 用的 document.cookie 字串（屬性與 YouTube 自己設定的相同）。 */
export function prefCookieString(prefValue: string): string {
  return `${PREF_COOKIE}=${prefValue}; ${PREF_COOKIE_ATTRIBUTES}`;
}

/** 重新載入時保留目前影片與播放時間點的網址（YouTube 的 t 參數，單位秒）。 */
export function urlWithTime(href: string, seconds: number | null): string {
  const url = new URL(href);
  if (url.pathname !== '/watch' || seconds === null || !Number.isFinite(seconds)) return url.href;
  if (seconds >= 1) url.searchParams.set('t', `${Math.floor(seconds)}s`);
  else url.searchParams.delete('t');
  return url.href;
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

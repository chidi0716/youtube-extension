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

// ---------------------------------------------------------------------------
// 鎖定畫質（004 第 1 節、plan 3.7.1）
// 播放器方法依 2026-10-22 在真實觀看頁（站內換頁進入）上列出的 #movie_player 方法確認存在
// （spikes/stage2c/results-watch.txt）；畫質代號與解析度的對應來自 YouTube IFrame Player API
// 的公開文件。實際切換的效果在本環境無法驗證（影片無法播放），見 specs/notes/T27-quality-lock.md。
// ---------------------------------------------------------------------------

/** YouTube 播放器的畫質代號與對應的畫面高度。 */
export const QUALITY_HEIGHTS = {
  tiny: 144,
  small: 240,
  medium: 360,
  large: 480,
  hd720: 720,
  hd1080: 1080,
  hd1440: 1440,
  hd2160: 2160,
  hd2880: 2880,
  highres: 4320,
} as const;

export type QualityCode = keyof typeof QUALITY_HEIGHTS;

/** 交還給 YouTube 自動決定畫質時使用的代號。 */
export const AUTO_QUALITY = 'auto';

export function isQualityCode(value: unknown): value is QualityCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(QUALITY_HEIGHTS, value);
}

/** 播放器上與畫質相關的方法；每個都可能不存在，呼叫前要檢查。 */
export interface YtQualityApi {
  getAvailableQualityLevels?: () => unknown;
  getPlaybackQuality?: () => unknown;
  setPlaybackQuality?: (quality: string) => void;
  setPlaybackQualityRange?: (min: string, max?: string) => void;
}

/** 目前影片可用的畫質（只回傳已知的代號，不含 auto）；影片還沒載入時為空陣列。 */
export function readAvailableQualities(player: YtQualityApi): QualityCode[] {
  const levels = player.getAvailableQualityLevels?.();
  return Array.isArray(levels) ? levels.filter(isQualityCode) : [];
}

/** 目前的播放畫質；不是已知的代號時（例如 "unknown"）回傳 null。 */
export function readQuality(player: YtQualityApi): QualityCode | null {
  const q = player.getPlaybackQuality?.();
  return isQualityCode(q) ? q : null;
}

/**
 * 設定畫質：把畫質範圍的上下限都設成同一個代號（YouTube 的自動調整不會再改變它），並切換到該畫質。
 * `auto` 表示交還給 YouTube 自動決定。
 */
export function writeQuality(player: YtQualityApi, quality: QualityCode | typeof AUTO_QUALITY): void {
  player.setPlaybackQualityRange?.(quality, quality);
  player.setPlaybackQuality?.(quality);
}

/** 便利功能與頁面整理使用的 YouTube 選擇器（004、005）。 */
export const CONVENIENCE_SELECTORS = {
  /** 播放器的設定（齒輪）選單；使用者在這裡手動改畫質或語音軌（004 FR-4、005 FR-12）。 */
  settingsMenu: '#movie_player .ytp-settings-menu',
} as const;

// ---------------------------------------------------------------------------
// 頁面整理中只靠樣式的選項（005、plan 3.7.2）：要隱藏或調整的元素。
// 依 2026-10-22 在真實 YouTube 首頁、搜尋頁、觀看頁（站內換頁進入）上的觀察
// （spikes/stage2c/results-home.txt、results-watch.txt、results-details.txt）；
// 標示「未確認」的項目在本環境看不到（例如影片無法播放、未登入時首頁沒有內容），依公開的元素名稱加入。
// ---------------------------------------------------------------------------

/** 片尾推薦卡片與播完後的推薦畫面（005 FR-20、FR-21）。不含自動播放倒數（FR-22）。 */
export const END_SCREEN_SELECTORS: readonly string[] = [
  // 影片最後幾秒的推薦卡片（影片、頻道、訂閱、連結）（未確認：本環境影片無法播放）
  '#movie_player .ytp-ce-element',
  // 自動播放關閉時，播完後的推薦影片格狀畫面（未確認）
  '#movie_player .html5-endscreen.videowall-endscreen',
  '#movie_player .ytp-endscreen-content',
  // 新版播放器的推薦格子（觀看頁上有 .ytp-fullscreen-grid，平時不顯示）；只在播完時隱藏（未確認）
  '#movie_player.ended-mode .ytp-fullscreen-grid-stills-container',
];

/** 縮圖自動預覽（005 FR-40）：ytd-app 底下共用的預覽播放器，以及舊版縮圖上的動態預覽。 */
export const THUMBNAIL_PREVIEW_SELECTORS: readonly string[] = [
  'ytd-app > #video-preview',
  'ytd-video-preview',
  'ytd-moving-thumbnail-renderer',
];

/** Shorts 的區塊與個別項目（005 FR-60）。以 :has() 判斷項目是否連到 /shorts/。 */
export const SHORTS_SELECTORS: readonly string[] = [
  // 首頁、訂閱：Shorts 區塊（未確認：未登入時首頁沒有內容）
  'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
  'ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model)',
  'ytd-rich-shelf-renderer[is-shorts]',
  // 搜尋：Shorts 格狀區塊（已確認）
  'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)',
  // 觀看頁推薦清單與舊版搜尋：Shorts 橫向區塊（已確認）
  'ytd-reel-shelf-renderer',
  // 個別 Shorts 項目
  'ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model)',
  'ytd-rich-item-renderer:has(a#thumbnail[href^="/shorts/"])',
  'ytd-video-renderer:has(a#thumbnail[href^="/shorts/"])',
  'ytd-grid-video-renderer:has(a#thumbnail[href^="/shorts/"])',
  'ytd-compact-video-renderer:has(a#thumbnail[href^="/shorts/"])',
  'yt-lockup-view-model:has(a[href^="/shorts/"])',
  'ytm-shorts-lockup-view-model-v2',
  'ytm-shorts-lockup-view-model',
];

/**
 * 左側導覽與迷你導覽的 Shorts 入口（005 FR-61）。實測 Shorts 入口的連結沒有 href、title 為 "Shorts"；
 * 為了不依賴介面語言，也以 Shorts 圖示的 SVG path 開頭辨識（YouTube 換圖示時需要更新）。
 */
export const SHORTS_GUIDE_SELECTORS: readonly string[] = [
  'ytd-guide-entry-renderer:has(> a#endpoint[title="Shorts"])',
  'ytd-guide-entry-renderer:has(a[href^="/shorts"])',
  'ytd-guide-entry-renderer:has(path[d^="m13.467 1.19-8 4.7"])',
  'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
  'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])',
  'ytd-mini-guide-entry-renderer:has(path[d^="m13.467 1.19-8 4.7"])',
];

/**
 * 影片清單中的標題（005 FR-70）：實測一般影片 a#video-title、新版 a.ytLockupMetadataViewModelTitle
 * 都是 2 行截斷（-webkit-line-clamp: 2、max-height: 52px），Shorts 的標題截斷在外層 h3。
 */
export const VIDEO_TITLE_SELECTORS: readonly string[] = [
  '#video-title',
  '.ytLockupMetadataViewModelTitle',
  '.shortsLockupViewModelHostMetadataTitle',
];

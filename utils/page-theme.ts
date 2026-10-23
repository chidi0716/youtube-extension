// 設定頁與彈出視窗的外觀（007 FR-20 至 FR-24，plan 3.7.4，tasks T37）。
// 設定 sync:pageTheme（youtube／system／dark／light）；內容腳本把最近一次在 YouTube 上看到的主題記在 local:lastYouTubeTheme。
// 頁面以 <html data-theme="dark|light"> 切換顏色變數。直接使用 browser.storage，不在模組載入時定義 storage 項目。

export type PageThemePreference = 'youtube' | 'system' | 'dark' | 'light';
export const PAGE_THEME_VALUES: readonly PageThemePreference[] = ['youtube', 'system', 'dark', 'light'];
export type Theme = 'dark' | 'light';

const PREF_KEY = 'pageTheme';
const LAST_KEY = 'lastYouTubeTheme';

const isTheme = (v: unknown): v is Theme => v === 'dark' || v === 'light';

/** 決定頁面的主題：深色、淺色直接使用；「跟隨 YouTube」用最近的紀錄，沒有紀錄時與「跟隨系統」相同（FR-21）。 */
export function resolvePageTheme(pref: unknown, lastYouTube: unknown, systemDark: boolean): Theme {
  if (pref === 'dark' || pref === 'light') return pref;
  if (pref !== 'system' && isTheme(lastYouTube)) return lastYouTube;
  return systemDark ? 'dark' : 'light';
}

/** 內容腳本：記下目前 YouTube 的主題（只在改變時寫入，FR-21、FR-24）。 */
let lastWritten: Theme | null = null;
export function recordYouTubeTheme(theme: Theme): void {
  if (theme === lastWritten) return;
  lastWritten = theme;
  void (async () => {
    try {
      const stored = await browser.storage.local.get(LAST_KEY);
      if (stored[LAST_KEY] !== theme) await browser.storage.local.set({ [LAST_KEY]: theme });
    } catch {
      lastWritten = null;
    }
  })();
}

/** 設定頁、彈出視窗：套用外觀並在設定、YouTube 主題或系統主題改變時即時更新（FR-22）。 */
export async function applyPageTheme(root: HTMLElement = document.documentElement): Promise<void> {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let pref: unknown = 'youtube';
  let last: unknown = null;
  const apply = () => {
    root.dataset.theme = resolvePageTheme(pref, last, media.matches);
  };
  try {
    pref = (await browser.storage.sync.get(PREF_KEY))[PREF_KEY] ?? 'youtube';
    last = (await browser.storage.local.get(LAST_KEY))[LAST_KEY] ?? null;
  } catch {
    // 讀不到時依系統設定。
  }
  apply();
  media.addEventListener('change', apply);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && PREF_KEY in changes) pref = changes[PREF_KEY]!.newValue ?? 'youtube';
    else if (area === 'local' && LAST_KEY in changes) last = changes[LAST_KEY]!.newValue ?? null;
    else return;
    apply();
  });
}

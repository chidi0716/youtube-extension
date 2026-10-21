// 深色模式（003 FR-10 至 FR-16，plan 3.7，T06b）：即時切換，不重新載入頁面。
// 按下按鈕時同時做兩件事：
//   1. 修改 YouTube 自己的主題偏好（PREF cookie 的 f6 旗標，T06a），讓重新整理後維持；
//   2. 立即設定 YouTube 決定主題用的屬性（<html dark／light> 與幾個元素上的主題屬性），
//      讓頁面當下就以 YouTube 原生的深色／淺色樣式繪製。
// 3. YouTube 依載入時的主題以 `:root:root` 固定了少數顏色變數（例如「訂閱」按鈕的文字色），
//    改用 YouTube 樣式表中新主題（[dark]／[light]）的值覆寫；切回載入時的主題時移除覆寫。
// 切換後到這個頁面結束前，維持這些屬性與偏好（YouTube 換頁時可能依載入時的主題改回去，見
// specs/notes/T06b-dark-mode-instant.md）。即時切換沒有生效時才退回「改偏好後重新載入」（FR-16）。
// 擴充功能不另外記住狀態；按鈕只反映 <html dark> 的實際狀態。
import {
  DARK_THEME_ATTRIBUTE,
  LIGHT_THEME_ATTRIBUTE,
  THEME_ATTRIBUTE_NAMES,
  applyThemeAttributes,
  collectThemeVariables,
  findVideo,
  isDarkTheme,
  pageBackgroundColor,
  prefCookieString,
  readPrefCookie,
  readThemePreference,
  urlWithTime,
  withThemePreference,
  type ThemeVariables,
} from '@/utils/youtube/dom';
import { onNavigate } from '@/utils/youtube/page';
import { createStore, type ToggleState, type ViewingFeature } from './store';
import {
  htmlThemeChangedByOthers,
  pinnedVariableOverrides,
  prefFixDecision,
  prefNeedingFix,
  themeOfColor,
  type ThemeChoice,
} from './theme-logic';

const LOG_PREFIX = '[youtube-extension]';
/** 切換後多久確認頁面顏色已經改變（留時間給 YouTube 可能有的顏色轉場）。 */
const VERIFY_DELAY_MS = 600;
/** 檢查主題偏好有沒有被改回去的間隔，以及發現不同後等多久才修正。 */
const PREF_CHECK_INTERVAL_MS = 1000;
const PREF_FIX_GRACE_MS = 1000;
/** 每秒最多修正幾次元素上的主題屬性；超過表示 YouTube 一直改回去，停止修正避免互相拉扯。 */
const MAX_ATTRIBUTE_FIXES_PER_SECOND = 50;
/** 覆寫固定顏色變數用的 <style>；選擇器比 YouTube 的 `:root:root` 優先。 */
const PINNED_STYLE_ID = 'yte-theme-pinned';
const PINNED_OVERRIDE_SELECTOR = ':root:root:root';

export interface DarkModeFeature extends ViewingFeature {
  state: ReturnType<typeof createStore<ToggleState>>;
  toggle(): void;
}

/** 寫入主題偏好；成功時回傳 true。 */
function writeThemePreference(theme: ThemeChoice): boolean {
  const updated = withThemePreference(readPrefCookie(document.cookie), theme);
  if (updated === null) {
    console.info(`${LOG_PREFIX} dark mode: unexpected theme preference format; not changed`);
    return false;
  }
  document.cookie = prefCookieString(updated);
  if (readThemePreference(readPrefCookie(document.cookie)) !== theme) {
    console.info(`${LOG_PREFIX} dark mode: could not update the theme preference`);
    return false;
  }
  return true;
}

/** 退回方案（FR-16）：偏好已寫入，重新載入讓 YouTube 以新的偏好繪製；保留影片與時間點。 */
function reloadWithTheme(): void {
  const time = findVideo()?.currentTime ?? null;
  location.replace(urlWithTime(location.href, time));
}

/**
 * 切換後維持主題：屬性被 YouTube 改回去時補回，主題偏好被改回去時（寬限期後）改正。
 * YouTube 自己切換了 <html> 的主題（例如登入帳號的外觀選單）時交還給 YouTube。
 * 頁面開始卸載（重新載入、離開）時停止，不干擾 YouTube 選單寫入的偏好。
 */
function createThemeKeeper(onReleasedByOthers: () => void) {
  // YouTube 載入頁面時的主題，也就是 `:root:root` 固定值所屬的主題。
  const loadedTheme: ThemeChoice = isDarkTheme() ? 'dark' : 'light';
  let desired: ThemeChoice | null = null;
  let themeVariables: ThemeVariables | null = null;
  let scannedSheets = -1;
  let observer: MutationObserver | null = null;
  let interval: ReturnType<typeof setInterval> | undefined;
  let offNavigate: (() => void) | null = null;
  let prefDiffersSince: number | null = null;
  let fixesThisSecond = 0;
  let attributeFixesDisabled = false;

  const reapplyAttributes = () => {
    if (!desired || attributeFixesDisabled) return;
    fixesThisSecond += applyThemeAttributes(desired);
    if (fixesThisSecond > MAX_ATTRIBUTE_FIXES_PER_SECOND) {
      attributeFixesDisabled = true;
      console.info(`${LOG_PREFIX} dark mode: theme attributes keep changing; stopped re-applying them`);
    }
  };

  const removePinnedOverrides = () => document.getElementById(PINNED_STYLE_ID)?.remove();

  /** 覆寫被固定的顏色變數；樣式表數量改變（YouTube 載入新樣式）時重新讀取。 */
  const writePinnedOverrides = (theme: ThemeChoice) => {
    if (theme === loadedTheme) {
      removePinnedOverrides();
      return;
    }
    let style = document.getElementById(PINNED_STYLE_ID) as HTMLStyleElement | null;
    const sheets = document.styleSheets.length - (style ? 1 : 0);
    if (style && themeVariables && sheets === scannedSheets && style.dataset.theme === theme) return;
    if (!themeVariables || sheets !== scannedSheets) {
      themeVariables = collectThemeVariables();
      scannedSheets = sheets;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = PINNED_STYLE_ID;
      (document.head ?? document.documentElement).append(style);
    }
    style.dataset.theme = theme;
    const sheet = style.sheet;
    if (!sheet) return;
    while (sheet.cssRules.length > 0) sheet.deleteRule(0);
    sheet.insertRule(`${PINNED_OVERRIDE_SELECTOR} {}`);
    const rule = sheet.cssRules[0] as CSSStyleRule;
    // 以 CSSOM 逐一設定，值不會被當成樣式表文字解析。
    for (const [name, value] of pinnedVariableOverrides(themeVariables, theme)) rule.style.setProperty(name, value);
  };

  const applyPinnedOverrides = (theme: ThemeChoice) => {
    try {
      writePinnedOverrides(theme);
    } catch (err) {
      // 只影響少數顏色，失敗時不影響其他部分的切換（003 FR-4）。
      console.info(`${LOG_PREFIX} dark mode: could not override pinned theme colors`, err);
    }
  };

  const checkPref = () => {
    if (!desired) return;
    const fixed = prefNeedingFix(readPrefCookie(document.cookie), desired);
    const decision = prefFixDecision(fixed !== null, prefDiffersSince, Date.now(), PREF_FIX_GRACE_MS);
    prefDiffersSince = decision.since;
    if (decision.fix && fixed !== null) {
      document.cookie = prefCookieString(fixed);
      console.info(`${LOG_PREFIX} dark mode: theme preference was changed back by the page; restored`);
    }
  };

  const onMutations = () => {
    if (!desired) return;
    const html = document.documentElement;
    if (htmlThemeChangedByOthers(desired, html.hasAttribute(DARK_THEME_ATTRIBUTE))) {
      // YouTube 自己切換了主題：移除我們加的 light（避免與 dark 同時存在），之後交給 YouTube。
      if (html.hasAttribute(DARK_THEME_ATTRIBUTE)) html.removeAttribute(LIGHT_THEME_ATTRIBUTE);
      removePinnedOverrides();
      release();
      onReleasedByOthers();
      return;
    }
    reapplyAttributes();
  };

  const onTick = () => {
    fixesThisSecond = 0;
    checkPref();
  };

  const onNavigated = () => {
    if (!desired) return;
    reapplyAttributes();
    applyPinnedOverrides(desired);
    checkPref();
  };

  function release() {
    desired = null;
    observer?.disconnect();
    observer = null;
    clearInterval(interval);
    interval = undefined;
    offNavigate?.();
    offNavigate = null;
    removeEventListener('beforeunload', release);
    removeEventListener('pagehide', release);
    prefDiffersSince = null;
  }

  return {
    keep(theme: ThemeChoice) {
      desired = theme;
      prefDiffersSince = null;
      fixesThisSecond = 0;
      attributeFixesDisabled = false;
      applyThemeAttributes(theme);
      applyPinnedOverrides(theme);
      if (!observer) {
        observer = new MutationObserver(onMutations);
        observer.observe(document.documentElement, {
          subtree: true,
          attributes: true,
          attributeFilter: [...THEME_ATTRIBUTE_NAMES],
        });
      }
      interval ??= setInterval(onTick, PREF_CHECK_INTERVAL_MS);
      offNavigate ??= onNavigate(onNavigated);
      addEventListener('beforeunload', release);
      addEventListener('pagehide', release);
    },
    release,
    removePinnedOverrides,
  };
}

export function createDarkMode(): DarkModeFeature {
  const state = createStore<ToggleState>({ active: isDarkTheme() });
  let observer: MutationObserver | null = null;
  let verifyTimer: ReturnType<typeof setTimeout> | undefined;

  // 使用者從 YouTube 選單切換主題時，按鈕跟著更新（FR-12）。
  const sync = () => state.set({ active: isDarkTheme() });
  const keeper = createThemeKeeper(sync);

  return {
    state,
    start() {
      observer ??= new MutationObserver(sync);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: [DARK_THEME_ATTRIBUTE] });
      sync();
    },
    stop() {
      // 工具列關閉時不改變 YouTube 的主題（FR-14）：只停止更新按鈕。
      // 已經切換的主題繼續維持到頁面結束，避免換頁時被 YouTube 改回一半。
      observer?.disconnect();
      observer = null;
    },
    toggle() {
      // 依目前實際顯示的主題切換；「使用裝置主題」時改為明確的深色或淺色（FR-13）。
      const next: ThemeChoice = isDarkTheme() ? 'light' : 'dark';
      if (!writeThemePreference(next)) return;
      keeper.keep(next);
      sync();
      clearTimeout(verifyTimer);
      verifyTimer = setTimeout(() => {
        const shown = themeOfColor(pageBackgroundColor());
        if (shown === null || shown === next || isDarkTheme() !== (next === 'dark')) return;
        console.info(`${LOG_PREFIX} dark mode: instant switch did not take effect; reloading`);
        keeper.release();
        keeper.removePinnedOverrides();
        reloadWithTheme();
      }, VERIFY_DELAY_MS);
    },
  };
}

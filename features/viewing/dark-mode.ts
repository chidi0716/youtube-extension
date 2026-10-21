// 深色模式（003 FR-10 至 FR-15，plan 3.7）：修改 YouTube 自己的主題偏好（PREF cookie）後
// 重新載入頁面，效果等同使用者從 YouTube「外觀」選單選擇深色或淺色主題。
// 擴充功能不另外記住狀態；按鈕只反映 <html dark> 的實際狀態。
import {
  DARK_THEME_ATTRIBUTE,
  findVideo,
  isDarkTheme,
  prefCookieString,
  readPrefCookie,
  readThemePreference,
  urlWithTime,
  withThemePreference,
} from '@/utils/youtube/dom';
import { createStore, type ToggleState, type ViewingFeature } from './store';

const LOG_PREFIX = '[youtube-extension]';

export interface DarkModeFeature extends ViewingFeature {
  state: ReturnType<typeof createStore<ToggleState>>;
  toggle(): void;
}

export function createDarkMode(): DarkModeFeature {
  const state = createStore<ToggleState>({ active: isDarkTheme() });
  let observer: MutationObserver | null = null;

  // 使用者從 YouTube 選單切換主題時，按鈕跟著更新（FR-12）。
  const sync = () => state.set({ active: isDarkTheme() });

  return {
    state,
    start() {
      observer ??= new MutationObserver(sync);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: [DARK_THEME_ATTRIBUTE] });
      sync();
    },
    stop() {
      // 工具列關閉時不改變 YouTube 的主題（FR-14），只停止觀察。
      observer?.disconnect();
      observer = null;
    },
    toggle() {
      // 依目前實際顯示的主題切換；「使用裝置主題」時改為明確的深色或淺色（FR-13）。
      const next = isDarkTheme() ? 'light' : 'dark';
      const updated = withThemePreference(readPrefCookie(document.cookie), next);
      if (updated === null) {
        console.info(`${LOG_PREFIX} dark mode: unexpected theme preference format; not changed`);
        return;
      }
      document.cookie = prefCookieString(updated);
      if (readThemePreference(readPrefCookie(document.cookie)) !== next) {
        console.info(`${LOG_PREFIX} dark mode: could not update the theme preference`);
        return;
      }
      // 重新載入，讓 YouTube 以新的偏好繪製整頁；保留目前影片與時間點（FR-11）。
      const time = findVideo()?.currentTime ?? null;
      location.replace(urlWithTime(location.href, time));
    },
  };
}

// 深色模式（003 FR-10 至 FR-12，plan 3.7）：切換 YouTube 本身的深色主題並記住。
import { darkMode } from '@/utils/settings';
import { DARK_THEME_ATTRIBUTE, isDarkTheme, setDarkTheme } from '@/utils/youtube/dom';
import { createStore, type ToggleState, type ViewingFeature } from './store';
import { decideThemeChange } from './theme-logic';

export interface DarkModeFeature extends ViewingFeature {
  state: ReturnType<typeof createStore<ToggleState>>;
  toggle(): void;
}

export function createDarkMode(): DarkModeFeature {
  const state = createStore<ToggleState>({ active: isDarkTheme() });
  let remembered: boolean | null = null;
  let observer: MutationObserver | null = null;
  let lastUserInteraction: number | null = null;
  let running = false;

  const apply = (dark: boolean) => {
    if (isDarkTheme() !== dark) {
      // 先停止觀察，避免把自己的修改當成使用者從 YouTube 選單切換。
      observer?.disconnect();
      setDarkTheme(dark);
      observe();
    }
    state.set({ active: dark });
  };

  const onExternalChange = () => {
    const current = isDarkTheme();
    switch (decideThemeChange(remembered, current, Date.now(), lastUserInteraction)) {
      case 'remember':
        remembered = current;
        void darkMode.setValue(current);
        state.set({ active: current });
        break;
      case 'reapply':
        apply(remembered!);
        break;
      case 'follow':
        state.set({ active: current });
        break;
    }
  };

  const observe = () => {
    if (!running) return;
    observer ??= new MutationObserver(onExternalChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [DARK_THEME_ATTRIBUTE] });
  };

  // 記錄頁面上的使用者操作時間，用來判斷主題變更是不是使用者從 YouTube 選單切換的。
  const onUserInteraction = (event: Event) => {
    if (event.isTrusted) lastUserInteraction = Date.now();
  };

  return {
    state,
    start() {
      if (running) return;
      running = true;
      document.addEventListener('pointerdown', onUserInteraction, true);
      document.addEventListener('keydown', onUserInteraction, true);
      observe();
      state.set({ active: isDarkTheme() });
      void darkMode.getValue().then((value) => {
        if (!running) return;
        remembered = value;
        // 下次打開影片頁時自動套用記住的狀態（003 FR-1）。
        if (value !== null) apply(value);
      });
    },
    stop() {
      running = false;
      observer?.disconnect();
      observer = null;
      document.removeEventListener('pointerdown', onUserInteraction, true);
      document.removeEventListener('keydown', onUserInteraction, true);
    },
    toggle() {
      const next = !isDarkTheme();
      remembered = next;
      void darkMode.setValue(next);
      apply(next);
    },
  };
}

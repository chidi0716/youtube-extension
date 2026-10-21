// 劇院模式（003 FR-20 至 FR-23，plan 3.7）：播放器以外的整個頁面蓋上半透明黑色遮罩，
// 播放器與工具列提高到遮罩之上。點遮罩或按 Esc 關閉。不記住狀態。
import { findPlayerContainer } from '@/utils/youtube/dom';
import { isWatchPage } from '@/utils/youtube/page';
import { ensurePageStyles } from './page-styles';
import { createStore, type ToggleState, type ViewingFeature } from './store';

export const CINEMA_HOST_CLASS = 'yte-cinema-raised';
const OVERLAY_CLASS = 'yte-cinema-overlay';
const RAISED_CLASS = 'yte-cinema-raised';
const POSITIONED_CLASS = 'yte-cinema-positioned';

export interface CinemaFeature extends ViewingFeature {
  state: ReturnType<typeof createStore<ToggleState>>;
  toggle(): void;
  /** 工具列重新掛載時呼叫，讓工具列維持在遮罩之上（FR-20）。 */
  decorateToolbarHost(host: HTMLElement): void;
}

export function createCinema(): CinemaFeature {
  const state = createStore<ToggleState>({ active: false });
  let overlay: HTMLElement | null = null;
  let raised: HTMLElement | null = null;
  let toolbarHost: HTMLElement | null = null;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    // 有未釘選的面板展開時，Esc 先收起面板（001 FR-12），不關閉劇院模式。
    if (toolbarHost?.shadowRoot?.querySelector('.yte-panel:not([data-pinned])')) return;
    off();
  };

  function on() {
    const container = findPlayerContainer();
    if (!container) {
      console.info('[youtube-extension] cinema mode: player container not found');
      return;
    }
    ensurePageStyles();
    overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    overlay.addEventListener('click', off);
    document.body.append(overlay);
    raised = container;
    raised.classList.add(RAISED_CLASS);
    if (getComputedStyle(raised).position === 'static') raised.classList.add(POSITIONED_CLASS);
    toolbarHost?.classList.add(CINEMA_HOST_CLASS);
    window.addEventListener('keydown', onKeyDown, true);
    state.set({ active: true });
  }

  function off() {
    overlay?.remove();
    overlay = null;
    raised?.classList.remove(RAISED_CLASS, POSITIONED_CLASS);
    raised = null;
    toolbarHost?.classList.remove(CINEMA_HOST_CLASS);
    window.removeEventListener('keydown', onKeyDown, true);
    state.set({ active: false });
  }

  return {
    state,
    start() {},
    stop: off,
    navigate() {
      // 離開觀看頁時關閉；換到另一部影片時繼續生效（003 FR-3）。
      if (!isWatchPage(location.href)) off();
    },
    toggle() {
      if (state.get().active) off();
      else on();
    },
    decorateToolbarHost(host) {
      toolbarHost = host;
      host.classList.toggle(CINEMA_HOST_CLASS, state.get().active);
    },
  };
}

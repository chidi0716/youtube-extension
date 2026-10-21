// 觀看輔助功能（003）的總控制：啟用／停用、換頁通知，並把各功能的狀態提供給工具列。
import type { ButtonId } from '@/components/toolbar/buttons';
import type { ToggleFeature } from '@/components/toolbar/Toolbar';
import { createCinema } from './cinema';
import { createDarkMode } from './dark-mode';
import { createPip } from './pip';
import type { Store, ToggleState, ViewingFeature } from './store';

export interface ViewingController {
  /** 工具列啟用、且在支援的網域時為 true；false 時還原所有對 YouTube 頁面的修改。 */
  setActive(active: boolean): void;
  /** YouTube 換頁時呼叫（003 FR-3）。 */
  navigate(): void;
  /** 工具列切換按鈕的狀態與動作。 */
  toggles(): Partial<Record<ButtonId, ToggleFeature>>;
  /** 任一功能狀態改變時通知。 */
  subscribe(listener: () => void): () => void;
  /** 工具列（重新）掛載或重新繪製時呼叫，讓功能可以在宿主元素上加 class。 */
  decorateToolbarHost(host: HTMLElement): void;
}

const toToggle = (state: Store<ToggleState>, toggle: () => void): ToggleFeature => ({ ...state.get(), toggle });

export function createViewingController(): ViewingController {
  const dark = createDarkMode();
  const pip = createPip();
  const cinema = createCinema();
  const features: ViewingFeature[] = [dark, pip, cinema];
  const stores: Pick<Store<unknown>, 'subscribe'>[] = [dark.state, pip.state, cinema.state];
  let active = false;

  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      for (const feature of features) {
        try {
          if (next) feature.start();
          else feature.stop();
        } catch (err) {
          // 單一功能失效不得影響影片播放與其他功能（003 FR-4）。
          console.info('[youtube-extension] viewing feature failed', err);
        }
      }
    },
    navigate() {
      if (!active) return;
      for (const feature of features) {
        try {
          feature.navigate?.();
        } catch (err) {
          console.info('[youtube-extension] viewing feature failed on navigation', err);
        }
      }
    },
    toggles() {
      return {
        darkMode: toToggle(dark.state, dark.toggle),
        pip: toToggle(pip.state, pip.toggle),
        cinema: toToggle(cinema.state, cinema.toggle),
      };
    },
    decorateToolbarHost(host) {
      cinema.decorateToolbarHost(host);
    },
    subscribe(listener) {
      const offs = stores.map((s) => s.subscribe(listener));
      return () => offs.forEach((off) => off());
    },
  };
}

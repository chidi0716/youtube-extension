// 工具列的掛載與重新掛載（001 FR-1 至 FR-5、plan 3.4）。
//
// - 只在影片觀看頁、且「啟用」設定為開時顯示。
// - 換頁（yt-navigate-finish）時重新檢查；同一條工具列只會有一個。
// - 只觀察錨點的父節點，YouTube 把工具列移除時重新插入；離開觀看頁時停止觀察（NFR-3）。
// - 全螢幕時隱藏。
import { render } from 'preact';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { HelpPanel } from '@/components/panels/HelpPanel';
import type { ButtonId } from '@/components/toolbar/buttons';
import { Toolbar } from '@/components/toolbar/Toolbar';
import controlsCss from '@/components/controls/controls.css?inline';
import toolbarCss from '@/components/toolbar/toolbar.css?inline';
import { enabled } from '@/utils/settings';
import { findPlayer, findToolbarAnchor } from '@/utils/youtube/dom';
import { getVideoId, isWatchPage, onNavigate } from '@/utils/youtube/page';

const LOG_PREFIX = '[youtube-extension]';
/** 首次載入時等待錨點出現的上限；超過就安靜放棄（constitution 第 7 點）。 */
const ANCHOR_WAIT_MS = 20_000;

export async function startToolbar(ctx: ContentScriptContext): Promise<void> {
  let isEnabled = await enabled.getValue();
  let videoId: string | null = null;
  let parentObserver: MutationObserver | null = null;
  let observedParent: Element | null = null;
  let waitObserver: MutationObserver | null = null;
  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  let waitFrame = 0;

  const getBounds = () => {
    const rect = findPlayer()?.getBoundingClientRect();
    return rect && rect.width > 0 ? { left: rect.left, right: rect.right } : null;
  };

  const ui = await createShadowRootUi<HTMLElement>(ctx, {
    name: 'yte-toolbar',
    position: 'inline',
    anchor: () => findToolbarAnchor()?.before ?? null,
    append: 'before',
    css: `${toolbarCss}\n${controlsCss}`,
    // 工具列內的按鍵不要冒泡到 YouTube，避免觸發 YouTube 的鍵盤快捷鍵（FR-19）。
    isolateEvents: true,
    onMount(container, _shadow, host) {
      container.classList.add('yte-root');
      const anchor = findToolbarAnchor();
      if (anchor) host.style.setProperty('--yte-font-family', getComputedStyle(anchor.parent).fontFamily);
      renderInto(container, host);
      return container;
    },
    onRemove(container) {
      if (container) render(null, container);
    },
  });

  // ✕：隱藏工具列並記住，等同把彈出視窗的「啟用」關掉（001 FR-15、FR-16）。
  // enabled.watch 收到變更後會呼叫 sync() 移除工具列。
  const actions = {
    close: () => {
      void enabled.setValue(false);
    },
  };

  const renderPanel = (id: ButtonId) => (id === 'help' ? <HelpPanel /> : undefined);

  function renderInto(container: HTMLElement, host: HTMLElement) {
    if (!videoId) return;
    render(
      <Toolbar host={host} videoId={videoId} getBounds={getBounds} actions={actions} renderPanel={renderPanel} />,
      container,
    );
  }

  const isInPlace = () => {
    const anchor = findToolbarAnchor();
    const host = ui.shadowHost;
    return !!anchor && host.parentElement === anchor.parent && host.nextElementSibling === anchor.before;
  };

  const stopObserving = () => {
    parentObserver?.disconnect();
    parentObserver = null;
    observedParent = null;
  };

  const observeParent = (parent: Element) => {
    if (observedParent === parent) return;
    stopObserving();
    observedParent = parent;
    parentObserver = new MutationObserver(() => {
      if (!isInPlace()) sync();
    });
    parentObserver.observe(parent, { childList: true });
  };

  const stopWaiting = () => {
    waitObserver?.disconnect();
    waitObserver = null;
    clearTimeout(waitTimer);
    waitTimer = undefined;
    cancelAnimationFrame(waitFrame);
    waitFrame = 0;
  };

  // 首次載入時 YouTube 還沒畫出錨點：暫時觀察整頁，找到或逾時就停止。
  const waitForAnchor = () => {
    if (waitObserver) return;
    waitObserver = new MutationObserver(() => {
      if (waitFrame) return;
      waitFrame = requestAnimationFrame(() => {
        waitFrame = 0;
        if (findToolbarAnchor()) {
          stopWaiting();
          sync();
        }
      });
    });
    waitObserver.observe(document.documentElement, { childList: true, subtree: true });
    waitTimer = setTimeout(() => {
      stopWaiting();
      console.info(`${LOG_PREFIX} toolbar anchor not found; toolbar disabled on this page`);
    }, ANCHOR_WAIT_MS);
  };

  const applyFullscreen = () => {
    ui.shadowHost.hidden = !!document.fullscreenElement;
  };

  function sync() {
    const show = isEnabled && isWatchPage(location.href);
    if (!show) {
      stopWaiting();
      stopObserving();
      if (ui.mounted) ui.remove();
      return;
    }
    videoId = getVideoId(location.href);
    const anchor = findToolbarAnchor();
    if (!anchor) {
      stopObserving();
      waitForAnchor();
      return;
    }
    stopWaiting();
    if (ui.mounted && isInPlace()) {
      renderInto(ui.uiContainer, ui.shadowHost);
    } else {
      if (ui.mounted) ui.remove();
      try {
        ui.mount();
      } catch (err) {
        console.info(`${LOG_PREFIX} failed to mount toolbar`, err);
        return;
      }
    }
    observeParent(anchor.parent);
    applyFullscreen();
  }

  ctx.onInvalidated(onNavigate(sync));
  ctx.onInvalidated(
    enabled.watch((value) => {
      isEnabled = value;
      sync();
    }),
  );
  ctx.addEventListener(document, 'fullscreenchange', applyFullscreen);
  ctx.onInvalidated(() => {
    stopWaiting();
    stopObserving();
  });

  sync();
}

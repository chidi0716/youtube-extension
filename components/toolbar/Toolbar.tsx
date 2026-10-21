// 工具列外框（001）：左右兩組按鈕與目前展開的面板。
import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { t } from '@/utils/i18n';
import { ComingSoon } from '../panels/PanelStatus';
import { LEFT_BUTTONS, RIGHT_BUTTONS, getButton, type ButtonDef, type ButtonId } from './buttons';
import { initialPanelState, panelReducer } from './panel-state';
import { PanelHost } from './PanelHost';
import type { HorizontalRange } from './position';
import { ToolbarButton } from './ToolbarButton';

/** 切換按鈕背後的功能（003 由各功能模組提供）。 */
export interface ToggleFeature {
  active: boolean;
  toggle: () => void;
}

export interface ToolbarProps {
  /** Shadow DOM 的宿主元素。 */
  host: HTMLElement;
  /** 目前影片 ID；改變代表 YouTube 換頁了（FR-4）。 */
  videoId: string;
  /** 播放器左右緣（視窗座標）。 */
  getBounds: () => HorizontalRange | null;
  /** 切換按鈕的功能；未提供的按鈕顯示「即將推出」。 */
  toggles?: Partial<Record<ButtonId, ToggleFeature>>;
  /** 直接執行的按鈕（截圖、關閉）。 */
  actions?: Partial<Record<ButtonId, () => void>>;
  /** 面板內容；未提供的面板顯示「即將推出」。 */
  renderPanel?: (id: ButtonId) => ComponentChildren | undefined;
}

const COMING_SOON_MS = 1500;

export function Toolbar({ host, videoId, getBounds, toggles = {}, actions = {}, renderPanel }: ToolbarProps) {
  const [state, dispatch] = useReducer(panelReducer<ButtonId>, initialPanelState<ButtonId>());
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<ButtonId, HTMLButtonElement>());
  const [notice, setNotice] = useState<ButtonId | null>(null);

  // YouTube 換頁：未釘選的面板收起，釘選的面板維持並更新內容（FR-4、FR-13）。
  const lastVideoId = useRef(videoId);
  useEffect(() => {
    if (lastVideoId.current === videoId) return;
    lastVideoId.current = videoId;
    dispatch({ type: 'navigate' });
  }, [videoId]);

  // 面板收起後焦點回到按鈕（FR-19）；焦點已在頁面其他地方時不搶。
  useEffect(() => {
    const id = state.restoreFocusTo;
    if (!id) return;
    const active = document.activeElement;
    if (host.shadowRoot?.activeElement || !active || active === document.body || active === host) {
      buttonRefs.current.get(id)?.focus();
    }
    dispatch({ type: 'focusRestored' });
  }, [state.restoreFocusTo, host]);

  // 「即將推出」提示：一次性的計時器，閒置時不會有計時器在跑（NFR-3）。
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), COMING_SOON_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const onEscape = useCallback(() => dispatch({ type: 'escape' }), []);
  const onOutside = useCallback(() => dispatch({ type: 'outside' }), []);
  const onPin = useCallback(() => dispatch({ type: 'pin' }), []);
  const onUnpin = useCallback(() => dispatch({ type: 'unpin' }), []);

  const handleClick = (def: ButtonDef) => {
    if (def.kind === 'panel') {
      dispatch({ type: 'toggle', id: def.id });
    } else if (def.kind === 'toggle' && toggles[def.id]) {
      toggles[def.id]!.toggle();
    } else if (def.kind === 'action' && actions[def.id]) {
      actions[def.id]!();
    } else {
      setNotice(def.id);
    }
  };

  const renderButton = (def: ButtonDef, index: number, group: readonly ButtonDef[], side: 'left' | 'right') => {
    const label = t(def.label);
    const align =
      side === 'left' && index === 0 ? 'start' : side === 'right' && index === group.length - 1 ? 'end' : 'center';
    return (
      <ToolbarButton
        key={def.id}
        def={def}
        label={label}
        tooltip={notice === def.id ? t('comingSoon') : label}
        notice={notice === def.id}
        expanded={state.openId === def.id}
        pressed={toggles[def.id]?.active}
        controls={panelDomId(def.id)}
        tooltipAlign={align}
        buttonRef={(el: HTMLButtonElement | null) => {
          if (el) buttonRefs.current.set(def.id, el);
          else buttonRefs.current.delete(def.id);
        }}
        onClick={() => handleClick(def)}
      />
    );
  };

  const openDef = state.openId ? getButton(state.openId) : null;
  const openButton = state.openId ? buttonRefs.current.get(state.openId) : undefined;

  return (
    <div ref={containerRef} class="yte-toolbar" role="group" aria-label={t('toolbarLabel')}>
      <div class="yte-group">{LEFT_BUTTONS.map((d, i) => renderButton(d, i, LEFT_BUTTONS, 'left'))}</div>
      <div class="yte-group">{RIGHT_BUTTONS.map((d, i) => renderButton(d, i, RIGHT_BUTTONS, 'right'))}</div>
      {openDef && openButton && containerRef.current && (
        <PanelHost
          key={openDef.id}
          panelId={panelDomId(openDef.id)}
          title={t(openDef.panelTitle ?? openDef.label)}
          pinned={state.pinned}
          container={containerRef.current}
          button={openButton}
          host={host}
          getBounds={getBounds}
          onPin={onPin}
          onUnpin={onUnpin}
          onEscape={onEscape}
          onOutside={onOutside}
        >
          {renderPanel?.(openDef.id) ?? <ComingSoon />}
        </PanelHost>
      )}
    </div>
  );
}

function panelDomId(id: ButtonId): string {
  return `yte-panel-${id}`;
}

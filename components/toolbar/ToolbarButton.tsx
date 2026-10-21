import type { Ref } from 'preact';
import { Icon } from '../icons';
import type { ButtonDef } from './buttons';

export interface ToolbarButtonProps {
  def: ButtonDef;
  label: string;
  /** 提示文字；平常是按鈕名稱，也可以暫時換成其他訊息（例如「即將推出」）。 */
  tooltip: string;
  /** 面板按鈕：對應的面板是否展開。 */
  expanded?: boolean;
  /** 切換按鈕：目前是否為開啟狀態（FR-9）。面板按鈕：背後的功能正在進行中（003 FR-52）。 */
  pressed?: boolean;
  /** 不能使用時的原因；按鈕仍可聚焦（才能看到提示文字），但點了沒有作用。 */
  disabledReason?: string;
  /** 對應面板元素的 id（面板按鈕）。 */
  controls?: string;
  /** 提示文字是暫時訊息（例如「即將推出」），要立即顯示。 */
  notice?: boolean;
  /** 提示文字對齊按鈕的哪一側，避免超出工具列。 */
  tooltipAlign: 'start' | 'center' | 'end';
  buttonRef: Ref<HTMLButtonElement>;
  onClick: () => void;
}

export function ToolbarButton(props: ToolbarButtonProps) {
  const { def, label, tooltip, notice, expanded, pressed, disabledReason, controls, tooltipAlign, buttonRef, onClick } = props;
  const isOn = def.kind === 'panel' ? !!expanded || !!pressed : def.kind === 'toggle' ? !!pressed : false;
  return (
    <div class="yte-btn-wrap" data-tooltip-align={tooltipAlign}>
      <button
        ref={buttonRef}
        type="button"
        class="yte-btn"
        data-button={def.id}
        data-on={isOn ? '' : undefined}
        aria-label={label}
        aria-description={disabledReason}
        aria-disabled={disabledReason ? 'true' : undefined}
        aria-haspopup={def.kind === 'panel' ? 'dialog' : undefined}
        aria-expanded={def.kind === 'panel' ? !!expanded : undefined}
        aria-controls={def.kind === 'panel' && expanded ? controls : undefined}
        aria-pressed={def.kind === 'toggle' ? !!pressed : undefined}
        onClick={onClick}
      >
        <Icon name={def.icon} />
      </button>
      {/* 提示文字只是視覺輔助，按鈕本身已有 aria-label。 */}
      <span
        class="yte-tooltip"
        aria-hidden="true"
        data-notice={notice ? '' : undefined}
        data-hidden={expanded && !notice ? '' : undefined}
      >
        {tooltip}
      </span>
    </div>
  );
}

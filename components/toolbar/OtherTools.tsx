// 「更多」面板的「其他工具」區塊（006 FR-15、FR-16）：隱藏的工具以「圖示＋名稱」一列顯示，
// 點擊的效果與在工具列上點擊相同。
// - 面板類：收起「更多」，改為展開該工具的面板（對齊「更多」按鈕）；
// - 切換類：列上顯示目前的開關狀態，點擊即切換；
// - 執行類（截圖）：點擊即執行，完成或錯誤的提示顯示在列上。
import { t } from '@/utils/i18n';
import type { ToolId } from '@/utils/toolbar-layout';
import { Switch } from '../controls/Switch';
import { Icon } from '../icons';
import { isToolOngoing, TOOLS, type ButtonId } from './buttons';
import type { ToggleFeature } from './Toolbar';

export interface OtherToolsProps {
  hidden: readonly ToolId[];
  toggles: Partial<Record<ButtonId, ToggleFeature>>;
  activePanels?: ReadonlySet<ButtonId>;
  progress?: Partial<Record<ButtonId, number | 'indeterminate' | null>>;
  onOpen: (id: ToolId) => void;
}

export function OtherTools({ hidden, toggles, activePanels, progress, onOpen }: OtherToolsProps) {
  if (hidden.length === 0) return null;
  return (
    <section class="yte-other-tools" aria-labelledby="yte-other-tools-title">
      <h3 id="yte-other-tools-title" class="yte-other-title">
        {t('moreOtherTools')}
      </h3>
      <ul class="yte-other-list">
        {hidden.map((id) => {
          const def = TOOLS[id];
          const feature = toggles[id];
          const name = t(def.label);
          const busy = isToolOngoing(id, { progress, activePanels, toggles });
          if (def.kind === 'toggle') {
            const labelId = `yte-other-${id}-label`;
            const descId = `yte-other-${id}-desc`;
            const desc = feature?.notice ?? feature?.disabledReason;
            return (
              <li key={id} class="yte-other-item" data-tool={id} data-busy={busy ? '' : undefined}>
                <span class="yte-other-icon">
                  <Icon name={def.icon} />
                </span>
                <span class="yte-other-text">
                  <span id={labelId} class="yte-other-name">
                    {name}
                  </span>
                  {desc && (
                    <span id={descId} class="yte-other-desc">
                      {desc}
                    </span>
                  )}
                </span>
                <Switch
                  checked={!!feature?.active}
                  disabled={!feature || !!feature.disabledReason}
                  labelledBy={labelId}
                  describedBy={desc ? descId : undefined}
                  onChange={() => onOpen(id)}
                />
              </li>
            );
          }
          const status = feature?.notice;
          return (
            <li key={id} class="yte-other-item" data-tool={id} data-busy={busy ? '' : undefined}>
              <button type="button" class="yte-other-btn" aria-haspopup={def.kind === 'panel' ? 'dialog' : undefined} onClick={() => onOpen(id)}>
                <span class="yte-other-icon">
                  <Icon name={def.icon} />
                </span>
                <span class="yte-other-text">
                  <span class="yte-other-name">{name}</span>
                  {status && (
                    <span class="yte-other-desc" role="status">
                      {status}
                    </span>
                  )}
                </span>
                {busy && <span class="yte-other-dot" role="img" aria-label={t('moreHiddenActive')} />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

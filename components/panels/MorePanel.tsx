// 「更多」面板（003 FR-60 至 FR-64）：每列左側為圖示與名稱、下方一行灰色小字說明、右側為開關。
import { useEffect } from 'preact/hooks';
import type { Store, ToggleState } from '@/features/viewing/store';
import { t, type MessageKey } from '@/utils/i18n';
import { Switch } from '../controls/Switch';
import { Icon, type IconName } from '../icons';
import { useStore } from './useStore';

export interface MoreItem {
  id: string;
  icon: IconName;
  label: MessageKey;
  description: MessageKey;
  state: Store<ToggleState>;
  toggle: () => void;
}

function MoreRow({ item }: { item: MoreItem }) {
  const state = useStore(item.state);
  const labelId = `yte-more-${item.id}-label`;
  const descId = `yte-more-${item.id}-desc`;
  return (
    <li class="yte-more-item" data-item={item.id} data-disabled={state.disabledReason ? '' : undefined}>
      <span class="yte-more-icon">
        <Icon name={item.icon} />
      </span>
      <span class="yte-more-text">
        <span id={labelId} class="yte-more-name">
          {t(item.label)}
        </span>
        <span id={descId} class="yte-more-desc">
          {state.disabledReason ?? t(item.description)}
        </span>
      </span>
      <Switch
        checked={state.active}
        disabled={!!state.disabledReason}
        labelledBy={labelId}
        describedBy={descId}
        onChange={() => item.toggle()}
      />
    </li>
  );
}

export function MorePanel({ items, onOpen }: { items: readonly MoreItem[]; onOpen?: () => void }) {
  // 面板打開時讓功能重新檢查 YouTube 的狀態（例如自動播放開關）。
  useEffect(() => onOpen?.(), [onOpen]);
  return (
    <ul class="yte-more">
      {items.map((item) => (
        <MoreRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

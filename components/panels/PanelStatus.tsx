// 面板內容的共通狀態（001 FR-14）：載入中、錯誤與重試、尚未推出。
import { t } from '@/utils/i18n';
import { Icon } from '../icons';

export function PanelLoading() {
  return (
    <div class="yte-status" role="status" aria-live="polite">
      <span class="yte-spinner">
        <Icon name="progress_activity" />
      </span>
      <span>{t('loading')}</span>
    </div>
  );
}

export function PanelError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div class="yte-status yte-status-error" role="alert">
      <Icon name="error" />
      <span>{message ?? t('errorGeneric')}</span>
      <button type="button" class="yte-button yte-button-secondary" onClick={onRetry}>
        <Icon name="refresh" size={18} />
        <span>{t('retry')}</span>
      </button>
    </div>
  );
}

export function ComingSoon() {
  return <p class="yte-muted">{t('comingSoon')}</p>;
}

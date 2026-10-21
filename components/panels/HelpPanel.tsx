// 說明面板（001 FR-17、FR-18）：列出每個按鈕的圖示、名稱與一句話說明，
// 並提供開啟設定頁的連結。內容完全內建，不開啟外部網站。
import { t } from '@/utils/i18n';
import type { ContentMessage } from '@/utils/messages';
import { Icon } from '../icons';
import { ALL_BUTTONS } from '../toolbar/buttons';

function openOptions() {
  const message: ContentMessage = { type: 'openOptions' };
  browser.runtime.sendMessage(message).catch((err: unknown) => {
    console.info('[youtube-extension] failed to open settings', err);
  });
}

export function HelpPanel() {
  return (
    <div class="yte-help">
      <ul class="yte-help-list">
        {ALL_BUTTONS.map((b) => (
          <li key={b.id} class="yte-help-item" data-button={b.id}>
            <span class="yte-help-icon">
              <Icon name={b.icon} />
            </span>
            <span class="yte-help-text">
              <span class="yte-help-name">{t(b.label)}</span>
              <span class="yte-help-desc">{t(b.description)}</span>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" class="yte-link" onClick={openOptions}>
        <Icon name="settings" size={20} />
        <span>{t('helpOpenSettings')}</span>
      </button>
    </div>
  );
}

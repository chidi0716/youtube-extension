// 新版本提醒（008 FR-28、FR-29，constitution 第 7c 點）：
// - UpdateCard：工具列下方、不疊在播放器上的小卡片。出現時短暫淡入（遵守 prefers-reduced-motion），不搶焦點、不出聲；
//   按鈕可以用 Tab 到達。
// - UpdateNotice：同一則提醒放在「更多」選單頂端（卡片收合後，點「更多」可以看到）。
import type { UpdateReminder } from '@/features/update/content';
import type { ReminderView } from '@/utils/update-check';
import { t } from '@/utils/i18n';
import { Icon } from '../icons';

interface ReminderProps {
  view: ReminderView;
  reminder: UpdateReminder;
}

function Actions({ reminder }: { reminder: UpdateReminder }) {
  return (
    <div class="yte-update-actions">
      <button type="button" class="yte-button yte-button-primary" data-action="open" onClick={() => reminder.open()}>
        <Icon name="open_in_new" size={18} />
        <span>{t('updateReminderOpen')}</span>
      </button>
      <button type="button" class="yte-button yte-button-secondary" data-action="skip" onClick={() => reminder.skip()}>
        {t('updateReminderSkip')}
      </button>
      <button type="button" class="yte-button yte-button-secondary" data-action="disable" onClick={() => reminder.disable()}>
        {t('updateReminderDisable')}
      </button>
    </div>
  );
}

function Text({ view, headingId }: { view: ReminderView; headingId: string }) {
  const latest = view.latest!;
  return (
    <div class="yte-update-text">
      <p id={headingId} class="yte-update-heading">
        {t('updateReminderTitle', latest.version)}
      </p>
      <p class="yte-update-release" title={latest.title}>
        {latest.title}
      </p>
    </div>
  );
}

export function UpdateCard({ view, reminder }: ReminderProps) {
  if (!view.latest) return null;
  return (
    <section
      class="yte-update-card"
      aria-labelledby="yte-update-card-heading"
      data-version={view.latest.version}
      onMouseEnter={() => reminder.controller.hover(true)}
      onMouseLeave={() => reminder.controller.hover(false)}
    >
      <span class="yte-update-icon">
        <Icon name="upgrade" />
      </span>
      <div class="yte-update-body">
        <Text view={view} headingId="yte-update-card-heading" />
        <Actions reminder={reminder} />
      </div>
      <button
        type="button"
        class="yte-icon-btn yte-update-close"
        aria-label={t('updateReminderClose')}
        title={t('updateReminderClose')}
        onClick={() => reminder.dismiss()}
      >
        <Icon name="close" size={20} />
      </button>
    </section>
  );
}

export function UpdateNotice({ view, reminder }: ReminderProps) {
  if (!view.latest) return null;
  return (
    <section class="yte-update-notice" aria-labelledby="yte-update-notice-heading" data-version={view.latest.version}>
      <span class="yte-update-icon">
        <Icon name="upgrade" />
      </span>
      <div class="yte-update-body">
        <Text view={view} headingId="yte-update-notice-heading" />
        <Actions reminder={reminder} />
      </div>
    </section>
  );
}

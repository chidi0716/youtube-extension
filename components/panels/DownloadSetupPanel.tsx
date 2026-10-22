// 影片、MP3 面板的未連線狀態（002 FR-1、FR-2，tasks T22a）：
// - 直播中或尚未開始的影片：顯示無法下載；
// - 找不到橋接程式時：列出需要的元件、依作業系統顯示安裝步驟並連到 README 的安裝章節、「重新檢查」按鈕。
// 畫質清單與 MP3 選項在橋接程式完成後（T19、T20）加入。
import { useEffect, useState } from 'preact/hooks';
import { checkHostStatus, INSTALL_COMMANDS, INSTALL_GUIDE_URL, type HostComponent, type HostStatus } from '@/features/downloads/host-status';
import { detectOs, type HostOs } from '@/features/downloads/logic';
import { t, type MessageKey } from '@/utils/i18n';
import { Button } from '../controls/Button';
import { Icon } from '../icons';
import { PanelError, PanelLoading } from './PanelStatus';
import { isLiveOrUpcoming, useVideoData } from './useVideoData';

const COMPONENT_LABELS: Record<HostComponent, MessageKey> = {
  host: 'hostComponentHelper',
  ytDlp: 'hostComponentYtDlp',
  ffmpeg: 'hostComponentFfmpeg',
};

const currentOs = (): HostOs => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return detectOs(nav.userAgentData?.platform || navigator.platform || '', navigator.userAgent);
};

function Steps({ os }: { os: HostOs }) {
  if (os === 'other') return <p class="yte-muted yte-setup-os">{t('hostOtherOs')}</p>;
  const cmd = INSTALL_COMMANDS[os];
  return (
    <ol class="yte-setup-steps" data-os={os}>
      <li>
        <span>{t(os === 'mac' ? 'hostStepPackagesMac' : 'hostStepPackagesWindows')}</span>
        <code class="yte-code">{cmd.packages}</code>
      </li>
      <li>
        <span>{t(os === 'mac' ? 'hostStepScriptMac' : 'hostStepScriptWindows')}</span>
        <code class="yte-code">{cmd.script}</code>
      </li>
      <li>{t('hostStepRecheck')}</li>
    </ol>
  );
}

export function DownloadSetupPanel({ videoId }: { videoId: string }) {
  const [attempt, setAttempt] = useState(0);
  const video = useVideoData(videoId, attempt);
  const [status, setStatus] = useState<HostStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [check, setCheck] = useState(0);
  const os = currentOs();

  useEffect(() => {
    let current = true;
    setChecking(true);
    void checkHostStatus().then((s) => {
      if (!current) return;
      setStatus(s);
      setChecking(false);
    });
    return () => {
      current = false;
    };
  }, [check]);

  if (video.status === 'loading') return <PanelLoading />;
  if (video.status === 'error') return <PanelError onRetry={() => setAttempt((n) => n + 1)} />;
  if (isLiveOrUpcoming(video.data)) return <p class="yte-muted yte-live-unavailable">{t('liveUnavailable')}</p>;
  if (!status) return <PanelLoading />;

  return (
    <div class="yte-setup" data-state={status.state}>
      <p class="yte-setup-title">
        <Icon name="error" />
        <span>{t('hostMissingTitle')}</span>
      </p>
      <p class="yte-setup-intro">{t('hostMissingIntro')}</p>
      <ul class="yte-setup-components">
        {(['host', 'ytDlp', 'ffmpeg'] as const).map((c) => (
          <li key={c} data-component={c} data-missing={status.missing.includes(c) ? '' : undefined}>
            <span>{t(COMPONENT_LABELS[c])}</span>
            <span class="yte-setup-state">{status.missing.includes(c) ? t(c === 'host' ? 'hostStatusUnreachable' : 'hostStatusUnknown') : '✓'}</span>
          </li>
        ))}
      </ul>
      <p class="yte-setup-os-title">{t(os === 'mac' ? 'hostStepsTitleMac' : os === 'windows' ? 'hostStepsTitleWindows' : 'hostStepsTitleOther')}</p>
      <Steps os={os} />
      <div class="yte-setup-actions">
        <a class="yte-link" href={INSTALL_GUIDE_URL} target="_blank" rel="noopener noreferrer">
          <Icon name="open_in_new" size={20} />
          <span>{t('hostInstallGuide')}</span>
        </a>
        <Button variant="primary" disabled={checking} onClick={() => setCheck((n) => n + 1)}>
          <Icon name="refresh" size={18} />
          <span>{checking ? t('hostChecking') : t('hostRecheck')}</span>
        </Button>
      </div>
    </div>
  );
}

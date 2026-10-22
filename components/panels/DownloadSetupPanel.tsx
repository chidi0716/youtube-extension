// 影片、MP3 面板（暫時版本，T16）：直播中或尚未開始的影片顯示無法下載；
// 橋接程式無法連線或缺少元件時顯示安裝說明（002 FR-1、FR-2）。畫質清單與 MP3 選項在 T19、T20 加入。
import { useState } from 'preact/hooks';
import { canDownload, missingOnlyDeno } from '@/features/downloads/host-status';
import { t } from '@/utils/i18n';
import { DenoHint, HostSetup, useHostState } from './HostSetup';
import { ComingSoon, PanelError, PanelLoading } from './PanelStatus';
import { isLiveOrUpcoming, useVideoData } from './useVideoData';

export function DownloadSetupPanel({ videoId }: { videoId: string }) {
  const [attempt, setAttempt] = useState(0);
  const video = useVideoData(videoId, attempt);
  const host = useHostState();
  if (video.status === 'loading' || host.state === null) return <PanelLoading />;
  if (video.status === 'error') return <PanelError onRetry={() => setAttempt((n) => n + 1)} />;
  if (isLiveOrUpcoming(video.data)) return <p class="yte-muted yte-live-unavailable">{t('liveUnavailable')}</p>;
  if (!canDownload(host.state)) return <HostSetup state={host.state} checking={host.checking} recheck={host.recheck} />;
  return (
    <>
      {missingOnlyDeno(host.state) && <DenoHint state={host.state} />}
      <ComingSoon />
    </>
  );
}

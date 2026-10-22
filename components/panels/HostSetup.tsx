// 橋接程式的狀態與安裝說明（002 FR-2，tasks T16、T22、T22a）：
// - useHostState：向背景腳本查詢 status（含 deno），可以重新檢查；
// - HostSetup：列出必要元件（橋接程式、yt-dlp、ffmpeg、deno）與狀態，依作業系統顯示安裝步驟、
//   README 的安裝章節連結與「重新檢查」按鈕；
// - DenoHint：只缺 deno 時的建議提示（可以下載，T15a）。
import { useCallback, useEffect, useState } from 'preact/hooks';
import { checkHostStatus } from '@/features/downloads/host-client';
import {
  componentState,
  componentVersion,
  HOST_COMPONENTS,
  INSTALL_COMMANDS,
  INSTALL_GUIDE_URL,
  installCommand,
  type HostComponent,
  type HostState,
} from '@/features/downloads/host-status';
import { detectOs, type HostOs } from '@/features/downloads/logic';
import { t, type MessageKey } from '@/utils/i18n';
import { Button } from '../controls/Button';
import { Icon } from '../icons';

const COMPONENT_LABELS: Record<HostComponent, MessageKey> = {
  host: 'hostComponentHelper',
  ytDlp: 'hostComponentYtDlp',
  ffmpeg: 'hostComponentFfmpeg',
  deno: 'hostComponentDeno',
};

export const currentOs = (): HostOs => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return detectOs(nav.userAgentData?.platform || navigator.platform || '', navigator.userAgent);
};

/** 檢查中顯示「檢查中」至少這麼久，讓使用者看得出「重新檢查」有作用。 */
const MIN_CHECK_MS = 400;

export function useHostState(): { state: HostState | null; checking: boolean; recheck: () => void } {
  const [state, setState] = useState<HostState | null>(null);
  const [checking, setChecking] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setChecking(true);
    const started = Date.now();
    void checkHostStatus(attempt > 0).then(async (s) => {
      const wait = MIN_CHECK_MS - (Date.now() - started);
      if (attempt > 0 && wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (!current) return;
      setState(s);
      setChecking(false);
    });
    return () => {
      current = false;
    };
  }, [attempt]);
  const recheck = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, checking, recheck };
}

function stateText(s: HostState, c: HostComponent): { text: string; missing: boolean } {
  const ok = componentState(s, c);
  if (ok === null) return { text: t(c === 'host' ? 'hostStatusUnreachable' : 'hostStatusUnknown'), missing: true };
  if (!ok) return { text: t(c === 'host' ? 'hostStatusUnreachable' : 'hostStatusMissing'), missing: true };
  const version = componentVersion(s, c);
  return { text: version ? t('hostStatusVersion', version) : t('hostStatusFound'), missing: false };
}

function Steps({ os, state }: { os: HostOs; state: HostState }) {
  if (os === 'other') return <p class="yte-muted yte-setup-os">{t('hostOtherOs')}</p>;
  const packages = installCommand(state, os);
  const needScript = state.state === 'unreachable';
  return (
    <ol class="yte-setup-steps" data-os={os}>
      {packages && (
        <li>
          <span>{t(os === 'mac' ? 'hostStepPackagesMac' : 'hostStepPackagesWindows')}</span>
          <code class="yte-code">{packages}</code>
        </li>
      )}
      {needScript && (
        <li>
          <span>{t(os === 'mac' ? 'hostStepScriptMac' : 'hostStepScriptWindows')}</span>
          <code class="yte-code">{INSTALL_COMMANDS[os].script}</code>
        </li>
      )}
      <li>{t(needScript ? 'hostStepRecheck' : 'hostStepRecheckOnly')}</li>
    </ol>
  );
}

/** 未連線或缺少元件時的說明（002 FR-2）。 */
export function HostSetup({ state, checking, recheck }: { state: HostState; checking: boolean; recheck: () => void }) {
  const os = currentOs();
  return (
    <div class="yte-setup" data-state={state.state}>
      <p class="yte-setup-title">
        <Icon name="error" />
        <span>{t(state.state === 'unreachable' ? 'hostMissingTitle' : 'hostToolsMissingTitle')}</span>
      </p>
      <p class="yte-setup-intro">{t('hostMissingIntro')}</p>
      <ul class="yte-setup-components">
        {HOST_COMPONENTS.map((c) => {
          const { text, missing } = stateText(state, c);
          return (
            <li key={c} data-component={c} data-missing={missing ? '' : undefined}>
              <span>{t(COMPONENT_LABELS[c])}</span>
              <span class="yte-setup-state">{text}</span>
            </li>
          );
        })}
      </ul>
      <p class="yte-setup-os-title">{t(os === 'mac' ? 'hostStepsTitleMac' : os === 'windows' ? 'hostStepsTitleWindows' : 'hostStepsTitleOther')}</p>
      <Steps os={os} state={state} />
      <div class="yte-setup-actions">
        <a class="yte-link" href={INSTALL_GUIDE_URL} target="_blank" rel="noopener noreferrer">
          <Icon name="open_in_new" size={20} />
          <span>{t('hostInstallGuide')}</span>
        </a>
        <Button variant="primary" disabled={checking} onClick={recheck}>
          <Icon name="refresh" size={18} />
          <span>{checking ? t('hostChecking') : t('hostRecheck')}</span>
        </Button>
      </div>
    </div>
  );
}

/** 只缺 deno 時的建議（可以下載，但部分格式可能缺少，T15a）。 */
export function DenoHint({ state }: { state: HostState }) {
  const command = installCommand(state, currentOs());
  return (
    <div class="yte-hint yte-deno-hint" role="note">
      <Icon name="error" size={18} />
      <span>
        {t('hostDenoHint')}
        {command && <code class="yte-code">{command}</code>}
      </span>
    </div>
  );
}

// 橋接程式的連線狀態（002 FR-2，tasks T16、T22）：由背景腳本以 status 指令查詢。
// 必要元件為橋接程式、yt-dlp、ffmpeg、deno；ready（yt-dlp 與 ffmpeg 可用）時可以下載，只缺 deno 時顯示建議安裝的提示。
import type { HostStatusResult } from '@/utils/native-protocol';
import type { HostOs } from './logic';

export type HostComponent = 'host' | 'ytDlp' | 'ffmpeg' | 'deno';
export const HOST_COMPONENTS: readonly HostComponent[] = ['host', 'ytDlp', 'ffmpeg', 'deno'];

export type HostState =
  | { state: 'unreachable' }
  /** 橋接程式可以連線；status.ready 為 false 時缺少 yt-dlp 或 ffmpeg。 */
  | { state: 'connected'; status: HostStatusResult };

/** README 的安裝章節（QUESTIONS Q33）。 */
export const INSTALL_GUIDE_URL = 'https://github.com/chidi0716/youtube-extension#install-the-helper';

/** 安裝說明中的指令（002 FR-2、README 的安裝章節）；指令本身不翻譯。 */
export const INSTALL_COMMANDS: Record<Exclude<HostOs, 'other'>, { packages: string; script: string }> = {
  mac: { packages: 'brew install yt-dlp ffmpeg deno', script: 'sh host/dist/youtube-extension-host-macos/install.sh' },
  windows: {
    packages: 'winget install yt-dlp.yt-dlp Gyan.FFmpeg DenoLand.Deno',
    script: 'powershell -ExecutionPolicy Bypass -File host\\dist\\youtube-extension-host-windows\\install.ps1',
  },
};

/** 可以下載（yt-dlp 與 ffmpeg 都可用）。 */
export const canDownload = (s: HostState): s is Extract<HostState, { state: 'connected' }> => s.state === 'connected' && s.status.ready;

/** 各元件是否可用；null 表示無法確認（找不到橋接程式，或舊版橋接程式沒有回報 deno）。 */
export function componentState(s: HostState, c: HostComponent): boolean | null {
  if (c === 'host') return s.state === 'connected';
  if (s.state !== 'connected') return null;
  if (c === 'ytDlp') return s.status.ytDlp.found && !s.status.ytDlp.error;
  if (c === 'ffmpeg') return s.status.ffmpeg.found && !s.status.ffmpeg.error;
  return s.status.deno ? s.status.deno.found && !s.status.deno.error : null;
}

/** 元件的版本（可用時）。 */
export function componentVersion(s: HostState, c: HostComponent): string | null {
  if (s.state !== 'connected') return null;
  if (c === 'host') return s.status.hostVersion || null;
  const tool = c === 'ytDlp' ? s.status.ytDlp : c === 'ffmpeg' ? s.status.ffmpeg : s.status.deno;
  return tool?.found ? tool.version : null;
}

/** 安裝缺少元件的指令：橋接程式回報的指令優先，否則依作業系統一次安裝三者（002 FR-2）。 */
export function installCommand(s: HostState, os: HostOs): string | null {
  if (s.state === 'connected' && s.status.installCommand) return s.status.installCommand;
  return os === 'other' ? null : INSTALL_COMMANDS[os].packages;
}

/** 只缺 deno（可以下載，但建議安裝，T15a）。 */
export const missingOnlyDeno = (s: HostState) => canDownload(s) && componentState(s, 'deno') === false;

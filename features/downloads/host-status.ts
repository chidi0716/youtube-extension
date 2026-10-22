// 橋接程式的連線狀態（002 FR-2）。階段 4a：橋接程式與背景腳本的連線（T16）還沒完成，所以一律以
// 「無法連線」處理；T16 完成後改為向背景腳本查詢 status 指令的結果。
import type { HostOs } from './logic';

export type HostComponent = 'host' | 'ytDlp' | 'ffmpeg';

export interface HostStatus {
  /** unreachable：找不到橋接程式（yt-dlp、ffmpeg 也就無法確認）。 */
  state: 'unreachable' | 'ready';
  /** 缺少（或無法確認）的元件。 */
  missing: HostComponent[];
}

/** README 的安裝章節（章節會在 T15 撰寫，這裡先以錨點連結）。 */
export const INSTALL_GUIDE_URL = 'https://github.com/chidi0716/youtube-extension#install-the-helper';

/** 安裝說明中的指令（plan 4.8）；指令本身不翻譯。 */
export const INSTALL_COMMANDS: Record<Exclude<HostOs, 'other'>, { packages: string; script: string }> = {
  mac: { packages: 'brew install yt-dlp ffmpeg', script: './install.sh' },
  windows: { packages: 'winget install yt-dlp.yt-dlp Gyan.FFmpeg', script: 'powershell -ExecutionPolicy Bypass -File .\\install.ps1' },
};

/** 檢查連線狀態。顯示「檢查中」至少這麼久，讓使用者看得出按鈕有作用。 */
const MIN_CHECK_MS = 400;

export async function checkHostStatus(): Promise<HostStatus> {
  await new Promise((resolve) => setTimeout(resolve, MIN_CHECK_MS));
  return { state: 'unreachable', missing: ['host', 'ytDlp', 'ffmpeg'] };
}

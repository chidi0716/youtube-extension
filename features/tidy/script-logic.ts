// 頁面整理中需要程式的選項的純邏輯（005 第「觀看頁」「干擾」節）。
import type { AudioTrackInfo } from '@/utils/youtube/dom';

// ---------------------------------------------------------------------------
// 永遠使用原始語音（FR-10、FR-11）
// ---------------------------------------------------------------------------

/**
 * 目前播放的是自動配音、而且能確定哪一個是原始語音時，回傳原始語音的 ID；否則回傳 null（不做任何事）。
 * 原始語音的判斷依序為：明確標示為原始語音（acont=original）、影片的預設語音軌、唯一不是自動配音的語音軌；
 * 任一步有多個候選時視為無法確定。
 */
export function pickOriginalTrack(tracks: readonly AudioTrackInfo[], currentId: string | null): string | null {
  if (tracks.length < 2) return null; // FR-11：只有一個語音軌
  const current = tracks.find((t) => t.id === currentId);
  if (!current?.isAutoDubbed) return null; // FR-11：預設就不是自動配音
  const notDubbed = tracks.filter((t) => !t.isAutoDubbed);
  for (const candidates of [notDubbed.filter((t) => t.isOriginal), notDubbed.filter((t) => t.isDefault), notDubbed]) {
    if (candidates.length === 1) return candidates[0]!.id;
    if (candidates.length > 1) return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 自動關閉「影片已暫停，要繼續觀看嗎？」（FR-30、FR-31）
// ---------------------------------------------------------------------------

/** YouTube 只在長時間沒有操作後才詢問；這段時間內有使用者操作時，視為使用者自己的對話框或暫停。 */
export const CONTINUE_MIN_IDLE_MS = 30_000;
/** 對話框出現前後這段時間內影片被暫停，才視為「因為這個對話框而暫停」。 */
export const CONTINUE_PAUSE_WINDOW_MS = 10_000;

export interface ContinueCheck {
  /** 頁面上有可見的確認對話框。 */
  dialogVisible: boolean;
  videoPaused: boolean;
  /** 距離使用者最後一次在這個頁面點擊或按鍵的時間；沒有操作過時為 Infinity。 */
  msSinceUserInput: number;
  /** 距離影片最後一次被暫停的時間；沒有暫停過時為 Infinity。 */
  msSincePause: number;
}

/**
 * 是否關閉對話框並繼續播放：對話框出現、影片因此剛被暫停、使用者一段時間沒有操作。
 * 使用者自己按暫停（或剛操作過）時不會自動播放（FR-31）。
 */
export function shouldAutoContinue({ dialogVisible, videoPaused, msSinceUserInput, msSincePause }: ContinueCheck): boolean {
  return dialogVisible && videoPaused && msSinceUserInput >= CONTINUE_MIN_IDLE_MS && msSincePause <= CONTINUE_PAUSE_WINDOW_MS;
}

// 不需要橋接程式的下載（階段 4a）與未連線狀態的純邏輯（002 FR-2、FR-30、FR-40、FR-43）。
import { THUMBNAIL_PLACEHOLDER_SIZE, type CaptionTrack } from '@/utils/youtube/dom';

// ---------------------------------------------------------------------------
// 縮圖（FR-30、plan 3.8）
// ---------------------------------------------------------------------------

/** 縮圖是否實際存在：排除 404 等錯誤，以及 YouTube 的 120×90 預設圖。 */
export function isRealThumbnail(status: number, width: number, height: number): boolean {
  if (status < 200 || status >= 300) return false;
  if (!(width > 0 && height > 0)) return false;
  return !(width === THUMBNAIL_PLACEHOLDER_SIZE.width && height === THUMBNAIL_PLACEHOLDER_SIZE.height);
}

// ---------------------------------------------------------------------------
// 字幕（FR-40、FR-43）
// ---------------------------------------------------------------------------

export interface CaptionGroups {
  uploaded: CaptionTrack[];
  auto: CaptionTrack[];
}

/** 分成「上傳的字幕」與「自動產生的字幕」兩組（FR-40）。 */
export function groupCaptions(tracks: readonly CaptionTrack[]): CaptionGroups {
  return { uploaded: tracks.filter((t) => !t.isAuto), auto: tracks.filter((t) => t.isAuto) };
}

const primary = (code: string) => code.toLowerCase().split('-')[0]!;

/**
 * 預設選擇的字幕（FR-43）：與瀏覽器語言相同的字幕（完全相同優先，其次主要語言相同；上傳的字幕優先於自動產生）；
 * 沒有時選影片原始語言（自動產生的字幕的語言，即影片說話的語言；有同語言的上傳字幕時用上傳的）；
 * 再沒有時選第一個。沒有字幕時回傳 -1。
 */
export function defaultCaptionIndex(tracks: readonly CaptionTrack[], uiLanguage: string): number {
  if (tracks.length === 0) return -1;
  const ordered = [...tracks.keys()].sort((a, b) => Number(tracks[a]!.isAuto) - Number(tracks[b]!.isAuto));
  const lang = uiLanguage.toLowerCase().replace('_', '-');
  const exact = ordered.find((i) => tracks[i]!.languageCode.toLowerCase() === lang);
  if (exact !== undefined) return exact;
  const samePrimary = ordered.find((i) => primary(tracks[i]!.languageCode) === primary(lang));
  if (samePrimary !== undefined) return samePrimary;
  const asr = tracks.findIndex((t) => t.isAuto);
  if (asr !== -1) {
    const original = ordered.find((i) => !tracks[i]!.isAuto && tracks[i]!.languageCode === tracks[asr]!.languageCode);
    return original ?? asr;
  }
  return 0;
}

/**
 * 面板中的清單順序（FR-43「清單最上方預設選中」）：預設選擇的字幕排在所屬分組的最上方，其他維持 YouTube 的順序。
 */
export function orderCaptions(tracks: readonly CaptionTrack[], uiLanguage: string): { groups: CaptionGroups; selected: CaptionTrack | null } {
  const index = defaultCaptionIndex(tracks, uiLanguage);
  const selected = index === -1 ? null : tracks[index]!;
  const sorted = selected ? [selected, ...tracks.filter((t) => t !== selected)] : [...tracks];
  return { groups: groupCaptions(sorted), selected };
}

// ---------------------------------------------------------------------------
// 未連線狀態（FR-2）
// ---------------------------------------------------------------------------

export type HostOs = 'mac' | 'windows' | 'other';

/** 依瀏覽器提供的平台資訊判斷作業系統（只用來決定顯示哪一份安裝說明）。 */
export function detectOs(platform: string, userAgent: string): HostOs {
  const text = `${platform} ${userAgent}`.toLowerCase();
  if (/\b(iphone|ipad|android)\b/.test(text)) return 'other';
  if (/mac/.test(text)) return 'mac';
  if (/win/.test(text)) return 'windows';
  return 'other';
}

// 頁面整理（005 FR-1）在設定頁的分類與選項：每個選項是一個開關，附一行說明。
// 設定頁依這份清單繪製；選項的作用見 classes.ts（只靠樣式）與 index.ts（需要程式）。
import type { MessageKey } from '@/utils/i18n';
import {
  tidyAutoContinue,
  tidyFullTitles,
  tidyHideEndCards,
  tidyHideShorts,
  tidyNoThumbnailPreview,
  tidyOriginalAudio,
  tidyShortsToWatch,
} from '@/utils/settings';
import type { WxtStorageItem } from 'wxt/utils/storage';

export type TidyOptionId =
  | 'originalAudio'
  | 'hideEndCards'
  | 'autoContinue'
  | 'noThumbnailPreview'
  | 'shortsToWatch'
  | 'hideShorts'
  | 'fullTitles';

export interface TidyOption {
  id: TidyOptionId;
  item: WxtStorageItem<boolean, Record<string, unknown>>;
  label: MessageKey;
  description: MessageKey;
}

export interface TidyCategory {
  id: 'watch' | 'distractions' | 'shorts' | 'interface';
  title: MessageKey;
  options: readonly TidyOption[];
}

/** 005 FR-1 的四個類別與順序。 */
export const TIDY_CATEGORIES: readonly TidyCategory[] = [
  {
    id: 'watch',
    title: 'tidyGroupWatch',
    options: [
      { id: 'originalAudio', item: tidyOriginalAudio, label: 'tidyOriginalAudio', description: 'tidyOriginalAudioDesc' },
      { id: 'hideEndCards', item: tidyHideEndCards, label: 'tidyHideEndCards', description: 'tidyHideEndCardsDesc' },
    ],
  },
  {
    id: 'distractions',
    title: 'tidyGroupDistractions',
    options: [
      { id: 'autoContinue', item: tidyAutoContinue, label: 'tidyAutoContinue', description: 'tidyAutoContinueDesc' },
      { id: 'noThumbnailPreview', item: tidyNoThumbnailPreview, label: 'tidyNoThumbnailPreview', description: 'tidyNoThumbnailPreviewDesc' },
    ],
  },
  {
    id: 'shorts',
    title: 'tidyGroupShorts',
    options: [
      { id: 'shortsToWatch', item: tidyShortsToWatch, label: 'tidyShortsToWatch', description: 'tidyShortsToWatchDesc' },
      { id: 'hideShorts', item: tidyHideShorts, label: 'tidyHideShorts', description: 'tidyHideShortsDesc' },
    ],
  },
  {
    id: 'interface',
    title: 'tidyGroupInterface',
    options: [{ id: 'fullTitles', item: tidyFullTitles, label: 'tidyFullTitles', description: 'tidyFullTitlesDesc' }],
  },
];

export const TIDY_OPTIONS: readonly TidyOption[] = TIDY_CATEGORIES.flatMap((c) => c.options);

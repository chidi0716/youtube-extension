// 工具列按鈕的定義與順序（001 FR-6、FR-8）。
import type { IconName } from '../icons';
import type { MessageKey } from '@/utils/i18n';

/**
 * - panel：點了展開面板。
 * - toggle：點了直接開關某個狀態，開啟時維持圓形背景（FR-9）。
 * - action：點了直接執行（截圖、關閉）。
 */
export type ButtonKind = 'panel' | 'toggle' | 'action';

export type ButtonId =
  | 'video'
  | 'mp3'
  | 'thumbnail'
  | 'subtitles'
  | 'screenshot'
  | 'link'
  | 'darkMode'
  | 'cinema'
  | 'pip'
  | 'floating'
  | 'loop'
  | 'more'
  | 'help'
  | 'close';

export interface ButtonDef {
  id: ButtonId;
  kind: ButtonKind;
  icon: IconName;
  /** 按鈕名稱：提示文字與無障礙標籤（FR-7）。 */
  label: MessageKey;
  /** 說明面板中的一句話說明（FR-17）。 */
  description: MessageKey;
  /** 面板標題；未指定時使用按鈕名稱。 */
  panelTitle?: MessageKey;
}

/** 左組（下載類），由左至右。 */
export const LEFT_BUTTONS: readonly ButtonDef[] = [
  { id: 'video', kind: 'panel', icon: 'movie', label: 'btnVideo', description: 'helpVideo', panelTitle: 'panelTitleVideo' },
  { id: 'mp3', kind: 'panel', icon: 'music_note', label: 'btnMp3', description: 'helpMp3' },
  { id: 'thumbnail', kind: 'panel', icon: 'image', label: 'btnThumbnail', description: 'helpThumbnail' },
  { id: 'subtitles', kind: 'panel', icon: 'subtitles', label: 'btnSubtitles', description: 'helpSubtitles' },
  { id: 'screenshot', kind: 'action', icon: 'photo_camera', label: 'btnScreenshot', description: 'helpScreenshot' },
  // 004 第 4 節：複製帶時間的連結。
  { id: 'link', kind: 'panel', icon: 'link', label: 'btnLink', description: 'helpLink', panelTitle: 'panelTitleLink' },
];

/** 右組（觀看輔助類），由左至右。 */
export const RIGHT_BUTTONS: readonly ButtonDef[] = [
  { id: 'darkMode', kind: 'toggle', icon: 'dark_mode', label: 'btnDarkMode', description: 'helpDarkMode' },
  { id: 'cinema', kind: 'toggle', icon: 'lightbulb', label: 'btnCinema', description: 'helpCinema' },
  { id: 'pip', kind: 'toggle', icon: 'picture_in_picture_alt', label: 'btnPip', description: 'helpPip' },
  { id: 'floating', kind: 'toggle', icon: 'branding_watermark', label: 'btnFloating', description: 'helpFloating' },
  { id: 'loop', kind: 'panel', icon: 'repeat', label: 'btnLoop', description: 'helpLoop' },
  { id: 'more', kind: 'panel', icon: 'more_vert', label: 'btnMore', description: 'helpMore' },
  { id: 'help', kind: 'panel', icon: 'help', label: 'btnHelp', description: 'helpHelp' },
  { id: 'close', kind: 'action', icon: 'close', label: 'btnClose', description: 'helpClose' },
];

export const ALL_BUTTONS: readonly ButtonDef[] = [...LEFT_BUTTONS, ...RIGHT_BUTTONS];

export function getButton(id: ButtonId): ButtonDef {
  return ALL_BUTTONS.find((b) => b.id === id)!;
}

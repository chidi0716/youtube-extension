// 面板定位（001 FR-11）：從按鈕正下方展開，左緣對齊按鈕；
// 若會超出播放器右緣，改成右緣對齊按鈕。純函式，座標都以視窗（client）座標表示。

export interface HorizontalRange {
  left: number;
  right: number;
}

export interface PanelPlacementInput {
  /** 按鈕的位置。 */
  button: HorizontalRange;
  /** 面板的寬度（已套用最大寬度限制）。 */
  panelWidth: number;
  /** 不得超出的範圍：播放器的左右緣。 */
  bounds: HorizontalRange;
}

export interface PanelPlacement {
  /** 面板左緣（視窗座標）。 */
  left: number;
  align: 'start' | 'end';
}

export function placePanel({ button, panelWidth, bounds }: PanelPlacementInput): PanelPlacement {
  if (button.left + panelWidth <= bounds.right) {
    return { left: button.left, align: 'start' };
  }
  // 右緣對齊按鈕；若因此超出播放器左緣，再往右推回播放器範圍內。
  const left = Math.max(button.right - panelWidth, bounds.left);
  return { left, align: 'end' };
}

/** 面板的最大寬度不超過播放器寬度（001 外觀規格）。 */
export function maxPanelWidth(bounds: HorizontalRange): number {
  return Math.max(0, bounds.right - bounds.left);
}

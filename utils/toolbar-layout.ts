// 自訂工具列的設定模型（006 FR-20、FR-23、FR-24、NFR-2，plan 3.7.3，tasks T32）。純函式。
// 設定只存工具的識別字串、顯示與否與順序；分隔點（左右兩組的分界）也是清單中的一個項目。
// 「更多」與「關閉」是固定工具，不在設定中，永遠在工具列最右邊。

/** 可以自訂的工具（固定的識別字串，不使用顯示名稱）。 */
export const TOOL_IDS = [
  'video',
  'mp3',
  'thumbnail',
  'subtitles',
  'screenshot',
  'link',
  'darkMode',
  'cinema',
  'pip',
  'floating',
  'loop',
  'help',
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export const SEPARATOR = 'separator';
export type LayoutItemId = ToolId | typeof SEPARATOR;

export interface LayoutItem {
  id: LayoutItemId;
  /** 分隔點永遠為 true。 */
  visible: boolean;
}

export interface ToolbarLayout {
  version: 1;
  items: LayoutItem[];
}

export const LAYOUT_VERSION = 1;

/** 預設的左組與右組（006 FR-23）。 */
export const DEFAULT_LEFT: readonly ToolId[] = ['video', 'mp3', 'thumbnail', 'subtitles', 'screenshot', 'link'];
export const DEFAULT_RIGHT: readonly ToolId[] = ['darkMode', 'cinema', 'pip', 'floating', 'loop', 'help'];

export const isToolId = (v: unknown): v is ToolId => typeof v === 'string' && (TOOL_IDS as readonly string[]).includes(v);

export function defaultLayout(): ToolbarLayout {
  return {
    version: LAYOUT_VERSION,
    items: [
      ...DEFAULT_LEFT.map((id) => ({ id, visible: true })),
      { id: SEPARATOR, visible: true },
      ...DEFAULT_RIGHT.map((id) => ({ id, visible: true })),
    ],
  };
}

/**
 * 讀取設定：驗證並與預設清單合併（006 FR-24）。
 * - 不是物件、版本號不認得：使用預設值。
 * - 不認得的工具（已移除）與重複的項目忽略；`visible` 不是布林值時視為顯示。
 * - 沒有分隔點時加在最後面。
 * - 設定中沒有的工具（之後版本新增）以顯示狀態加在其預設組的最後面：左組加在分隔點前，右組加在最後。
 */
export function normalizeLayout(raw: unknown): ToolbarLayout {
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== LAYOUT_VERSION) return defaultLayout();
  const list = (raw as { items?: unknown }).items;
  if (!Array.isArray(list)) return defaultLayout();
  const seen = new Set<string>();
  const items: LayoutItem[] = [];
  for (const entry of list.slice(0, 100)) {
    if (!entry || typeof entry !== 'object') continue;
    const id = (entry as { id?: unknown }).id;
    if (id !== SEPARATOR && !isToolId(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const visible = (entry as { visible?: unknown }).visible;
    items.push({ id, visible: id === SEPARATOR ? true : visible !== false });
  }
  if (!seen.has(SEPARATOR)) items.push({ id: SEPARATOR, visible: true });
  for (const id of DEFAULT_LEFT) {
    if (seen.has(id)) continue;
    items.splice(separatorIndex({ version: LAYOUT_VERSION, items }), 0, { id, visible: true });
  }
  for (const id of DEFAULT_RIGHT) {
    if (!seen.has(id)) items.push({ id, visible: true });
  }
  return { version: LAYOUT_VERSION, items };
}

export const separatorIndex = (layout: ToolbarLayout) => layout.items.findIndex((i) => i.id === SEPARATOR);

/** 工具列上實際顯示的左組、右組，以及隱藏的工具（依設定的順序）。 */
export function splitLayout(layout: ToolbarLayout): { left: ToolId[]; right: ToolId[]; hidden: ToolId[] } {
  const sep = separatorIndex(layout);
  const left: ToolId[] = [];
  const right: ToolId[] = [];
  const hidden: ToolId[] = [];
  layout.items.forEach((item, index) => {
    if (item.id === SEPARATOR) return;
    if (!item.visible) hidden.push(item.id);
    else if (index < sep) left.push(item.id);
    else right.push(item.id);
  });
  return { left, right, hidden };
}

/** 把 from 位置的項目移到 to 位置（to 為移除該項目後的插入位置）。 */
export function moveItem(layout: ToolbarLayout, from: number, to: number): ToolbarLayout {
  const items = [...layout.items];
  if (from < 0 || from >= items.length) return layout;
  const [item] = items.splice(from, 1);
  const target = Math.max(0, Math.min(items.length, to));
  items.splice(target, 0, item!);
  return { ...layout, items };
}

/** 把項目往左（-1）或往右（+1）移一格（鍵盤操作、設定頁的上移／下移）。 */
export function stepItem(layout: ToolbarLayout, id: LayoutItemId, delta: -1 | 1): ToolbarLayout {
  const from = layout.items.findIndex((i) => i.id === id);
  if (from < 0) return layout;
  return moveItem(layout, from, from + delta);
}

/** 切換工具的顯示／隱藏；分隔點不能隱藏。 */
export function toggleVisible(layout: ToolbarLayout, id: LayoutItemId): ToolbarLayout {
  if (id === SEPARATOR) return layout;
  return { ...layout, items: layout.items.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i)) };
}

export function sameLayout(a: ToolbarLayout, b: ToolbarLayout): boolean {
  return a.items.length === b.items.length && a.items.every((item, i) => item.id === b.items[i]!.id && item.visible === b.items[i]!.visible);
}

export const isDefaultLayout = (layout: ToolbarLayout) => sameLayout(layout, defaultLayout());

/**
 * 拖曳時的插入位置：pointerX 與其他項目（不含被拖曳的項目）的中點比較。
 * centers 為其他項目中心點的 x 座標（依順序）。回傳 moveItem 的 to。
 */
export function dropIndex(centers: readonly number[], pointerX: number): number {
  let index = 0;
  while (index < centers.length && pointerX > centers[index]!) index++;
  return index;
}

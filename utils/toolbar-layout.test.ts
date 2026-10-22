import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEFT,
  DEFAULT_RIGHT,
  defaultLayout,
  dropIndex,
  isDefaultLayout,
  moveItem,
  normalizeLayout,
  SEPARATOR,
  splitLayout,
  stepItem,
  toggleVisible,
  type LayoutItem,
} from './toolbar-layout';

const ids = (items: readonly LayoutItem[]) => items.map((i) => (i.visible ? i.id : `-${i.id}`)).join(' ');
const layout = (items: LayoutItem[]) => ({ version: 1 as const, items });
const item = (id: LayoutItem['id'], visible = true): LayoutItem => ({ id, visible });

describe('預設值（006 FR-23）', () => {
  it('左組六個、分隔點、右組六個，全部顯示', () => {
    const d = defaultLayout();
    expect(ids(d.items)).toBe('video mp3 thumbnail subtitles screenshot link separator darkMode cinema pip floating loop help');
    expect(splitLayout(d)).toEqual({ left: [...DEFAULT_LEFT], right: [...DEFAULT_RIGHT], hidden: [] });
    expect(isDefaultLayout(d)).toBe(true);
  });
});

describe('normalizeLayout（驗證與合併，006 FR-24、NFR-2）', () => {
  it('合法的設定原樣保留', () => {
    const custom = layout([
      item('mp3'),
      item('video'),
      item('thumbnail'),
      item('subtitles'),
      item('link'),
      item(SEPARATOR),
      item('screenshot'),
      item('darkMode'),
      item('cinema'),
      item('pip'),
      item('floating', false),
      item('loop', false),
      item('help'),
    ]);
    expect(normalizeLayout(custom)).toEqual(custom);
  });

  it('非法資料使用預設值：不是物件、沒有版本號、版本號不認得、items 不是陣列', () => {
    for (const raw of [null, undefined, 'x', 1, [], {}, { items: [] }, { version: 2, items: [] }, { version: '1', items: [] }, { version: 1, items: 'x' }]) {
      expect(normalizeLayout(raw), JSON.stringify(raw)).toEqual(defaultLayout());
    }
  });

  it('忽略不認得（已移除）的工具、固定工具、重複項目與不是物件的項目', () => {
    const raw = { version: 1, items: [{ id: 'mp3', visible: true }, { id: 'removedTool' }, { id: 'more' }, { id: 'close', visible: false }, null, 'video', { id: 'mp3', visible: false }, { id: SEPARATOR }] };
    const result = normalizeLayout(raw);
    expect(result.items[0]).toEqual(item('mp3'));
    expect(result.items.filter((i) => i.id === 'mp3')).toHaveLength(1);
    expect(result.items.some((i) => (i.id as string) === 'more' || (i.id as string) === 'close' || (i.id as string) === 'removedTool')).toBe(false);
  });

  it('visible 不是布林值時視為顯示；分隔點永遠顯示', () => {
    const result = normalizeLayout({ version: 1, items: [{ id: 'video', visible: 'no' }, { id: SEPARATOR, visible: false }, { id: 'loop', visible: false }] });
    expect(result.items.find((i) => i.id === 'video')!.visible).toBe(true);
    expect(result.items.find((i) => i.id === SEPARATOR)!.visible).toBe(true);
    expect(result.items.find((i) => i.id === 'loop')!.visible).toBe(false);
  });

  it('新增的工具以顯示狀態加在所屬預設組的最後面（左組在分隔點前、右組在最後）', () => {
    // 舊設定只有部分工具，且 MP3 被移到右組、循環被隱藏。
    const raw = { version: 1, items: [item('video'), item(SEPARATOR), item('mp3'), item('loop', false)] };
    expect(ids(normalizeLayout(raw).items)).toBe(
      'video thumbnail subtitles screenshot link separator mp3 -loop darkMode cinema pip floating help',
    );
  });

  it('沒有分隔點時加在使用者清單的最後面，再補上缺少的工具', () => {
    const raw = { version: 1, items: [item('help'), item('video', false)] };
    expect(ids(normalizeLayout(raw).items)).toBe(
      'help -video mp3 thumbnail subtitles screenshot link separator darkMode cinema pip floating loop',
    );
  });

  it('只有一個分隔點（重複的忽略）', () => {
    const raw = { version: 1, items: [item(SEPARATOR), item('video'), item(SEPARATOR)] };
    expect(normalizeLayout(raw).items.filter((i) => i.id === SEPARATOR)).toHaveLength(1);
  });
});

describe('splitLayout', () => {
  it('分隔點左右分組，隱藏的工具另外列出（依設定順序）', () => {
    const l = normalizeLayout({ version: 1, items: [item('mp3'), item('video', false), item(SEPARATOR), item('screenshot'), item('loop', false), item('floating', false)] });
    const s = splitLayout(l);
    expect(s.left.slice(0, 2)).toEqual(['mp3', 'thumbnail']);
    expect(s.right.slice(0, 1)).toEqual(['screenshot']);
    expect(s.hidden).toEqual(['video', 'loop', 'floating']);
  });

  it('分隔點在最前面時全部在右組；在最後面時全部在左組', () => {
    const first = moveItem(defaultLayout(), 6, 0);
    expect(splitLayout(first).left).toEqual([]);
    const last = moveItem(defaultLayout(), 6, 12);
    expect(splitLayout(last).right).toEqual([]);
  });
});

describe('移動與切換', () => {
  it('moveItem：把 MP3 移到最左邊、把截圖移到分隔點右邊', () => {
    let l = moveItem(defaultLayout(), 1, 0);
    l = moveItem(l, l.items.findIndex((i) => i.id === 'screenshot'), l.items.findIndex((i) => i.id === SEPARATOR));
    expect(ids(l.items)).toBe('mp3 video thumbnail subtitles link separator screenshot darkMode cinema pip floating loop help');
  });

  it('moveItem：超出範圍時夾在兩端；from 不存在時不變', () => {
    const d = defaultLayout();
    expect(moveItem(d, 0, 99).items.at(-1)!.id).toBe('video');
    expect(moveItem(d, 3, -5).items[0]!.id).toBe('subtitles');
    expect(moveItem(d, 99, 0)).toBe(d);
  });

  it('stepItem：左右移一格，分隔點也可以移動；到邊界時不變', () => {
    const d = defaultLayout();
    expect(ids(stepItem(d, 'link', 1).items).startsWith('video mp3 thumbnail subtitles screenshot separator link')).toBe(true);
    expect(ids(stepItem(d, SEPARATOR, -1).items).startsWith('video mp3 thumbnail subtitles screenshot separator link')).toBe(true);
    expect(stepItem(d, 'video', -1).items[0]!.id).toBe('video');
    expect(stepItem(d, 'help', 1).items.at(-1)!.id).toBe('help');
  });

  it('toggleVisible：切換顯示，分隔點不受影響', () => {
    const d = defaultLayout();
    const hidden = toggleVisible(d, 'loop');
    expect(splitLayout(hidden).hidden).toEqual(['loop']);
    expect(splitLayout(toggleVisible(hidden, 'loop')).hidden).toEqual([]);
    expect(toggleVisible(d, SEPARATOR)).toBe(d);
    expect(isDefaultLayout(hidden)).toBe(false);
  });

  it('dropIndex：依其他項目的中心點決定插入位置', () => {
    const centers = [10, 30, 50];
    expect(dropIndex(centers, 0)).toBe(0);
    expect(dropIndex(centers, 20)).toBe(1);
    expect(dropIndex(centers, 49)).toBe(2);
    expect(dropIndex(centers, 100)).toBe(3);
  });
});

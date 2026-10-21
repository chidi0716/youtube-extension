import { describe, expect, it } from 'vitest';
import { initialPanelState, panelReducer, type PanelAction, type PanelState } from './panel-state';

const run = (actions: PanelAction[], start: PanelState = initialPanelState()) => actions.reduce(panelReducer, start);

describe('panelReducer', () => {
  it('點按鈕展開，再點一次收起並把焦點還給按鈕（FR-12、FR-19）', () => {
    const opened = run([{ type: 'toggle', id: 'video' }]);
    expect(opened).toEqual({ openId: 'video', pinned: false, restoreFocusTo: null });
    expect(run([{ type: 'toggle', id: 'video' }], opened)).toEqual({
      openId: null,
      pinned: false,
      restoreFocusTo: 'video',
    });
  });

  it('同一時間只有一個面板（FR-10）', () => {
    expect(run([{ type: 'toggle', id: 'video' }, { type: 'toggle', id: 'mp3' }])).toMatchObject({ openId: 'mp3' });
  });

  it('展開另一個面板時，已釘選的面板也會收起，新面板不帶釘選', () => {
    const s = run([{ type: 'toggle', id: 'video' }, { type: 'pin' }, { type: 'toggle', id: 'loop' }]);
    expect(s).toEqual({ openId: 'loop', pinned: false, restoreFocusTo: null });
  });

  it('Esc 收起並還焦點；點外面收起但不搶焦點（FR-12）', () => {
    const opened = run([{ type: 'toggle', id: 'help' }]);
    expect(run([{ type: 'escape' }], opened)).toEqual({ openId: null, pinned: false, restoreFocusTo: 'help' });
    expect(run([{ type: 'outside' }], opened)).toEqual({ openId: null, pinned: false, restoreFocusTo: null });
  });

  it('釘選後 Esc、點外面都不收起（FR-13）', () => {
    const pinned = run([{ type: 'toggle', id: 'mp3' }, { type: 'pin' }]);
    expect(pinned.pinned).toBe(true);
    expect(run([{ type: 'escape' }], pinned)).toBe(pinned);
    expect(run([{ type: 'outside' }], pinned)).toBe(pinned);
  });

  it('釘選後再點按鈕或按取消釘選才收起（FR-13）', () => {
    const pinned = run([{ type: 'toggle', id: 'mp3' }, { type: 'pin' }]);
    expect(run([{ type: 'toggle', id: 'mp3' }], pinned)).toMatchObject({ openId: null, restoreFocusTo: 'mp3' });
    expect(run([{ type: 'unpin' }], pinned)).toMatchObject({ openId: null, pinned: false, restoreFocusTo: 'mp3' });
  });

  it('換頁時釘選的面板維持展開，未釘選的收起（FR-13）', () => {
    const pinned = run([{ type: 'toggle', id: 'mp3' }, { type: 'pin' }]);
    expect(run([{ type: 'navigate' }], pinned)).toBe(pinned);
    expect(run([{ type: 'toggle', id: 'mp3' }, { type: 'navigate' }])).toMatchObject({ openId: null });
  });

  it('沒有展開的面板時，其他動作不改變狀態', () => {
    const s = initialPanelState();
    for (const type of ['escape', 'outside', 'pin', 'unpin', 'navigate', 'focusRestored'] as const) {
      expect(panelReducer(s, { type })).toBe(s);
    }
  });

  it('focusRestored 清除待還焦點', () => {
    const closed = run([{ type: 'toggle', id: 'video' }, { type: 'escape' }]);
    expect(run([{ type: 'focusRestored' }], closed).restoreFocusTo).toBeNull();
  });
});

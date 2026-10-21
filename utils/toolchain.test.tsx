// 確認 T01 建好的工具鏈可用：TSX 由 Preact 轉換、Material Symbols 可用 ?raw 匯入。
import { describe, expect, it } from 'vitest';
import { options } from 'preact';
import closeIcon from '@material-symbols/svg-400/outlined/close.svg?raw';

describe('toolchain', () => {
  it('TSX 編譯成 Preact 的 VNode', () => {
    let seen: unknown;
    const prev = options.vnode;
    options.vnode = (vnode) => {
      seen = vnode;
      prev?.(vnode);
    };
    try {
      const vnode = <span class="x">hi</span>;
      expect(vnode.type).toBe('span');
      expect(vnode.props).toMatchObject({ class: 'x', children: 'hi' });
      expect(seen).toBe(vnode);
    } finally {
      options.vnode = prev;
    }
  });

  it('Material Symbols 圖示以 SVG 字串匯入', () => {
    expect(closeIcon.trimStart().startsWith('<svg')).toBe(true);
  });
});

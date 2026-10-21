import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store';

describe('createStore', () => {
  it('值改變時通知所有監聽者，相同的值不通知', () => {
    const store = createStore(1);
    const a = vi.fn();
    const off = store.subscribe(a);
    store.set(2);
    store.set((v) => v + 1);
    store.set(3);
    expect(store.get()).toBe(3);
    expect(a).toHaveBeenCalledTimes(2);
    off();
    store.set(4);
    expect(a).toHaveBeenCalledTimes(2);
  });
});

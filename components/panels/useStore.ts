import { useEffect, useState } from 'preact/hooks';
import type { Store } from '@/features/viewing/store';

/** 在元件中讀取功能模組的狀態，狀態改變時重新繪製。 */
export function useStore<T>(store: Pick<Store<T>, 'get' | 'subscribe'>): T {
  const [value, setValue] = useState(() => store.get());
  useEffect(() => {
    setValue(store.get());
    return store.subscribe(() => setValue(store.get()));
  }, [store]);
  return value;
}

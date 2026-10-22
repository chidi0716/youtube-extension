// Preact hook：介面語言改變時重新繪製（只更新文字，不重新掛載，007 NFR-1）。
// 放在 components/，讓背景腳本使用 utils/i18n.ts 時不會載入 Preact。
import { useEffect, useState } from 'preact/hooks';
import { currentLocale, onLocaleChange, type UiLocale } from '@/utils/i18n';

export function useLocale(): UiLocale {
  const [locale, setLocale] = useState(currentLocale());
  useEffect(() => {
    setLocale(currentLocale());
    return onLocaleChange(setLocale);
  }, []);
  return locale;
}

// CSS 開關機制的樣式（plan 3.7.2：所有相關樣式放在同一個樣式檔）。
// 每條規則都以 <html> 上的 class 開頭，選擇器來自 utils/youtube/dom.ts（constitution 第 7 點）。
import { SELECTORS } from '@/utils/youtube/dom';

const STYLE_ID = 'yte-tidy-styles';

export const TIDY_CSS = `
/* 003 FR-64 隱藏留言 */
html.yte-hide-comments ${SELECTORS.comments} {
  display: none !important;
}
`;

/**
 * 在頁面加入一次樣式（重複呼叫沒有作用）。在 document_start 執行時 <head> 可能還不存在，
 * 這時直接放在 <html> 底下。
 */
export function ensureTidyStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = TIDY_CSS;
  (doc.head ?? doc.documentElement).append(style);
}

// 觀看輔助功能加在 YouTube 頁面上的樣式（constitution 第 6 點：只用 yte- 前綴的 class，
// 不改 YouTube 原本的屬性）。選擇器來自 utils/youtube/dom.ts。

const STYLE_ID = 'yte-page-styles';

export const PAGE_CSS = `
/* 劇院模式（003 FR-20） */
.yte-cinema-overlay {
  position: fixed;
  inset: 0;
  z-index: 2200;
  background: rgba(0, 0, 0, 0.9);
  cursor: pointer;
}
.yte-cinema-raised {
  z-index: 2201 !important;
}
.yte-cinema-positioned {
  position: relative !important;
}
`;

/** 在頁面加入一次共用樣式（重複呼叫沒有作用）。 */
export function ensurePageStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PAGE_CSS;
  (doc.head ?? doc.documentElement).append(style);
}

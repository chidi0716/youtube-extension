// 介面文字一律來自 public/_locales（constitution 第 8 點），由瀏覽器依語言自動選擇。

/** public/_locales/en/messages.json 中定義的訊息名稱（由 WXT 產生的型別推得）。 */
export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

/** 取得目前語言的介面文字；找不到時回傳名稱本身，避免畫面出現空白。 */
export function t(key: MessageKey, substitutions?: string | string[]): string {
  return browser.i18n.getMessage(key, substitutions) || key;
}

/** 把擴充功能頁面（彈出視窗、設定頁）中帶 data-i18n 的元素換成對應的文字。 */
export function applyI18n(root: ParentNode): void {
  if (root instanceof Document) root.documentElement.lang = browser.i18n.getUILanguage();
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n as MessageKey);
  }
}

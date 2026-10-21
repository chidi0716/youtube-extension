// 介面文字一律來自 public/_locales（constitution 第 8 點），由瀏覽器依語言自動選擇。

/** public/_locales/en/messages.json 中定義的訊息名稱（由 WXT 產生的型別推得）。 */
export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

/** 取得目前語言的介面文字；找不到時回傳名稱本身，避免畫面出現空白。 */
export function t(key: MessageKey, substitutions?: string | string[]): string {
  return browser.i18n.getMessage(key, substitutions) || key;
}

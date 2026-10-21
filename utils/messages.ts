// 內容腳本 → 背景腳本的訊息型別（plan 3.1）。背景腳本只處理通過驗證的訊息。

export type ContentMessage =
  /** 開啟擴充功能的設定頁（001 FR-17：說明面板中的連結）。 */
  { type: 'openOptions' };

export function isContentMessage(value: unknown): value is ContentMessage {
  if (!value || typeof value !== 'object') return false;
  const { type } = value as { type?: unknown };
  return type === 'openOptions';
}

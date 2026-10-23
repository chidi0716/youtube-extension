// 把要以 `irm … | iex` 執行的 PowerShell 腳本轉成純 ASCII（scripts/release.mjs 使用）。
//
// Windows PowerShell 5.1 的 `irm` 在伺服器沒有標明編碼時以 Latin-1 解碼，UTF-8 的中文與 BOM 會變成
// 亂碼甚至語法錯誤。因此發佈的 .ps1 必須是純 ASCII：移除 BOM，並把 Z '…' 中的非 ASCII 字元改成
// \uXXXX（腳本中的 Z 函式以 [regex]::Unescape 還原）。其他位置出現非 ASCII 字元時丟出錯誤。
//
// 用法：node scripts/ps1-ascii.mjs <輸入> <輸出>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function toAsciiPowerShell(text, src = 'script') {
  text = text.replace(/^﻿/, '');
  const zString = /Z '([^'\n]*)'/g;
  const bad = text.replace(zString, '').match(/[^\x00-\x7F]/);
  if (bad) throw new Error(`${src}: non-ASCII text outside Z '...': ${JSON.stringify(bad[0])}`);
  return text.replace(zString, (_, s) => {
    if (s.includes('\\')) throw new Error(`${src}: a backslash inside Z '...' is not supported`);
    const escaped = [...s]
      .map((c) => {
        const code = c.codePointAt(0);
        if (code < 0x80) return c;
        if (code > 0xffff) throw new Error(`${src}: character outside the BMP`);
        return `\\u${code.toString(16).padStart(4, '0')}`;
      })
      .join('');
    return `Z '${escaped}'`;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('usage: node scripts/ps1-ascii.mjs <input.ps1> <output.ps1>');
    process.exit(2);
  }
  writeFileSync(output, toAsciiPowerShell(readFileSync(input, 'utf8'), input));
}

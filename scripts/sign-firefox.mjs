// 以 AMO「不公開（unlisted）」頻道送簽署 Firefox 版（plan 3.3.1）：npm run sign:firefox
//
// - 先執行 `wxt build -b firefox`（由 npm script 負責），再呼叫 web-ext sign。
// - AMO API 金鑰只從環境變數 WEB_EXT_API_KEY、WEB_EXT_API_SECRET 讀取；
//   web-ext 會自動讀取這兩個環境變數，所以金鑰不會出現在命令列或任何檔案中。
// - 簽署後的 .xpi 輸出到 .output/firefox-signed/。
// - 加上 --dry-run 只印出將要執行的指令，不送出。
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, '.output', 'firefox-mv3');
const artifactsDir = join(root, '.output', 'firefox-signed');
const dryRun = process.argv.includes('--dry-run');

const args = [
  'sign',
  '--channel',
  'unlisted',
  '--source-dir',
  sourceDir,
  '--artifacts-dir',
  artifactsDir,
];

const missing = ['WEB_EXT_API_KEY', 'WEB_EXT_API_SECRET'].filter((name) => !process.env[name]);

if (dryRun) {
  console.log(`web-ext ${args.join(' ')}`);
  console.log(
    missing.length
      ? `(missing environment variables: ${missing.join(', ')})`
      : '(WEB_EXT_API_KEY and WEB_EXT_API_SECRET are set)',
  );
  process.exit(0);
}

if (missing.length) {
  console.error(
    `Missing environment variables: ${missing.join(', ')}.\n` +
      'Create an API key at https://addons.mozilla.org/developers/addon/api/key/ and export it, e.g.\n' +
      '  export WEB_EXT_API_KEY=user:12345:67\n' +
      '  export WEB_EXT_API_SECRET=...',
  );
  process.exit(1);
}

if (!existsSync(join(sourceDir, 'manifest.json'))) {
  console.error(`${sourceDir} not found. Run "npm run build:firefox" first.`);
  process.exit(1);
}

// 直接以目前的 Node 執行 web-ext，不經過 shell（Windows 路徑含空白時也安全）。
const webExt = join(root, 'node_modules', 'web-ext', 'bin', 'web-ext.js');
const result = spawnSync(process.execPath, [webExt, ...args], { stdio: 'inherit' });
process.exit(result.status ?? 1);

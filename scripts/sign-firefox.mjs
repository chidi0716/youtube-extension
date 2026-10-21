// 以 AMO「不公開（unlisted）」頻道送簽署 Firefox 版（plan 3.3.1）：npm run sign:firefox
//
// - 先執行 `wxt build -b firefox`（由 npm script 負責），再呼叫 web-ext sign。
// - 建置出的 JavaScript 經過壓縮，所以一併上傳原始碼：以 `git archive` 從目前的 commit
//   產生 .output/firefox-sources.zip（不含 node_modules、.output、host/dist、spikes；
//   前三者本來就不在 git 中），再以 --upload-source-code 附上。審查者的建置方式寫在 README。
// - 原始碼必須與建置結果一致，所以工作目錄有未 commit 的變更時拒絕送出。
// - AMO API 金鑰只從環境變數 WEB_EXT_API_KEY、WEB_EXT_API_SECRET 讀取；
//   web-ext 會自動讀取這兩個環境變數，所以金鑰不會出現在命令列或任何檔案中。
// - 簽署後的 .xpi 輸出到 .output/firefox-signed/。
// - 加上 --dry-run 會產生原始碼壓縮檔並印出將要執行的指令，但不送出。
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, '.output');
const sourceDir = join(outputDir, 'firefox-mv3');
const artifactsDir = join(outputDir, 'firefox-signed');
const sourcesZip = join(outputDir, 'firefox-sources.zip');
const dryRun = process.argv.includes('--dry-run');

/** 原始碼壓縮檔排除的路徑（plan 3.3.1）。 */
const EXCLUDED = ['node_modules', '.output', 'host/dist', 'spikes'];

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

const dirty = git('status', '--porcelain').trim();
if (dirty && !dryRun) {
  console.error('The working tree has uncommitted changes. Commit them first so the uploaded sources match the build:');
  console.error(dirty);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
git(
  'archive',
  '--format=zip',
  `--output=${sourcesZip}`,
  'HEAD',
  '--',
  '.',
  ...EXCLUDED.map((path) => `:(exclude)${path}`),
);

const args = [
  'sign',
  '--channel',
  'unlisted',
  '--source-dir',
  sourceDir,
  '--artifacts-dir',
  artifactsDir,
  '--upload-source-code',
  sourcesZip,
];

const missing = ['WEB_EXT_API_KEY', 'WEB_EXT_API_SECRET'].filter((name) => !process.env[name]);

if (dryRun) {
  console.log(`sources: ${sourcesZip} (git archive of HEAD ${git('rev-parse', '--short', 'HEAD').trim()}, excluding ${EXCLUDED.join(', ')})`);
  if (dirty) console.log('(warning: the working tree has uncommitted changes; a real run would stop here)');
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

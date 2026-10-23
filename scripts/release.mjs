// 產生 GitHub Release 的所有檔案（plan 4.10、008 FR-50）。
//
//   npm run release:dry          在本機完成發佈流程的第 1、3、4、5 步（測試、建置小幫手、產生並以
//                                臨時測試金鑰簽署 components.json、產生 updates.json），
//                                不需要任何 Secret 與網路；Firefox 版不送簽署。
//   node scripts/release.mjs --tag vX.Y.Z
//                                GitHub Actions 使用（.github/workflows/release.yml）：以 Secret
//                                RELEASE_SIGNING_KEY 簽署、lock 檔與官方檢查碼及實際下載的檔案比對、
//                                Firefox 版以 web-ext sign 送 Mozilla 簽署（WEB_EXT_API_KEY／SECRET）。
//
// 輸出：release/dist/upload/（要附加到 Release 的檔案）與 release/dist/release-notes.md。
// 選項：--skip-tests（GitHub Actions 已在前一步執行測試）。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { toAsciiPowerShell } from './ps1-ascii.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hostDir = join(root, 'host');
const distDir = join(root, 'release', 'dist');
const uploadDir = join(distDir, 'upload');
const toolsDir = join(distDir, '.tools');

const REPO = 'chidi0716/youtube-extension';
const GECKO_ID = 'youtube-extension@chidi0716';

// ---- 參數 ----
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const skipTests = argv.includes('--skip-tests');
const tagIndex = argv.indexOf('--tag');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tag = tagIndex >= 0 ? argv[tagIndex + 1] : `v${version}`;
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) fail(`package.json version ${version} is not x.y.z`);
if (tag !== `v${version}`) fail(`tag ${tag} does not match package.json version ${version} (expected v${version})`);
if (!dry && !process.env.RELEASE_SIGNING_KEY) fail('RELEASE_SIGNING_KEY is not set (use --dry for a local dry run)');
const prerelease = version.includes('-');

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function step(title) {
  console.log(`\n=== ${title}`);
}

const isWindows = process.platform === 'win32';
function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  return execFileSync(cmd, args, {
    cwd: root,
    stdio: opts.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    shell: isWindows && (cmd === 'npm' || cmd === 'npx'),
    ...opts,
    env: { ...process.env, GOTOOLCHAIN: 'local', ...(opts.env ?? {}) },
  });
}

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

// ---- 準備 ----
rmSync(distDir, { recursive: true, force: true });
mkdirSync(uploadDir, { recursive: true });
mkdirSync(toolsDir, { recursive: true });

// 第 1 步：測試
if (!skipTests) {
  step('1. tests');
  run('npm', ['test']);
  run('npm', ['run', 'compile']);
  run('go', ['test', './...'], { cwd: hostDir });
}

const yteRelease = join(toolsDir, isWindows ? 'yte-release.exe' : 'yte-release');
run('go', ['build', '-o', yteRelease, './cmd/yte-release'], { cwd: hostDir });
const lockPath = join(root, 'release', 'components.lock.json');

// 簽章金鑰：正式發佈使用 Secret，並確認與小幫手內建的公鑰相符；試跑時臨時產生一組（用完即刪）。
step('2. signing key');
let keyArgs;
let pubkey = '';
const dryKey = join(toolsDir, 'dry-run.key');
if (dry) {
  pubkey = run(yteRelease, ['keygen', '-out', dryKey], { capture: true }).trim();
  keyArgs = ['-key-file', dryKey];
  console.log(`temporary public key for this dry run: ${pubkey}`);
} else {
  run(yteRelease, ['check-key', '-key-env', 'RELEASE_SIGNING_KEY']);
  keyArgs = ['-key-env', 'RELEASE_SIGNING_KEY'];
}

try {
  // lock 檔：正式發佈時下載每個檔案，與 lock 記錄的 SHA256 及官方檢查碼比對。
  step('3. third-party components (release/components.lock.json)');
  run(yteRelease, ['lock-check', '-lock', lockPath, ...(dry ? [] : ['-download'])]);
  if (dry) console.log('(dry run: not comparing with the official checksum files; the release workflow does)');

  // 第 3 步：三種小幫手與手動安裝的資料夾
  step('4. helper builds');
  run('node', [join(hostDir, 'build.mjs')], { env: dry ? { YTE_DRY_RUN_PUBKEY: pubkey } : { YTE_DRY_RUN_PUBKEY: '' } });
  const hostDist = join(hostDir, 'dist');
  for (const name of ['yte-host-darwin-arm64', 'yte-host-darwin-amd64', 'yte-host-windows-amd64.exe']) {
    copyFileSync(join(hostDist, name), join(uploadDir, name));
    chmodSync(join(uploadDir, name), 0o755);
  }
  for (const pkg of ['youtube-extension-host-macos', 'youtube-extension-host-windows']) {
    run(yteRelease, ['zip', '-dir', join(hostDist, pkg), '-out', join(uploadDir, `${pkg}.zip`)]);
  }
  if (dry) {
    // 試跑的小幫手信任的是用完即刪的測試公鑰，不留在 host/dist 以免被誤用。
    rmSync(hostDist, { recursive: true, force: true });
    console.log('(dry run: removed host/dist; run "npm run build:host" for normal helper builds)');
  }

  // 第 4 步：components.json 與簽章
  step('5. components.json');
  const manifestPath = join(uploadDir, 'components.json');
  const sigPath = join(uploadDir, 'components.json.sig');
  run(yteRelease, ['manifest', '-lock', lockPath, '-version', version, '-tag', tag, '-helpers', uploadDir, '-out', manifestPath]);
  run(yteRelease, ['sign', ...keyArgs, '-in', manifestPath, '-out', sigPath]);
  run(yteRelease, ['verify', '-in', manifestPath, '-sig', sigPath, ...(dry ? ['-pubkey', pubkey] : [])]);

  // 引導腳本與移除腳本
  step('6. install and uninstall scripts');
  writeScript('install/bootstrap/install.sh', 'install.sh');
  writeScript('install/bootstrap/install.ps1', 'install.ps1');
  writeScript('install/macos/uninstall.sh', 'uninstall.sh');
  writeScript('install/windows/uninstall.ps1', 'uninstall.ps1');

  // 擴充功能
  step('7. extension packages');
  run('npm', ['run', 'zip']);
  copyFileSync(findOutput(`-${version}-chrome.zip`), join(uploadDir, `youtube-extension-${version}-chrome.zip`));
  const xpiName = `youtube-extension-${version}-firefox.xpi`;
  // web-ext lint：自行發佈（manifest 有 update_url），以 --self-hosted 檢查；有錯誤時停止。
  const lintFirefox = () =>
    run('npx', ['web-ext', 'lint', '--self-hosted', '--source-dir', join(root, '.output', 'firefox-mv3')]);
  if (dry) {
    run('npm', ['run', 'zip:firefox']);
    lintFirefox();
    copyFileSync(findOutput(`-${version}-firefox.zip`), join(uploadDir, xpiName));
    console.log('(dry run: the Firefox package is NOT signed by Mozilla)');
  } else if (prerelease) {
    // 預先發行版本不送 Mozilla 簽署：AMO 同一個數字版本只能簽一次（plan 4.10、Q58）。
    run('npm', ['run', 'build:firefox']);
    lintFirefox();
    console.log('(prerelease: the Firefox package is not signed or published)');
  } else {
    run('npm', ['run', 'build:firefox']);
    lintFirefox();
    run('node', [join(root, 'scripts', 'sign-firefox.mjs')]);
    const signedDir = join(root, '.output', 'firefox-signed');
    const xpis = readdirSync(signedDir)
      .filter((f) => f.endsWith('.xpi'))
      .map((f) => join(signedDir, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    if (!xpis.length) fail('web-ext sign did not produce an .xpi');
    copyFileSync(xpis[0], join(uploadDir, xpiName));
  }

  // 第 5 步：Firefox 的更新資訊。版本號使用建置出的 manifest 中的版本（WXT 會把預先發行標記
  // 從 manifest 的 version 去掉），必須與 .xpi 中的版本完全相同。
  step('8. updates.json');
  if (prerelease && !dry) {
    console.log('(prerelease: no updates.json)');
  } else {
    const firefoxManifest = JSON.parse(readFileSync(join(root, '.output', 'firefox-mv3', 'manifest.json'), 'utf8'));
    const gecko = firefoxManifest.browser_specific_settings?.gecko ?? {};
    if (gecko.id !== GECKO_ID || gecko.update_url !== `https://github.com/${REPO}/releases/latest/download/updates.json`) {
      fail('the Firefox manifest does not have the expected gecko id and update_url');
    }
    const updates = {
      addons: {
        [GECKO_ID]: {
          updates: [
            {
              version: firefoxManifest.version,
              update_link: `https://github.com/${REPO}/releases/download/${tag}/${xpiName}`,
              update_hash: `sha256:${sha256(join(uploadDir, xpiName))}`,
              update_info_url: `https://github.com/${REPO}/releases/tag/${tag}`,
              applications: { gecko: { strict_min_version: gecko.strict_min_version } },
            },
          ],
        },
      },
    };
    writeFileSync(join(uploadDir, 'updates.json'), `${JSON.stringify(updates, null, 2)}\n`);
  }

  // Release 說明與 SHA256SUMS
  step('9. release notes and SHA256SUMS');
  const notes = readFileSync(join(root, 'release', 'notes-template.md'), 'utf8')
    .replaceAll('{{version}}', version)
    .replaceAll('{{tag}}', tag);
  if (/\{\{\w+\}\}/.test(notes)) fail('unknown placeholder in release/notes-template.md');
  writeFileSync(join(distDir, 'release-notes.md'), notes);
  const files = readdirSync(uploadDir).filter((f) => f !== 'SHA256SUMS').sort();
  writeFileSync(join(uploadDir, 'SHA256SUMS'), files.map((f) => `${sha256(join(uploadDir, f))}  ${f}\n`).join(''));

  step(dry ? 'dry run finished' : 'release files ready');
  for (const f of readdirSync(uploadDir).sort()) {
    console.log(`  ${f.padEnd(42)} ${statSync(join(uploadDir, f)).size} bytes`);
  }
  console.log(`  release-notes.md (${prerelease ? 'prerelease' : 'release'} ${tag})`);
} finally {
  rmSync(dryKey, { force: true });
}

/** 複製腳本並代入版本標籤；PowerShell 腳本另外轉成 ASCII（scripts/ps1-ascii.mjs）。 */
function writeScript(src, name) {
  let text = readFileSync(join(root, src), 'utf8');
  text = text.replaceAll('@RELEASE_TAG@', tag);
  if (name.endsWith('.ps1')) text = toAsciiPowerShell(text, src);
  if (text.includes('@RELEASE_TAG@')) fail(`${src}: placeholder left`);
  writeFileSync(join(uploadDir, name), text);
  if (name.endsWith('.sh')) chmodSync(join(uploadDir, name), 0o755);
}

function findOutput(suffix) {
  const dir = join(root, '.output');
  const found = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(suffix)) : [];
  if (found.length !== 1) fail(`expected one .output/*${suffix}, found ${found.length}`);
  return join(dir, found[0]);
}

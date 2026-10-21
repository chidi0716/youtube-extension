// 交叉編譯橋接程式（plan 4.8）：npm run build:host
//
// 產出 host/dist/ 下的單一執行檔：
//   yte-host-darwin-arm64、yte-host-darwin-amd64、yte-host-windows-amd64.exe
// 以 Node 撰寫，在 macOS、Windows、Linux 上都能執行；需要已安裝 Go。
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hostDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(hostDir, 'dist');
const { version } = JSON.parse(readFileSync(join(hostDir, '..', 'package.json'), 'utf8'));

const targets = [
  { goos: 'darwin', goarch: 'arm64' },
  { goos: 'darwin', goarch: 'amd64' },
  { goos: 'windows', goarch: 'amd64' },
];

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const { goos, goarch } of targets) {
  const out = join(distDir, `yte-host-${goos}-${goarch}${goos === 'windows' ? '.exe' : ''}`);
  console.log(`building ${goos}/${goarch} -> ${out}`);
  execFileSync(
    'go',
    ['build', '-trimpath', '-ldflags', `-s -w -X main.version=${version}`, '-o', out, './cmd/yte-host'],
    {
      cwd: hostDir,
      stdio: 'inherit',
      env: { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: '0' },
    },
  );
}

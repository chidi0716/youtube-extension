// 把 harness.ts 打包成 IIFE（npx rolldown -c spikes/T06b/rolldown.config.mjs）。
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

export default {
  input: join(here, 'harness.ts'),
  output: { file: join(here, '.cache', 'harness.js'), format: 'iife' },
  resolve: { alias: { '@': root } },
};

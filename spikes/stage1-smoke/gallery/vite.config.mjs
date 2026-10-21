// 建置 T04 控制元件展示頁：npx vite build --config spikes/stage1-smoke/gallery/vite.config.mjs
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('../../..', import.meta.url));

export default defineConfig({
  root,
  base: './',
  resolve: { alias: { '@': repo.replace(/\/$/, '') } },
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  build: { outDir: fileURLToPath(new URL('../.cache/gallery-dist', import.meta.url)), emptyOutDir: true },
});

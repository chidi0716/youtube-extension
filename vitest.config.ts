import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest 會套用 wxt.config.ts 的 Vite 設定（含 Preact JSX）、自動匯入，
// 並以 fake-browser 模擬 browser.* API。
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '.output/**', '.wxt/**', 'spikes/**'],
  },
});

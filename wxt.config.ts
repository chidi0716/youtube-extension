import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  manifest: {
    name: 'YouTube Extension',
    description: 'A browser extension for YouTube',
    permissions: ['storage'],
    browser_specific_settings: {
      gecko: {
        id: 'youtube-extension@example.com',
      },
    },
  },
});

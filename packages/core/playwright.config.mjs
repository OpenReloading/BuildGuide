import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.mjs',
  use: { viewport: { width: 1440, height: 1000 }, acceptDownloads: true },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: 'node tests/serve.mjs 8080', url: 'http://127.0.0.1:8080/example/', reuseExistingServer: false },
});

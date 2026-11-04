import { defineConfig } from '@playwright/test'

// the site built under its real base path (npm run test:browser: build/test/BuildGuide), served by core's test server
export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.mjs',
  outputDir: 'test-results',
  use: { viewport: { width: 1440, height: 1000 }, acceptDownloads: true },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: 'node ../packages/core/tests/serve.mjs 8080 build/test', url: 'http://127.0.0.1:8080/BuildGuide/', reuseExistingServer: false },
})

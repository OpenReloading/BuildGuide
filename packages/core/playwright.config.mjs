import { defineConfig } from '@playwright/test';
import { basename, resolve } from 'node:path';

// BUILDGUIDE_SITE: a built site (folder) whose example/ holds the example guide, tested instead of example/
const site = process.env.BUILDGUIDE_SITE;

// each host writes to its own folder: Playwright empties outputDir at the start of a run
const outputDir = `test-results/${site ? basename(resolve(site)) : 'core'}`;

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.mjs',
  outputDir,
  use: { viewport: { width: 1440, height: 1000 }, acceptDownloads: true },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: site ? `node tests/serve.mjs 8080 ${JSON.stringify(site)}` : 'node tests/serve.mjs 8080', url: `http://127.0.0.1:8080${process.env.BUILDGUIDE_PREFIX ?? ''}/example/`, reuseExistingServer: false },
});

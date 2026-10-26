# Testing your site

A browser test can check that the components on your own pages mounted, drew their boards and show no error text. It uses the stable names below and one completion mark of the board renderer that is not stable (see below).

## What to select

| Selector | What it tells a test |
|---|---|
| `[data-buildguide]` | the element a component fills: one per component on the page |
| `.ag-guide` | set on that element once the component has mounted |
| `.ag-board-canvas[data-ready]` | the drawing area of a board. The renderer loads after the component and sets `data-ready` to `true` when the board is drawn and routed, `error` when it failed |
| `[data-step]`, `[data-wire]`, `[data-conn]`, `[data-connection]` | step buttons, connection rows and board connections: the controls to click |
| `[data-action="export"]` and the other [`data-action` values](reference.md#markup) | the toolbar and progress buttons |
| `[data-complete]` | on `.ag-guide` while every item is ticked |
| `#<board key>=<step>/<no>` | a hash that opens a board at a step and connection: `page.goto('/wiring/#wiring=B/4')` |
| the `storage` key of the guide data | the ticks in `localStorage`, an object of `true` and `false` values |

The full list is [Reference](reference.md). `data-ready` is the only completion signal of a board, but it is not part of the stable surface, and neither is the text of an error message or the markup inside a component. If a release changes one of them the test below fails (it times out waiting for `data-ready`), and you adjust that one line.

An error leaves its text in the element of the component, so one regular expression covers all of them: `Guide data unavailable.` (data missing or not valid), `Unknown guide component` (a view, board or key that the data does not have), `Board renderer unavailable` and `Router unavailable` (a file of the board renderer did not load).

## A smoke test

This test uses [Playwright](https://playwright.dev/docs/intro) Test. It opens each page that holds a component and fails on a page error, a failed request, an HTTP error status, a component that did not mount, a board that is not drawn and any error text. Each test starts with empty browser storage, so no ticks are saved from an earlier run. List your pages in `PAGES`:

```js title="tests/buildguide.spec.mjs"
import { test, expect } from '@playwright/test';

const PAGES = ['/guide/', '/wiring/'];
const ERROR_TEXT = /Guide data unavailable|Unknown guide component|Board renderer unavailable|Router unavailable/;

for (const path of PAGES) {
  test(`${path}: components mount without error`, async ({ page }) => {
    const problems = [];
    page.on('pageerror', (error) => problems.push(`error: ${error.message}`));
    page.on('requestfailed', (request) => problems.push(`failed: ${request.url()}`));
    page.on('response', (response) => { if (response.status() >= 400) problems.push(`${response.status()}: ${response.url()}`); });

    await page.goto(path);
    const roots = await page.locator('[data-buildguide]').all();
    expect(roots.length).toBeGreaterThan(0);
    // a component sets its class and draws its canvas in one step: after this loop every canvas is in the page
    for (const root of roots) await expect(root).toHaveClass(/\bag-guide\b/);
    for (const canvas of await page.locator('.ag-board-canvas').all()) await expect(canvas).toHaveAttribute('data-ready', 'true');
    for (const root of roots) await expect(root).not.toContainText(ERROR_TEXT);
    expect(problems).toEqual([]);
  });
}
```

Point Playwright at a local copy of the built site:

```js title="playwright.config.mjs"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  use: { baseURL: 'http://127.0.0.1:8080' },
  webServer: { command: 'npx http-server site -p 8080 -s', url: 'http://127.0.0.1:8080/' },
});
```

Replace `site` with the folder your generator writes (`site/` for MkDocs, `build/` for Docusaurus) and `http-server` with any static server. Run `npx playwright install chromium` once, then `npx playwright test`.

A `guide` component mounts the shown tab only: to test a board behind a tab, click `[role=tab]` for it first. A site whose pages swap without a reload (Material's `navigation.instant`, Docusaurus) is worth one more test: click a link to a page with a component and run the same checks. The components mount again on each swap: `BuildGuide.scan()` runs on every emission of Material's `document$`, and the Docusaurus component mounts with the page.

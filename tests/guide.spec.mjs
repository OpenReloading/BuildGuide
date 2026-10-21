// Browser checks of the example guide. Every expectation is derived from example/guide.json.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const D = JSON.parse(readFileSync(new URL('../example/guide.json', import.meta.url)));
const ORIGIN = 'http://127.0.0.1:8080', BASE = ORIGIN + '/example/';
const boards = D.pages.filter(p => p.view === 'board');
const label = (b, c, side) => c['l' + side] ?? `${b.parts[c[side].split(':')[0]].name} · ${c[side].slice(c[side].indexOf(':') + 1)}`;
const hashOf = (s, c) => encodeURIComponent(s.id) + (s.connections.length > 1 ? '/' + encodeURIComponent(c.no) : '');

let problems;
test.beforeEach(async ({ page }) => {
  problems = { errors: [], missing: [], external: [] };
  page.on('pageerror', e => problems.errors.push(String(e)));
  page.on('response', r => r.status() >= 400 && problems.missing.push(r.url()));
  page.on('request', r => /^https?:/.test(r.url()) && !r.url().startsWith(ORIGIN) && problems.external.push(r.url()));
  // nothing outside the test server may load: the route only aborts, the listener above reports
  await page.route('**/*', r => r.request().url().startsWith(ORIGIN) || !/^https?:/.test(r.request().url()) ? r.continue() : r.abort());
});
test.afterEach(() => expect(problems).toEqual({ errors: [], missing: [], external: [] }));

const ready = page => expect(page.locator('.ag-board-canvas')).toHaveAttribute('data-ready', 'true');

test('page shell: navigation, notices, brand and introduction', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('.ag-nav a')).toHaveText(D.pages.map(p => p.title));
  await expect(page.locator('.ag-prerelease + .ag-nav + .ag-warning + #ag-content')).toHaveCount(1);
  await expect(page.locator('.ag-prerelease')).toContainText(D.prerelease.text);
  await expect(page.locator('.ag-warning')).toContainText(D.warning.text);
  await expect(page.locator('.ag-wordmark')).toHaveText(D.brand.wordmark.join(''));
  await expect(page.locator('#assembly-guide h1')).toHaveText(D.intro.title);
  await expect(page.locator('.ag-intro h2')).toHaveText(D.intro.sections.map(s => s.title));
  await expect(page.locator('.ag-media-placeholder')).toHaveCount(D.intro.media.length);
  for (const p of D.pages.slice(1)) {
    await page.locator('.ag-nav').getByRole('link', { name: p.title, exact: true }).click();
    await expect(page).toHaveURL(BASE + p.id + '/');
    await page.reload();
    await expect(page.locator('#assembly-guide h1')).toHaveText(p.title);
  }
  await page.goBack();
  await expect(page.locator('#assembly-guide h1')).toHaveText(D.pages.at(-2).title);
});

for (const p of boards) {
  const b = D.boards[p.board], all = b.steps.flatMap(s => s.connections);
  test(`${p.id}: every connection matches the data`, async ({ page }) => {
    for (const s of b.steps) for (const c of s.connections) {
      await page.goto(`${BASE}${p.id}/#${hashOf(s, c)}`); await ready(page);
      await expect(page.locator('.ag-connection-detail')).toContainText(label(b, c, 'a'));
      await expect(page.locator('.ag-connection-detail')).toContainText(label(b, c, 'b'));
      await expect(page.locator('[data-connection]')).toHaveCount((b.scope || 'step') === 'all' ? all.length : s.connections.length);
      const diode = b.colors[c.color].diode ? '; ring at ' + label(b, c, 'a') : '';
      await expect(page.locator(`[data-connection="${c.no}"]`)).toHaveAttribute('aria-label', `${c.no}: ${label(b, c, 'a')} to ${label(b, c, 'b')}${diode}`);
    }
  });
}

test('wiring: scopes, ticks per exact connection, step order into the next page', async ({ page }) => {
  const b = D.boards.wiring, all = b.steps.flatMap(s => s.connections), first = b.steps[0];
  await page.goto(`${BASE}wiring/#${hashOf(first, first.connections[0])}`); await ready(page);
  await page.locator('#ag-wire-scope').selectOption('single'); await ready(page);
  await expect(page.locator('[data-connection]')).toHaveCount(1);
  await page.locator('#ag-wire-scope').selectOption('all'); await ready(page);
  await expect(page.locator('[data-connection]')).toHaveCount(all.length);
  await page.locator('#ag-wire-scope').selectOption('step'); await ready(page);
  await expect(page.locator('[data-action=prev-wire]')).toBeDisabled();
  await page.locator('.ag-verify input').check();
  await expect(page.locator('.ag-wire-row.selected input')).toBeChecked();
  await page.reload();
  await expect(page.locator('.ag-verify input')).toBeChecked();
  await expect(page.locator('.ag-progress')).toHaveText(`1 / ${all.length} checked`);
  await page.locator('[data-action=next-wire]').click();
  await expect(page.locator('.ag-wire-row.selected .ag-wire-number')).toHaveText(first.connections[1].no);
  await expect(page.locator('.ag-verify input')).not.toBeChecked();
  // a stored tick for the same number with other ends stays unchecked
  const c = first.connections[1];
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify({ [value]: true })), [D.storage, `${b.prefix}-${c.no}:${c.a}:SOMEWHERE:1`]);
  await page.reload();
  await expect(page.locator('.ag-verify input')).not.toBeChecked();
  const last = b.steps.at(-1), next = D.boards[b.next].steps[0];
  await page.goto(`${BASE}wiring/#${hashOf(last, last.connections.at(-1))}`);
  await expect(page.locator('[data-action=next-wire]')).toHaveText(`Open ${D.pages.find(p => p.id === b.next).title.toLowerCase()} →`);
  await page.locator('[data-action=next-wire]').click();
  await expect(page).toHaveURL(`${BASE}${b.next}/#${hashOf(next, next.connections[0])}`);
});

test('tubing: all connections listed, last connection ends the guide, keyboard selection', async ({ page }) => {
  const b = D.boards.tubing, all = b.steps.flatMap(s => s.connections);
  await page.goto(BASE + 'tubing/'); await ready(page);
  await expect(page.locator('.ag-wire-row')).toHaveCount(all.length);
  await expect(page.locator('.ag-row-color')).toHaveCount(0);
  await page.locator(`[data-connection="${all[2].no}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${BASE}tubing/#${hashOf(b.steps[2], all[2])}`);
  const last = b.steps.at(-1);
  await page.goto(`${BASE}tubing/#${hashOf(last, last.connections.at(-1))}`); await ready(page);
  await expect(page.locator('[data-action=next-wire]')).toBeDisabled();
});

test('boards: zoom, fullscreen and page scrolling over the canvas', async ({ page }) => {
  for (const p of boards) {
    await page.goto(BASE + p.id + '/'); await ready(page);
    const paper = page.locator('.ag-board-canvas .joint-paper');
    const width = (await paper.boundingBox()).width;
    await page.locator('[data-action=zoom-in]').click();
    expect((await paper.boundingBox()).width).toBeGreaterThan(width);
    await page.locator('[data-action=zoom-fit]').click();
    await page.evaluate(() => scrollTo(0, 0)); await page.locator('.ag-board-canvas').hover();
    const before = await page.evaluate(() => scrollY); await page.mouse.wheel(0, 350);
    await page.waitForFunction(b => scrollY > b, before);
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator('[data-action=fullscreen]').click();
    await expect(page.locator('#assembly-guide')).toHaveClass(/ag-expanded/);
    await page.locator('.ag-steps [data-step="1"]').click(); await ready(page);
    expect(await page.evaluate(() => document.fullscreenElement?.id)).toBe('assembly-guide');
    const nav = await page.locator('.ag-wire-navigation').boundingBox();
    expect(nav.y + nav.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight) + 1);
    await page.locator('[data-action=fullscreen]').click();
    await page.waitForFunction(() => !document.fullscreenElement);
  }
});

test('BOM: ticks, search, row click and CSV export', async ({ page }) => {
  const items = D.bom.items;
  await page.goto(BASE + 'bom/');
  await expect(page.locator('tbody tr:not(.ag-group)')).toHaveCount(items.length);
  await expect(page.locator('tr.ag-group')).toHaveText([...new Set(items.map(i => i.group))]);
  await page.locator('tbody input[type=checkbox]').first().check();
  await page.reload();
  await expect(page.locator('tbody input[type=checkbox]').first()).toBeChecked();
  await page.locator('tbody tr:not(.ag-group)').nth(2).locator('td').nth(2).click();
  await expect(page.locator('.ag-progress')).toHaveText(`2 / ${items.length} checked`);
  await page.locator('#ag-search').fill('valve');
  await expect(page.locator('tbody tr:not(.ag-group)')).toHaveCount(items.filter(i => `${i.part} ${i.spec} ${i.group}`.toLowerCase().includes('valve')).length);
  await page.locator('#ag-search').fill('');
  await expect(page.locator('tbody a', { hasText: D.bom.linkLabel })).toHaveCount(items.filter(i => i.link).length);
  const download = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(D.bom.export);
  const csv = readFileSync(await file.path(), 'utf8').replace(/^\ufeff/, '').split('\r\n');
  expect(csv[0]).toBe(`"Group","Component","Specification","Quantity","${D.bom.linkLabel}"`);
  expect(csv.length).toBe(items.length + 1);
  await page.locator('#ag-search').fill('does-not-exist');
  await expect(page.locator('.ag-empty')).toBeVisible();
});

test('phones: no sideways scrolling, the next action stays on screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const p of D.pages) {
    await page.goto(BASE + (p === D.pages[0] ? '' : p.id + '/'));
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
  }
  for (const p of boards) {
    await page.goto(BASE + p.id + '/'); await ready(page);
    await page.waitForFunction(() => { const r = document.querySelector('.ag-wire-navigation').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  }
});

test('storage blocked: ticks last for the visit', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw Error('blocked'); } }));
  await page.goto(BASE + 'wiring/');
  await expect(page.locator('.ag-footer')).toContainText('Storage unavailable');
  await page.locator('.ag-verify input').check();
  await expect(page.locator('.ag-verify input')).toBeChecked();
});

test('inline data in #guide-data works like data-src', async ({ page }) => {
  await page.route(BASE + 'inline/', r => r.fulfill({ contentType: 'text/html', body:
    `<!doctype html><link rel="stylesheet" href="../../src/buildguide.css"><div id="assembly-guide" data-page="bom" data-site="../"></div>
     <script type="application/json" id="guide-data">${JSON.stringify(D).replace(/</g, '\\u003c')}</script><script src="../../src/buildguide.js" defer></script>` }));
  await page.goto(BASE + 'inline/');
  await expect(page.locator('tbody tr:not(.ag-group)')).toHaveCount(D.bom.items.length);
});

// a page that mounts the given data inline, as a third-party site would
const inlinePage = (page, path, data, view) => page.route(BASE + path, r => r.fulfill({ contentType: 'text/html', body:
  `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="../../src/buildguide.css"><div id="assembly-guide" data-page="${view}" data-site="../"></div>
   <script type="application/json" id="guide-data">${typeof data === 'string' ? data : JSON.stringify(data).replace(/</g, '\\u003c')}</script><script src="../../src/buildguide.js" defer></script>` }));

test('untrusted data: script URLs become #, ids with spaces and slashes reach their step, CSV formulas stay text', async ({ page }) => {
  const d = structuredClone(D), w = d.boards.wiring;
  d.brand.mark = 'x:"><img src=1 onerror=window.hit=1>';
  d.pages[2].path = 'javascript:window.hit=1';
  d.bom.items[0].link = 'javascript:window.hit=1';
  d.bom.items[0].part = '=1+1';
  w.steps[1].id = 'Schritt ü/2';
  await inlinePage(page, 'odd/', d, 'bom');
  await page.goto(BASE + 'odd/');
  await expect(page.locator('.ag-nav a').nth(2)).toHaveAttribute('href', '#');
  await expect(page.locator('tbody a').first()).toHaveAttribute('href', '#');
  expect(await page.evaluate(() => window.hit)).toBeUndefined();
  const download = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  expect(readFileSync(await (await download).path(), 'utf8').split('\r\n')[1]).toContain(`"'=1+1"`);
  await inlinePage(page, 'odd-wiring/', d, 'wiring');
  const s = w.steps[1], c = s.connections[1];
  await page.goto(`${BASE}odd-wiring/#${hashOf(s, c)}`); await ready(page);
  await expect(page.locator('.ag-wire-row.selected .ag-wire-number')).toHaveText(c.no);
});

test('invalid inline data says so', async ({ page }) => {
  await inlinePage(page, 'broken/', '{not json', 'intro');
  await page.goto(BASE + 'broken/');
  await expect(page.locator('#assembly-guide')).toHaveText('Guide data unavailable.');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the page says it needs JavaScript', async ({ page }) => {
    await page.goto(BASE);
    expect(await page.content()).toContain('This guide needs JavaScript.');
  });
});

// Browser checks of the example guide components. Every expectation is derived from example/guide.json.
// The example pages exist in the core example, the MkDocs docs site and the Docusaurus example: /example/{bom,wiring,tubing,all}/.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const D = JSON.parse(readFileSync(new URL('../example/guide.json', import.meta.url)));
const ORIGIN = 'http://127.0.0.1:8080', BASE = ORIGIN + '/example/';
// the core files: src/ here, assets/buildguide/ in a site built with a plugin
const CORE = process.env.BUILDGUIDE_SITE ? '/assets/buildguide/' : '/src/';
const boards = Object.entries(D.boards);
const label = (b, c, side) => c['l' + side] ?? `${b.parts[c[side].split(':')[0]].name} · ${c[side].slice(c[side].indexOf(':') + 1)}`;
const hashOf = (s, c) => encodeURIComponent(s.id) + (s.connections.length > 1 ? '/' + encodeURIComponent(c.no) : '');
const at = (key, s, c) => `${encodeURIComponent(key)}=${hashOf(s, c)}`;
const url = key => `${BASE}${key}/`;
// one component of a page: a board by its steps navigation, the BOM by its table
const boardOf = (page, key) => page.locator('.ag-guide').filter({ has: page.locator(`nav[aria-label="${D.boards[key].title} steps"]`) });
const bomOf = page => page.locator('.ag-guide').filter({ has: page.locator('.ag-bom') });

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

// sets the hash and resolves once the page's hashchange handlers have run (the test's own handler is registered last)
const setHash = (page, hash) => page.evaluate(h => new Promise(done => { addEventListener('hashchange', () => done(), { once: true }); location.hash = h; }), hash);
const ready = scope => expect(scope.locator('.ag-board-canvas')).toHaveAttribute('data-ready', 'true');

for (const [key, b] of boards) {
  const all = b.steps.flatMap(s => s.connections);
  test(`${key}: every connection matches the data`, async ({ page }) => {
    for (const s of b.steps) for (const c of s.connections) {
      await page.goto(`${url(key)}#${at(key, s, c)}`); await ready(page);
      await expect(page.locator('.ag-connection-detail')).toContainText(label(b, c, 'a'));
      await expect(page.locator('.ag-connection-detail')).toContainText(label(b, c, 'b'));
      await expect(page.locator('[data-connection]')).toHaveCount((b.scope || 'step') === 'all' ? all.length : s.connections.length);
      const diode = b.colors[c.color].diode ? '; ring at ' + label(b, c, 'a') : '';
      await expect(page.locator(`[data-connection="${c.no}"]`)).toHaveAttribute('aria-label', `${c.no}: ${label(b, c, 'a')} to ${label(b, c, 'b')}${diode}`);
    }
  });
}

test('components carry no h1 and no page chrome', async ({ page }) => {
  await page.goto(url('wiring')); await ready(page);
  await expect(page.locator('.ag-guide h1')).toHaveCount(0);
  await expect(page.locator('.ag-top, .ag-nav, .ag-footer, .ag-notice, .ag-intro')).toHaveCount(0);
  // JointJS numbers its own drawing elements: the component's markup has no ids
  await expect(page.locator('.ag-guide [id]:not(.ag-board-canvas *)')).toHaveCount(0);
});

test('wiring: scopes, ticks per exact connection, the last connection ends the board', async ({ page }) => {
  const b = D.boards.wiring, all = b.steps.flatMap(s => s.connections), first = b.steps[0];
  await page.goto(`${url('wiring')}#${at('wiring', first, first.connections[0])}`); await ready(page);
  await page.locator('[data-role=scope]').selectOption('single'); await ready(page);
  await expect(page.locator('[data-connection]')).toHaveCount(1);
  await page.locator('[data-role=scope]').selectOption('all'); await ready(page);
  await expect(page.locator('[data-connection]')).toHaveCount(all.length);
  await page.locator('[data-role=scope]').selectOption('step'); await ready(page);
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
  const last = b.steps.at(-1);
  await page.goto(`${url('wiring')}#${at('wiring', last, last.connections.at(-1))}`); await ready(page);
  await expect(page.locator('[data-action=next-wire]')).toBeDisabled();
  await expect(page.locator('[data-action=next-wire]')).toHaveText('Last connection');
});

test('keyboard: focus stays on the control after a step or connection changes', async ({ page }) => {
  await page.goto(url('wiring')); await ready(page);
  await page.locator('[data-action=next-wire]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-action=next-wire]')).toBeFocused();
  await page.locator('[data-step="1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-step="1"]')).toBeFocused();
  await page.locator('[data-role=scope]').focus();
  await page.locator('[data-role=scope]').selectOption('all');
  await expect(page.locator('[data-role=scope]')).toBeFocused();
});

test('keyboard: focus follows a connection chosen from another step', async ({ page }) => {
  await page.goto(url('tubing')); await ready(page);
  const row = page.locator('.ag-wire-row [data-goto]').first();
  const no = await row.getAttribute('data-conn');
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`.ag-wire-row [data-conn="${no}"][data-wire]`)).toBeFocused();
});

test('colour: --ag-page paints the component', async ({ page }) => {
  await page.goto(url('bom'));
  await page.locator('.ag-guide').evaluate(el => el.style.setProperty('--ag-page', 'rgb(1, 2, 3)'));
  expect(await page.locator('.ag-guide').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(1, 2, 3)');
});

test('host styles do not restyle the components', async ({ page }) => {
  await page.goto(url('wiring')); await ready(page);
  const size = sel => page.locator(sel).first().evaluate(el => getComputedStyle(el).fontSize);
  // the stylesheet's own value: 18px in a component narrower than 760px, else 20px
  const narrow = await page.locator('.ag-guide').evaluate(el => el.clientWidth <= 760);
  expect(await size('.ag-guide .ag-work-heading h2')).toBe(narrow ? '18px' : '20px');
  await page.goto(url('bom'));
  expect(await size('.ag-bom-table th')).toBe('11px');
  expect(await page.locator('.ag-bom-table td').nth(1).evaluate(el => getComputedStyle(el).paddingLeft)).toBe('17px');
});

test('tubing: all connections listed, keyboard selection', async ({ page }) => {
  const b = D.boards.tubing, all = b.steps.flatMap(s => s.connections);
  await page.goto(url('tubing')); await ready(page);
  await expect(page.locator('.ag-wire-row')).toHaveCount(all.length);
  await expect(page.locator('.ag-list-heading h3')).toHaveText(`All ${b.title.toLowerCase()} connections`);
  await expect(page.locator('.ag-row-color')).toHaveCount(0);
  await page.locator(`[data-connection="${all[2].no}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${url('tubing')}#${at('tubing', b.steps[2], all[2])}`);
  await expect(page.locator('.ag-wire-row.selected .ag-wire-number')).toHaveText(all[2].no);
});

test('boards: zoom, fullscreen and page scrolling over the canvas', async ({ page }) => {
  for (const [key] of boards) {
    await page.goto(url(key)); await ready(page);
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
    await expect(page.locator('.ag-guide')).toHaveClass(/ag-expanded/);
    // the step renders on hashchange: until then ready() still sees the old canvas
    await page.locator('.ag-steps [data-step="1"]').click();
    await expect(page.locator('.ag-steps [data-step="1"]')).toHaveAttribute('aria-current', 'step'); await ready(page);
    expect(await page.evaluate(() => document.fullscreenElement?.classList.contains('ag-guide'))).toBe(true);
    const nav = await page.locator('.ag-wire-navigation').boundingBox();
    expect(nav.y + nav.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight) + 1);
    await page.locator('[data-action=fullscreen]').click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await expect(page.locator('.ag-guide')).not.toHaveClass(/ag-expanded/);
    await expect(page.locator('body')).not.toHaveClass(/ag-no-scroll/);
  }
});

test('BOM: ticks, search, row click and CSV export', async ({ page }) => {
  const items = D.bom.items;
  await page.goto(url('bom'));
  await expect(page.locator('tbody tr:not(.ag-group)')).toHaveCount(items.length);
  await expect(page.locator('tr.ag-group')).toHaveText([...new Set(items.map(i => i.group))]);
  await page.locator('tbody input[type=checkbox]').first().check();
  await page.reload();
  await expect(page.locator('tbody input[type=checkbox]').first()).toBeChecked();
  await page.locator('tbody tr:not(.ag-group)').nth(2).locator('td').nth(2).click();
  await expect(page.locator('.ag-progress')).toHaveText(`2 / ${items.length} checked`);
  await page.locator('[data-role=search]').fill('valve');
  await expect(page.locator('tbody tr:not(.ag-group)')).toHaveCount(items.filter(i => `${i.part} ${i.spec ?? ''} ${i.group}`.toLowerCase().includes('valve')).length);
  await page.locator('[data-role=search]').fill('');
  await expect(page.locator('tbody a', { hasText: D.bom.linkLabel })).toHaveCount(items.filter(i => i.link).length);
  const download = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(D.bom.export);
  const csv = readFileSync(await file.path(), 'utf8').replace(/^\ufeff/, '').split('\r\n');
  expect(csv[0]).toBe(`"Group","Component","Specification","Quantity","${D.bom.linkLabel}"`);
  expect(csv.length).toBe(items.length + 1);
  await page.locator('[data-role=search]').fill('does-not-exist');
  await expect(page.locator('.ag-empty')).toBeVisible();
});

test('one page with a BOM and two boards: own hash, ticks, focus, no duplicate ids', async ({ page }) => {
  const [w, t] = [D.boards.wiring, D.boards.tubing];
  await page.goto(url('all'));
  const wiring = boardOf(page, 'wiring'), tubing = boardOf(page, 'tubing'), bom = bomOf(page);
  await expect(page.locator('.ag-guide')).toHaveCount(3);
  await ready(wiring); await ready(tubing);
  const ids = await page.evaluate(() => [...document.querySelectorAll('.ag-guide [id]')].map(e => e.id));
  expect(ids.length).toBe(new Set(ids).size);
  // each board keeps its own position in the hash
  await wiring.locator('[data-step="1"]').click();
  await tubing.locator('[data-step="2"]').click();
  await expect(wiring.locator('.ag-steps [data-step="1"]')).toHaveAttribute('aria-current', 'step');
  await expect(tubing.locator('.ag-steps [data-step="2"]')).toHaveAttribute('aria-current', 'step');
  expect(await page.evaluate(() => decodeURIComponent(location.hash))).toBe(`#wiring=${hashOf(w.steps[1], w.steps[1].connections[0])}&tubing=${hashOf(t.steps[2], t.steps[2].connections[0])}`);
  await wiring.locator('[data-action=next-wire]').click();
  await expect(tubing.locator('.ag-steps [data-step="2"]')).toHaveAttribute('aria-current', 'step');
  await expect(wiring.locator('.ag-wire-row.selected .ag-wire-number')).toHaveText(w.steps[1].connections[1].no);
  expect(await page.evaluate(() => decodeURIComponent(location.hash))).toBe(`#wiring=${hashOf(w.steps[1], w.steps[1].connections[1])}&tubing=${hashOf(t.steps[2], t.steps[2].connections[0])}`);
  // ticks of the three components do not overwrite each other
  await bom.locator('tbody input[type=checkbox]').first().check();
  await wiring.locator('.ag-verify input').check();
  await tubing.locator('.ag-verify input').check();
  await bom.locator('tbody input[type=checkbox]').nth(1).check();
  await expect(bom.locator('.ag-progress')).toHaveText(`2 / ${D.bom.items.length} checked`);
  await expect(wiring.locator('.ag-progress')).toHaveText(`1 / ${w.steps.flatMap(s => s.connections).length} checked`);
  await expect(tubing.locator('.ag-progress')).toHaveText(`1 / ${t.steps.flatMap(s => s.connections).length} checked`);
  await page.reload();
  await expect(bom.locator('.ag-progress')).toHaveText(`2 / ${D.bom.items.length} checked`);
  await expect(wiring.locator('.ag-progress')).toHaveText(`1 / ${w.steps.flatMap(s => s.connections).length} checked`);
  await expect(tubing.locator('.ag-progress')).toHaveText(`1 / ${t.steps.flatMap(s => s.connections).length} checked`);
  // focus stays in the component that was used
  await ready(wiring); await ready(tubing);
  await tubing.locator('[data-action=next-wire]').focus();
  await page.keyboard.press('Enter');
  await expect(tubing.locator('[data-action=next-wire]')).toBeFocused();
  // each component says where its progress is kept
  await expect(page.locator('.ag-status')).toHaveText(Array(3).fill('Progress saved in this browser.'));
});

test('phones: no sideways scrolling, the next action stays on screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['', 'bom/', 'wiring/', 'tubing/', 'all/']) {
    await page.goto(BASE + path);
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
  }
  for (const [key] of boards) {
    await page.goto(url(key)); await ready(page);
    await page.waitForFunction(() => { const r = document.querySelector('.ag-wire-navigation').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  }
});

test('storage blocked: ticks last for the visit, each component says so', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw Error('blocked'); } }));
  await page.goto(url('wiring'));
  await expect(page.locator('.ag-status')).toHaveText('Storage unavailable: progress is not saved.');
  await page.locator('.ag-verify input').check();
  await expect(page.locator('.ag-verify input')).toBeChecked();
  // a second tick keeps the first one in memory
  await page.locator('[data-action=next-wire]').click();
  await page.locator('.ag-verify input').check();
  await expect(page.locator('.ag-progress')).toHaveText(`2 / ${D.boards.wiring.steps.flatMap(s => s.connections).length} checked`);
  await page.locator('[data-action=prev-wire]').click();
  await expect(page.locator('.ag-verify input')).toBeChecked();
});

// a page that mounts the given data inline, as a third-party site would
const inlinePage = (page, path, data, components) => page.route(BASE + path, r => r.fulfill({ contentType: 'text/html', body:
  `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${CORE}buildguide.css">${components}
   <script type="application/json" id="guide-data" data-assets="../assets/">${typeof data === 'string' ? data : JSON.stringify(data).replace(/</g, '\\u003c')}</script><script src="${CORE}buildguide.js" defer></script>` }));

test('inline data in #guide-data works like data-src', async ({ page }) => {
  await inlinePage(page, 'inline/', D, '<div data-buildguide="bom"></div>');
  await page.goto(BASE + 'inline/');
  await expect(page.locator('tbody tr:not(.ag-group)')).toHaveCount(D.bom.items.length);
});

test('untrusted data: script URLs become #, ids with spaces and slashes reach their step, CSV formulas stay text', async ({ page }) => {
  const d = structuredClone(D), w = d.boards.wiring;
  d.bom.items[0].link = 'javascript:window.hit=1';
  d.bom.items[0].image = 'javascript:window.hit=1';
  d.bom.items[0].part = '=1+1';
  w.steps[1].id = 'Schritt ü/2';
  await inlinePage(page, 'odd/', d, '<div data-buildguide="bom"></div><div data-buildguide="board" data-board="wiring"></div>');
  const s = w.steps[1], c = s.connections[1];
  await page.goto(`${BASE}odd/#${at('wiring', s, c)}`); await ready(page);
  await expect(page.locator('tbody a').first()).toHaveAttribute('href', '#');
  expect(await page.evaluate(() => window.hit)).toBeUndefined();
  const download = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  expect(readFileSync(await (await download).path(), 'utf8').split('\r\n')[1]).toContain(`"'=1+1"`);
  await expect(page.locator('.ag-wire-row.selected .ag-wire-number')).toHaveText(c.no);
});

test('a foreign hash fragment keeps the boards where they are and stays in the hash', async ({ page }) => {
  const t = D.boards.tubing;
  await inlinePage(page, 'anchors/', D, '<h2 id="top">Top</h2><div data-buildguide="board" data-board="wiring"></div><div data-buildguide="board" data-board="tubing"></div>');
  await page.goto(BASE + 'anchors/#top');
  const wiring = boardOf(page, 'wiring'), tubing = boardOf(page, 'tubing');
  await ready(wiring); await ready(tubing);
  await wiring.locator('[data-step="1"]').click();
  await expect(wiring.locator('.ag-steps [data-step="1"]')).toHaveAttribute('aria-current', 'step');
  await setHash(page, 'top');
  await expect(wiring.locator('.ag-steps [data-step="1"]')).toHaveAttribute('aria-current', 'step');
  await tubing.locator('[data-step="2"]').click();
  await expect(tubing.locator('.ag-steps [data-step="2"]')).toHaveAttribute('aria-current', 'step');
  // the anchor click replaced the hash: the wiring pair is gone from the URL, the board keeps its step, the anchor stays
  expect(await page.evaluate(() => decodeURIComponent(location.hash))).toBe(`#top&tubing=${hashOf(t.steps[2], t.steps[2].connections[0])}`);
  await expect(wiring.locator('.ag-steps [data-step="1"]')).toHaveAttribute('aria-current', 'step');
});

test('history navigation without a hashchange moves the board', async ({ page }) => {
  const w = D.boards.wiring, s = w.steps[1], c = s.connections[1];
  await page.goto(url('wiring')); await ready(page);
  await page.evaluate(h => { history.pushState(null, '', h); dispatchEvent(new PopStateEvent('popstate')); }, `#${at('wiring', s, c)}`);
  await expect(page.locator('.ag-wire-row.selected .ag-wire-number')).toHaveText(c.no);
});

test('a board without title still renders, named by its key', async ({ page }) => {
  const d = structuredClone(D);
  delete d.boards.wiring.title; delete d.boards.wiring.label;
  await inlinePage(page, 'untitled/', d, '<div data-buildguide="board" data-board="wiring"></div>');
  await page.goto(BASE + 'untitled/'); await ready(page);
  await expect(page.locator('nav.ag-steps')).toHaveAttribute('aria-label', 'wiring steps');
  await expect(page.locator('.ag-board-canvas')).toHaveAttribute('aria-label', /^wiring\. /);
});

test('a component without any data source says so', async ({ page }) => {
  await page.route(BASE + 'nodata/', r => r.fulfill({ contentType: 'text/html', body:
    `<!doctype html><meta charset="utf-8"><div data-buildguide="bom"></div><script src="${CORE}buildguide.js" defer></script>` }));
  await page.goto(BASE + 'nodata/');
  await expect(page.locator('[data-buildguide]')).toHaveText('Guide data unavailable.');
});

test('a stale or repeated unmount leaves the current mount alone', async ({ page }) => {
  await inlinePage(page, 'stale/', D, '');
  await page.goto(BASE + 'stale/');
  await page.waitForFunction(() => window.BuildGuide);
  const alive = await page.evaluate(data => {
    const el = document.createElement('div'); document.body.append(el);
    const first = window.BuildGuide.mount(el, data, { view: 'bom' }), second = window.BuildGuide.mount(el, data, { view: 'bom' });
    first();
    const afterStale = el.classList.contains('ag-guide');
    second(); second();
    return [afterStale, el.classList.contains('ag-guide'), el.childElementCount];
  }, D);
  expect(alive).toEqual([true, false, 0]);
});

test('invalid inline data and unknown components say so', async ({ page }) => {
  await inlinePage(page, 'broken/', '{not json', '<div data-buildguide="bom"></div>');
  await page.goto(BASE + 'broken/');
  await expect(page.locator('[data-buildguide]')).toHaveText('Guide data unavailable.');
  await inlinePage(page, 'unknown/', D, '<div data-buildguide="board" data-board="nowhere"></div><div data-buildguide="intro"></div><div data-buildguide="board" data-board="constructor"></div><div data-buildguide="board" data-board="__proto__"></div>');
  await page.goto(BASE + 'unknown/');
  await expect(page.locator('[data-buildguide]')).toHaveText(['Unknown guide component: board nowhere.', 'Unknown guide component: intro.', 'Unknown guide component: board constructor.', 'Unknown guide component: board __proto__.']);
});

test('unmounting removes every listener and the markup, mounting again works', async ({ page }) => {
  // window and document listeners added after the marker and not removed yet
  await page.addInitScript(() => {
    const live = [], add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    window.__live = live;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if ((this === window || this === document) && window.__mark) live.push([this, type, fn]);
      return add.call(this, type, fn, opts);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opts) {
      const i = live.findIndex(l => l[0] === this && l[1] === type && l[2] === fn);
      if (i >= 0) live.splice(i, 1);
      return remove.call(this, type, fn, opts);
    };
  });
  await inlinePage(page, 'remount/', D, '<div id="host"></div>');
  await page.goto(BASE + 'remount/');
  await page.waitForFunction(() => window.BuildGuide);
  await page.evaluate(() => { window.__mark = true; });
  for (let round = 0; round < 3; round++) {
    await page.evaluate(data => {
      window.__stops = [];
      const host = document.getElementById('host');
      host.replaceChildren(...['bom', 'wiring', 'tubing'].map(() => document.createElement('div')));
      [...host.children].forEach((el, i) => { window.__stops.push(window.BuildGuide.mount(el, data, i ? { view: 'board', board: ['', 'wiring', 'tubing'][i] } : { view: 'bom' })); });
    }, D);
    await expect(page.locator('.ag-guide')).toHaveCount(3);
    await ready(page.locator('.ag-guide').nth(1));
    expect(await page.evaluate(() => window.__live.length)).toBeGreaterThan(0);
    await page.evaluate(() => { for (const stop of window.__stops) stop(); });
    expect(await page.evaluate(() => window.__live.length)).toBe(0);
    await expect(page.locator('.ag-guide')).toHaveCount(0);
    expect(await page.evaluate(() => document.getElementById('host').textContent)).toBe('');
  }
  // a hash change after unmounting renders nothing
  await setHash(page, 'wiring=B');
  await expect(page.locator('.ag-guide')).toHaveCount(0);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('a component says it needs JavaScript', async ({ page }) => {
    await page.goto(url('bom'));
    expect(await page.content()).toContain('This guide needs JavaScript.');
  });
});

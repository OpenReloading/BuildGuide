// Browser checks of the example guide components. Every expectation is derived from example/guide.json.
// The example pages exist in the core example, the MkDocs docs site and the Docusaurus example: /example/{bom,wiring,tubing,all,guide}/.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const D = JSON.parse(readFileSync(new URL('../example/guide.json', import.meta.url)));
// BUILDGUIDE_PREFIX: the path the tested site lives under, e.g. /develop for the Pages preview
const PREFIX = process.env.BUILDGUIDE_PREFIX ?? '';
const ORIGIN = 'http://127.0.0.1:8080', BASE = `${ORIGIN}${PREFIX}/example/`;
// the core files: src/ here, assets/buildguide/ in a site built with a plugin
const CORE = process.env.BUILDGUIDE_SITE ? `${PREFIX}/assets/buildguide/` : '/src/';
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

// every example page: components only, so the audit covers .ag-guide and not the host's own chrome
const PAGES = ['bom', 'wiring', 'tubing', 'all', 'guide'];
const settled = async page => { for (const canvas of await page.locator('.ag-board-canvas').all()) await expect(canvas).toHaveAttribute('data-ready', 'true'); };

// every box ticked, one at a time: a tick re-renders the component
const tickAll = guide => guide.evaluate(el => { for (let i = 0; i < 200; i++) { const box = el.querySelector('[data-check]:not(:checked)'); if (!box) break; box.click(); } });

for (const key of PAGES) {
  for (const scheme of ['light', 'dark']) for (const ticked of [false, true]) {
    test(`${key}: no accessibility violations in the components (WCAG 2.2 AA), ${scheme}${ticked ? ', items ticked' : ''}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(url(key)); await settled(page);
      const found = [];
      // one component at a time, scrolled to the top of the viewport: the sticky navigation of a board covers the part of the page below it
      for (const guide of await page.locator('.ag-guide').all()) {
        if (ticked) await tickAll(guide);
        await guide.evaluate(el => { el.scrollIntoView({ block: 'start' }); el.setAttribute('data-axe', ''); });
        const { violations } = await new AxeBuilder({ page }).include('[data-axe]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        found.push(...violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`));
        await guide.evaluate(el => el.removeAttribute('data-axe'));
      }
      expect(found).toEqual([]);
    });
  }
}

// computed colours of a done row, measured: text 4.5:1 on the row (3:1 for the check mark), nothing translucent. In forced colours the system picks the colours.
const luminance = rgb => rgb.match(/[\d.]+/g).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
for (const [name, media] of [['light', { colorScheme: 'light' }], ['dark', { colorScheme: 'dark' }], ['forced colours', { forcedColors: 'active' }]]) {
  test(`a done row stays legible: BOM and wire rows, ${name}`, async ({ page }) => {
    await page.emulateMedia(media);
    const measure = (row, text) => row.evaluate((tr, sel) => {
      const behind = el => { for (; el; el = el.parentElement) { const bg = getComputedStyle(el).backgroundColor; if (!/rgba?\(.*, 0\)$/.test(bg) && bg !== 'transparent') return bg; } return 'rgb(255, 255, 255)'; };
      const el = tr.querySelector(sel), mark = getComputedStyle(el, '::before');
      return { color: getComputedStyle(el).color, bg: behind(el), opacity: getComputedStyle(el.closest('td,button')).opacity, mark: mark.content, markColor: mark.color };
    }, text);
    const check = async (row, text) => {
      const m = await measure(row, text);
      expect(m.opacity).toBe('1');
      expect(m.mark).not.toBe('none');
      expect(contrast(m.color, m.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(m.markColor, m.bg)).toBeGreaterThanOrEqual(3);
    };
    await page.goto(url('bom')); await settled(page);
    await page.locator('tbody input[type=checkbox]').first().check();
    await check(page.locator('tbody tr.is-done').first(), 'strong');
    await page.goto(url('wiring')); await settled(page);
    await page.locator('.ag-verify input').check();
    await check(page.locator('.ag-wire-row.is-done').first(), '.ag-wire-number');
  });
}

// forced colours: the markers of the selected row, the done row and the current step are borders and outlines, measured on the computed styles:
// non-zero width, 3:1 against what is behind them (WCAG 1.4.11), text 4.5:1. Without forced colours the same elements keep their look.
test('selected, done and current are visible in forced colours', async ({ page }) => {
  const measure = (el, props) => el.evaluate((node, names) => {
    const behind = e => { for (; e; e = e.parentElement) { const bg = getComputedStyle(e).backgroundColor; if (!/rgba?\(.*, 0\)$/.test(bg) && bg !== 'transparent') return bg; } return 'rgb(255, 255, 255)'; };
    const style = getComputedStyle(node);
    return { bg: behind(node), color: style.color, ...Object.fromEntries(names.map(n => [n, style[n]])) };
  }, props);
  const MARKERS = ['outlineStyle', 'outlineWidth', 'outlineColor', 'borderInlineStartWidth', 'borderInlineStartColor', 'borderTopWidth', 'borderTopColor', 'boxShadow'];
  const markers = async () => {
    await page.goto(url('wiring')); await settled(page);
    await page.locator('.ag-verify input').check();
    const guide = page.locator('.ag-guide');
    return {
      selected: await measure(guide.locator('.ag-wire-row.selected').first(), MARKERS),
      done: await measure(guide.locator('.ag-wire-row.is-done').first(), MARKERS),
      current: await measure(guide.locator('.ag-steps button[aria-current]').first(), MARKERS),
      other: await measure(guide.locator('.ag-steps button:not([aria-current])').first(), MARKERS),
    };
  };
  await page.emulateMedia({ forcedColors: 'active' });
  const forced = await markers();
  expect(parseFloat(forced.selected.outlineWidth)).toBeGreaterThan(0);
  expect(forced.selected.outlineStyle).not.toBe('none');
  expect(contrast(forced.selected.outlineColor, forced.selected.bg)).toBeGreaterThanOrEqual(3);
  expect(parseFloat(forced.done.borderInlineStartWidth)).toBeGreaterThan(0);
  expect(contrast(forced.done.borderInlineStartColor, forced.done.bg)).toBeGreaterThanOrEqual(3);
  expect(parseFloat(forced.current.borderTopWidth)).toBeGreaterThan(parseFloat(forced.other.borderTopWidth));
  expect(contrast(forced.current.borderTopColor, forced.current.bg)).toBeGreaterThanOrEqual(3);
  for (const m of Object.values(forced)) expect(contrast(m.color, m.bg)).toBeGreaterThanOrEqual(4.5);
  // the border of a done BOM row shifts nothing: the content of its first cell starts where an open row's does
  await page.goto(url('bom')); await settled(page);
  await page.locator('tbody input[type=checkbox]').first().check();
  const offsets = await page.locator('tbody tr:not(.ag-group)').evaluateAll(rows => rows.slice(0, 2).map(tr => tr.firstElementChild.firstElementChild.getBoundingClientRect().left));
  expect(offsets[0]).toBe(offsets[1]);
  await page.emulateMedia({ forcedColors: 'none' });
  const plain = await markers();
  expect(plain.selected.outlineStyle).toBe('none');
  expect(plain.selected.boxShadow).not.toBe('none');
  expect(plain.done.borderInlineStartWidth).toBe('0px');
  expect(plain.current.borderTopWidth).toBe(plain.other.borderTopWidth);
});

test('screenshots of the example pages', async ({ page }, info) => {
  for (const key of PAGES) {
    await page.goto(url(key)); await settled(page);
    await page.screenshot({ path: info.outputPath(`${key}.png`), fullPage: true });
  }
});

test('following links between pages mounts each component once', async ({ page }) => {
  // the hashchange listeners of this library: one per mounted component. A host's own listeners differ by source.
  await page.addInitScript(() => {
    const ours = new Set(), add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    window.__ours = ours;
    EventTarget.prototype.addEventListener = function (type, fn, opts) { if (this === window && type === 'hashchange' && String(fn).includes('readHash')) ours.add(fn); return add.call(this, type, fn, opts); };
    EventTarget.prototype.removeEventListener = function (type, fn, opts) { if (this === window && type === 'hashchange') ours.delete(fn); return remove.call(this, type, fn, opts); };
  });
  const link = name => page.getByRole('link', { name, exact: true }).first();
  const mounted = async count => {
    await expect(page.locator('.ag-guide')).toHaveCount(count);
    await expect.poll(() => page.evaluate(() => window.__ours.size)).toBe(count);
  };
  await page.goto(BASE); await mounted(0);
  await link('BOM').click(); await expect(page.locator('tbody tr:not(.ag-group)')).toHaveCount(D.bom.items.length); await mounted(1);
  await link('Wiring').click(); await ready(page); await mounted(1);
  await page.goBack(); await expect(page.locator('.ag-bom')).toHaveCount(1); await mounted(1);
  await page.goForward(); await ready(page); await mounted(1);
  await link('All components').click(); await ready(page.locator('.ag-guide').nth(1)); await mounted(3);
  await link('Introduction').click(); await mounted(0);
  await link('Wiring').click(); await ready(page); await mounted(1);
  // a hash change moves the board once: the new step renders, and the rendering is not repeated by a second listener
  const w = D.boards.wiring, s = w.steps[1], c = s.connections[1];
  await page.evaluate(() => { window.__renders = 0; new MutationObserver(m => { window.__renders += m.filter(r => r.target.classList?.contains('ag-guide') && r.addedNodes.length).length; }).observe(document.querySelector('.ag-guide'), { childList: true }); });
  await setHash(page, at('wiring', s, c));
  await expect(page.locator('.ag-wire-row.selected .ag-wire-number')).toHaveText(c.no);
  expect(await page.evaluate(() => window.__renders)).toBe(1);
});

test('a step change keeps the page and its components, and the back button returns to the step', async ({ page }) => {
  // Material's instant navigation swaps the page on the first popstate: a step change must not cause one
  await page.goto(url('wiring')); await ready(page);
  await page.evaluate(() => { window.__root = document.querySelector('.ag-guide'); });
  await page.locator('.ag-steps [data-step="1"]').click();
  await expect(page.locator('.ag-steps [data-step="1"]')).toHaveAttribute('aria-current', 'step');
  expect(await page.evaluate(() => window.__root.isConnected && window.__root === document.querySelector('.ag-guide'))).toBe(true);
  await page.locator('.ag-steps [data-step="2"]').click();
  await expect(page.locator('.ag-steps [data-step="2"]')).toHaveAttribute('aria-current', 'step');
  await page.goBack();
  await expect(page.locator('.ag-steps [data-step="1"]')).toHaveAttribute('aria-current', 'step');
  await ready(page);
});

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

for (const [key, b] of boards) {
  test(`${key}: the note of a step shows with that step, above its connection list`, async ({ page }) => {
    expect(b.steps.some(s => s.note)).toBe(true);
    expect(b.steps.some(s => !s.note)).toBe(true);
    await page.goto(url(key)); await ready(page);
    for (const [i, s] of b.steps.entries()) {
      await page.locator(`.ag-steps [data-step="${i}"]`).click();
      await expect(page.locator(`.ag-steps [data-step="${i}"]`)).toHaveAttribute('aria-current', 'step');
      await expect(page.locator('.ag-step-note')).toHaveCount(s.note ? 1 : 0);
      if (s.note) {
        await expect(page.locator('.ag-step-note')).toHaveText(s.note);
        await expect(page.locator('.ag-step-note + .ag-list-heading')).toHaveCount(1);
      }
    }
  });
}

test('a step note is text, not markup', async ({ page }) => {
  const d = structuredClone(D);
  d.boards.wiring.steps[0].note = '<b>Unplug</b> & check <img src=x onerror=window.hit=1>';
  await inlinePage(page, 'note/', d, '<div data-buildguide="board" data-board="wiring"></div>');
  await page.goto(BASE + 'note/'); await ready(page);
  await expect(page.locator('.ag-step-note')).toHaveText(d.boards.wiring.steps[0].note);
  await expect(page.locator('.ag-step-note b, .ag-step-note img')).toHaveCount(0);
  expect(await page.evaluate(() => window.hit)).toBeUndefined();
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
  // Material dims every <small> of its own pages (opacity .75), which would lower the contrast of the component's labels
  const opacity = sel => page.locator(sel).first().evaluate(el => getComputedStyle(el).opacity);
  expect([await opacity('.ag-steps small'), await opacity('.ag-connection-detail small')]).toEqual(['1', '1']);
  await page.goto(url('bom'));
  expect(await size('.ag-bom-table th')).toBe('11px');
  expect(await page.locator('.ag-bom-table td').nth(1).evaluate(el => getComputedStyle(el).paddingLeft)).toBe('17px');
});

// the stylesheet's own colours: --ag-<name>:light-dark(light, dark)
const css = readFileSync(new URL('../src/buildguide.css', import.meta.url), 'utf8');
const rgb = hex => { const full = hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex, n = parseInt(full.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const token = (name, scheme) => rgb(css.match(new RegExp(`--ag-${name}:light-dark\\((#[0-9a-f]+), (#[0-9a-f]+)\\)`))[scheme === 'dark' ? 2 : 1]);
// the signal of the host under test: Material's body attribute, Docusaurus' html attribute, or only the browser preference (core example)
const signal = (page, want) => page.evaluate(scheme => {
  if (document.body.hasAttribute('data-md-color-scheme')) { document.body.setAttribute('data-md-color-scheme', scheme === 'dark' ? 'slate' : 'default'); return 'host'; }
  if (document.documentElement.hasAttribute('data-theme')) { document.documentElement.setAttribute('data-theme', scheme); return 'host'; }
  if (scheme === 'light') document.documentElement.setAttribute('data-ag-scheme', 'light');
  return 'browser';
}, want);

for (const os of ['light', 'dark']) for (const want of ['light', 'dark']) {
  test(`colour scheme: a ${want} host in a browser preferring ${os}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: os });
    await page.goto(url('wiring')); await ready(page);
    const kind = await signal(page, want);
    // a host signal beats the browser preference; the core example has none, so the preference decides unless the page opts out
    const expected = kind === 'host' || want === 'light' ? want : os;
    const style = await page.locator('.ag-guide').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, scheme: getComputedStyle(el).colorScheme,
      filter: getComputedStyle(el.querySelector('.ag-board-canvas > div')).filter, surface: getComputedStyle(el.querySelector('.ag-panel')).backgroundColor }));
    expect(style.background).toBe(token('page', expected));
    expect(style.color).toBe(token('ink', expected));
    expect(style.surface).toBe(token('surface', expected));
    // the browser's own light scheme is 'normal' when no host or rule names one
    expect(style.scheme === 'dark').toBe(expected === 'dark');
    expect(style.filter).toBe(expected === 'dark' ? 'invert(0.9) hue-rotate(180deg)' : 'none');
  });
}

test('colour scheme: a component prints light on a dark host', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(url('wiring')); await ready(page);
  await signal(page, 'dark');
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  expect(await page.locator('.ag-guide').evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).colorScheme])).toEqual(['rgb(255, 255, 255)', 'light']);
});

test('colour scheme: a host sets a token itself in both schemes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(url('bom'));
  await page.locator('.ag-guide').evaluate(el => el.style.setProperty('--ag-page', 'rgb(9, 8, 7)'));
  expect(await page.locator('.ag-guide').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(9, 8, 7)');
});

// the tick keys of every item of a component, in order
const tickKeys = { bom: D.bom.items.map(i => `bom-${i.id}:${i.part}`) };
for (const [key, b] of boards) tickKeys[key] = b.steps.flatMap(s => s.connections.map(c => `${b.prefix || key}-${c.no}:${c.a}:${c.b}`));
const componentOf = (page, key) => key === 'bom' ? bomOf(page) : boardOf(page, key);
// the page of a component, opened on its last item
const openLast = async (page, key) => {
  const b = D.boards[key], s = b?.steps.at(-1);
  await page.goto(key === 'bom' ? url('bom') : `${url(key)}#${at(key, s, s.connections.at(-1))}`);
  if (b) await ready(page);
};

for (const key of Object.keys(tickKeys)) {
  test(`${key}: a progress bar, and the all-done state is announced once`, async ({ page }) => {
    const keys = tickKeys[key], last = keys.at(-1), what = key === 'bom' ? 'parts' : 'connections', n = keys.length;
    // everything but the last item is stored as ticked
    await page.addInitScript(([storage, ticked]) => { if (localStorage.getItem(storage) === null) localStorage.setItem(storage, JSON.stringify(Object.fromEntries(ticked.map(k => [k, true])))); }, [D.storage, keys.slice(0, -1)]);
    await openLast(page, key);
    const component = componentOf(page, key), bar = component.locator('progress'), message = component.locator('.ag-message');
    await expect(bar).toHaveAttribute('value', String(n - 1));
    await expect(bar).toHaveAttribute('max', String(n));
    await expect(bar).toHaveAccessibleName(`${what} checked`);
    await expect(component.locator('.ag-progress')).toHaveText(`${n - 1} / ${n} checked`);
    await expect(component).not.toHaveAttribute('data-complete');
    await component.locator(`[data-check="${last}"]`).first().check();
    await expect(component).toHaveAttribute('data-complete', '');
    await expect(component.locator('.ag-progress')).toHaveText(`All ${what} checked`);
    await expect(bar).toHaveAttribute('value', String(n));
    await expect(message).toHaveText(`All ${what} checked`);
    // a later render of the same state, and a reload of a finished guide, stay silent
    await page.evaluate(storage => dispatchEvent(new StorageEvent('storage', { key: storage })), D.storage);
    await page.waitForTimeout(200);
    await expect(message).toHaveText('');
    await expect(component).toHaveAttribute('data-complete', '');
    await page.reload();
    await page.waitForTimeout(200);
    await expect(componentOf(page, key)).toHaveAttribute('data-complete', '');
    await expect(componentOf(page, key).locator('.ag-message')).toHaveText('');
    // one unticked item ends the state; ticking it again announces again
    await componentOf(page, key).locator(`[data-check="${last}"]`).first().uncheck();
    await expect(componentOf(page, key)).not.toHaveAttribute('data-complete');
    await expect(componentOf(page, key).locator('.ag-progress')).toHaveText(`${n - 1} / ${n} checked`);
    await expect(componentOf(page, key).locator('.ag-message')).toHaveText('');
    await componentOf(page, key).locator(`[data-check="${last}"]`).first().check();
    await expect(componentOf(page, key).locator('.ag-message')).toHaveText(`All ${what} checked`);
  });

  test(`${key}: an item unticked within the announcement delay leaves no stale all-done text`, async ({ page }) => {
    const keys = tickKeys[key], last = keys.at(-1);
    await page.addInitScript(([storage, ticked]) => { if (localStorage.getItem(storage) === null) localStorage.setItem(storage, JSON.stringify(Object.fromEntries(ticked.map(k => [k, true])))); }, [D.storage, keys.slice(0, -1)]);
    await openLast(page, key);
    // both clicks run before the delayed announcement; each render replaces the box, so it is found again
    await componentOf(page, key).evaluate((root, k) => { const box = () => root.querySelector(`[data-check="${CSS.escape(k)}"]`); box().click(); box().click(); }, last);
    await page.waitForTimeout(200);
    await expect(componentOf(page, key)).not.toHaveAttribute('data-complete');
    await expect(componentOf(page, key).locator('.ag-message')).toHaveText('');
  });
}

// the engines paint the fill through their own pseudo-elements, which getComputedStyle does not report: the stylesheet is read
test('the progress fill uses --ag-done in every engine and system colours in forced colours', () => {
  expect(css).toContain('progress::-webkit-progress-value{background:var(--ag-done)}');
  expect(css).toContain('progress::-moz-progress-bar{background:var(--ag-done)}');
  expect(css).toMatch(/forced-colors:active\)\{[\s\S]*progress::-webkit-progress-value\{background:CanvasText\}[\s\S]*progress::-moz-progress-bar\{background:CanvasText\}/);
});

// the bar sits in the head on a phone and stays visible in forced colours
for (const [name, media, scheme] of [['light', { colorScheme: 'light' }, 'light'], ['dark', { colorScheme: 'dark' }, 'dark'], ['forced colours', { forcedColors: 'active' }]]) {
  test(`the progress bar fits the head of a phone, ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia(media);
    for (const key of Object.keys(tickKeys)) {
      await openLast(page, key);
      if (scheme) await signal(page, scheme);
      const m = await componentOf(page, key).locator('progress').evaluate(bar => {
        const r = bar.getBoundingClientRect(), host = bar.closest('.ag-guide').getBoundingClientRect(), style = getComputedStyle(bar);
        return { inside: r.left >= host.left && r.right <= host.right, width: r.width, height: r.height, border: style.borderTopColor, borderWidth: style.borderTopWidth, track: style.backgroundColor, sideways: document.body.scrollWidth > innerWidth };
      });
      expect(m.inside, key).toBe(true);
      expect(m.sideways, key).toBe(false);
      expect(m.width, key).toBeGreaterThan(0);
      expect(m.height, key).toBeGreaterThan(0);
      if (scheme) expect(m.track, key).toBe(token('line', scheme));
      else { expect(parseFloat(m.borderWidth), key).toBeGreaterThan(0); expect(m.border, key).not.toBe(m.track); }
    }
  });
}

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

test('keyboard: focus stays on a connection path after Enter or Space selects it', async ({ page }) => {
  for (const [key, b] of boards) {
    const step = b.steps[0];
    await page.goto(url(key)); await ready(page);
    for (const [pressed, c] of [['Enter', step.connections.at(-1)], ['Space', step.connections[0]]]) {
      const path = page.locator(`[data-connection="${c.no}"]`);
      await path.focus();
      await page.keyboard.press(pressed);
      await ready(page);
      await expect(page.locator('.ag-wire-row.selected .ag-wire-number')).toHaveText(c.no);
      await expect(path).toBeFocused();
    }
  }
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

// progress export, import and reset: the three components of the all page share one stored object
const progressOf = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), D.storage);
const importFile = (scope, content) => scope.locator('[data-role=import-file]').setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)) });
const bomKey = i => `bom-${D.bom.items[i].id}:${D.bom.items[i].part}`;

test('progress tools: nine buttons on the all page, three per component', async ({ page }) => {
  await page.goto(url('all'));
  for (const action of ['export-progress', 'import-progress', 'reset-progress']) await expect(page.locator(`[data-action=${action}]`)).toHaveCount(3);
  await expect(page.locator('.ag-status')).toHaveText(Array(3).fill('Progress saved in this browser.'));
});

test('progress export: downloads <storage>.json with the saved object', async ({ page }) => {
  await page.goto(url('all'));
  await ready(boardOf(page, 'wiring'));
  await bomOf(page).locator('tbody input[type=checkbox]').first().check();
  await boardOf(page, 'wiring').locator('.ag-verify input').check();
  const download = page.waitForEvent('download');
  await boardOf(page, 'tubing').locator('[data-action=export-progress]').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${D.storage}.json`);
  const exported = JSON.parse(readFileSync(await file.path(), 'utf8'));
  expect(exported).toEqual(await progressOf(page));
  expect(Object.keys(exported)).toHaveLength(2);
  expect(Object.values(exported).every(v => v === true)).toBe(true);
});

test('progress import: a valid file replaces the progress of every component', async ({ page }) => {
  const w = D.boards.wiring, c = w.steps[0].connections[0];
  await page.goto(url('all'));
  await ready(boardOf(page, 'wiring'));
  await bomOf(page).locator('tbody input[type=checkbox]').nth(3).check();
  const imported = { [bomKey(0)]: true, [bomKey(1)]: true, [`${w.prefix}-${c.no}:${c.a}:${c.b}`]: true, [bomKey(2)]: false };
  await importFile(boardOf(page, 'tubing'), imported);
  await expect(bomOf(page).locator('.ag-progress')).toHaveText(`2 / ${D.bom.items.length} checked`);
  await expect(boardOf(page, 'wiring').locator('.ag-progress')).toHaveText(`1 / ${w.steps.flatMap(s => s.connections).length} checked`);
  expect(await progressOf(page)).toEqual(imported);
  await page.reload();
  await expect(bomOf(page).locator('.ag-progress')).toHaveText(`2 / ${D.bom.items.length} checked`);
});

test('progress import: anything but an object of true and false is refused', async ({ page }) => {
  await page.goto(url('bom'));
  await bomOf(page).locator('tbody input[type=checkbox]').first().check();
  const before = await progressOf(page);
  for (const bad of ['{not json', '[true]', 'null', '"x"', { a: 'yes' }, { a: 1 }, { a: null }, { a: { b: true } }]) {
    await importFile(page, bad);
    await expect(page.locator('.ag-message')).toHaveText('Not imported: the file is not a progress export.');
    expect(await progressOf(page)).toEqual(before);
    await expect(page.locator('.ag-progress')).toHaveText(`1 / ${D.bom.items.length} checked`);
  }
});

test('progress reset: asks first, then removes the saved progress everywhere', async ({ page }) => {
  await page.goto(url('all'));
  await ready(boardOf(page, 'wiring'));
  await bomOf(page).locator('tbody input[type=checkbox]').first().check();
  await boardOf(page, 'wiring').locator('.ag-verify input').check();
  const asked = [];
  page.once('dialog', d => { asked.push(d.message()); d.dismiss(); });
  await bomOf(page).locator('[data-action=reset-progress]').click();
  await expect.poll(() => asked.length).toBe(1);
  expect(Object.keys(await progressOf(page))).toHaveLength(2);
  await expect(bomOf(page).locator('.ag-progress')).toHaveText(`1 / ${D.bom.items.length} checked`);
  page.once('dialog', d => d.accept());
  await bomOf(page).locator('[data-action=reset-progress]').click();
  await expect(bomOf(page).locator('.ag-progress')).toHaveText(`0 / ${D.bom.items.length} checked`);
  await expect(boardOf(page, 'wiring').locator('.ag-progress')).toHaveText(`0 / ${D.boards.wiring.steps.flatMap(s => s.connections).length} checked`);
  expect(await page.evaluate(key => localStorage.getItem(key), D.storage)).toBeNull();
});

for (const how of ['reset', 'import']) for (const blocked of [false, true]) {
  test(`progress ${how}${blocked ? ' with storage blocked' : ''}: a tick in another component does not bring the old ticks back`, async ({ page }) => {
    if (blocked) await page.addInitScript(key => {
      const real = window.localStorage, no = () => { throw Error('blocked'); };
      Object.defineProperty(window, 'localStorage', { value: { getItem: k => (k === key ? no() : real.getItem(k)), setItem: (k, v) => (k === key ? no() : real.setItem(k, v)), removeItem: k => real.removeItem(k) } });
    }, D.storage);
    await page.goto(url('all'));
    const bom = bomOf(page), wiring = boardOf(page, 'wiring'), tubing = boardOf(page, 'tubing');
    await ready(wiring); await ready(tubing);
    await bom.locator('tbody input[type=checkbox]').nth(0).check();
    await bom.locator('tbody input[type=checkbox]').nth(1).check();
    await wiring.locator('.ag-verify input').check();
    if (how === 'reset') { page.once('dialog', d => d.accept()); await tubing.locator('[data-action=reset-progress]').click(); }
    else await importFile(tubing, { [bomKey(5)]: true });
    const left = how === 'reset' ? 0 : 1;
    await expect(bom.locator('.ag-progress')).toHaveText(`${left} / ${D.bom.items.length} checked`);
    await expect(wiring.locator('.ag-progress')).toHaveText(`0 / ${D.boards.wiring.steps.flatMap(s => s.connections).length} checked`);
    // a tick in a second component writes its own copy: it must not bring back what was reset or replaced
    await tubing.locator('.ag-verify input').check();
    await expect(tubing.locator('.ag-progress')).toHaveText(`1 / ${D.boards.tubing.steps.flatMap(s => s.connections).length} checked`);
    await expect(bom.locator('.ag-progress')).toHaveText(`${left} / ${D.bom.items.length} checked`);
    await expect(wiring.locator('.ag-progress')).toHaveText(`0 / ${D.boards.wiring.steps.flatMap(s => s.connections).length} checked`);
    await wiring.locator('.ag-verify input').check();
    await expect(bom.locator('.ag-progress')).toHaveText(`${left} / ${D.bom.items.length} checked`);
    if (!blocked) expect(Object.keys(await progressOf(page))).toHaveLength(left + 2);
  });
}

test('progress: a tick or a reset in another tab shows up here and is not written back over', async ({ page, context }) => {
  const other = await context.newPage();
  await page.goto(url('bom')); await other.goto(url('bom'));
  const ticks = scope => scope.locator('tbody input[type=checkbox]');
  const counted = n => `${n} / ${D.bom.items.length} checked`;
  await ticks(other.locator('body')).nth(0).check();
  await expect(page.locator('.ag-progress')).toHaveText(counted(1));
  await ticks(page.locator('body')).nth(1).check();
  await expect(other.locator('.ag-progress')).toHaveText(counted(2));
  expect(Object.keys(await progressOf(page))).toEqual([bomKey(0), bomKey(1)]);
  other.once('dialog', d => d.accept());
  await other.locator('[data-action=reset-progress]').click();
  await expect(page.locator('.ag-progress')).toHaveText(counted(0));
  await ticks(page.locator('body')).nth(2).check();
  expect(Object.keys(await progressOf(page))).toEqual([bomKey(2)]);
});

test('print: the BOM has a Print button that calls window.print', async ({ page }) => {
  await page.goto(url('bom'));
  await page.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await page.locator('[data-action=print]').click();
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  await expect(page.locator('.ag-bom-actions [data-action=print]')).toHaveText('Print');
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

// the font size of every drawn text as the reader sees it: font size x drawing scale
const labelSizes = page => page.evaluate(() => [...document.querySelectorAll('.ag-board-canvas svg text')].filter(t => t.textContent.trim())
  .map(t => Number.parseFloat(getComputedStyle(t).fontSize) * t.getScreenCTM().a));

for (const [key] of boards) {
  test(`${key}: phones keep every label at 10 px, Fit shows the whole board`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url(key)); await ready(page);
    expect(Math.min(...await labelSizes(page))).toBeGreaterThanOrEqual(10 - 0.01);
    const canvas = page.locator('.ag-board-canvas'), paper = canvas.locator('.joint-paper');
    expect((await paper.boundingBox()).width).toBeGreaterThan((await canvas.boundingBox()).width);
    // the selected connection is in view, not the empty corner of the drawing
    const selected = (await page.locator('[data-connection] [joint-selector=line]').first().boundingBox()), view = await canvas.boundingBox();
    expect(selected.x + selected.width).toBeGreaterThan(view.x);
    expect(selected.x).toBeLessThan(view.x + view.width);
    // zoom works from the phone size: + enlarges it, - and + again return to it
    const width = async () => Math.round((await paper.boundingBox()).width);
    const start = await width();
    await page.locator('[data-action=zoom-in]').click();
    const larger = await width();
    expect(larger).toBeGreaterThan(start);
    await page.locator('[data-action=zoom-out]').click();
    expect(await width()).toBe(start);
    await page.locator('[data-action=zoom-out]').click();
    expect(await width()).toBeLessThan(start);
    await page.locator('[data-action=zoom-fit]').click();
    expect((await paper.boundingBox()).width).toBeLessThanOrEqual((await canvas.boundingBox()).width + 1);
    await page.locator('[data-action=zoom-in]').click();
    expect((await paper.boundingBox()).width).toBeGreaterThan((await canvas.boundingBox()).width);
  });

  test(`${key}: the board ratio is on the component`, async ({ page }) => {
    await page.goto(url(key)); await ready(page);
    const [w, h] = D.boards[key].size;
    expect(await boardOf(page, key).evaluate(el => getComputedStyle(el).getPropertyValue('--ag-board-ratio').trim())).toBe(`${w} / ${h}`);
    // the documented use: a host sets the canvas height from the ratio
    await page.addStyleTag({ content: '.ag-guide .ag-board-canvas{height:auto;aspect-ratio:var(--ag-board-ratio)}' });
    const canvas = await page.locator('.ag-board-canvas').boundingBox();
    expect(canvas.height).toBeCloseTo(canvas.width * h / w, 0);
  });

  test(`${key}: fullscreen on a phone gives the board half the screen`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url(key)); await ready(page);
    await page.locator('[data-action=fullscreen]').click();
    await expect(page.locator('.ag-guide')).toHaveClass(/ag-expanded/); await ready(page);
    const canvas = await page.locator('.ag-board-canvas').boundingBox();
    expect(canvas.height).toBeGreaterThanOrEqual(844 / 2);
    // the way out stays on screen
    const exit = await page.locator('[data-action=fullscreen]').boundingBox();
    expect(exit.y + exit.height).toBeLessThanOrEqual(844);
  });
}

test('a board mounted in a hidden box keeps its scale and takes its size when shown', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await inlinePage(page, 'hidden/', D, '<div id="box" style="display:none"><div data-buildguide="board" data-board="wiring"></div></div>');
  await page.goto(BASE + 'hidden/');
  await ready(page);
  // no size to fit to: the drawing keeps its own scale instead of collapsing to a point or turning to NaN
  expect(await page.locator('.joint-layers').evaluate(g => new DOMMatrix(g.getAttribute('transform') ?? '').a)).toBeGreaterThan(0.01);
  await page.evaluate(() => { document.getElementById('box').style.display = ''; });
  await expect.poll(async () => Math.min(...await labelSizes(page))).toBeGreaterThanOrEqual(10 - 0.01);
});

test('storage blocked: ticks last for the visit, each component says so', async ({ page }) => {
  // the guide's key is blocked; a host's own use of localStorage (Material's palette) keeps working
  await page.addInitScript(key => {
    const real = window.localStorage, blocked = () => { throw Error('blocked'); };
    Object.defineProperty(window, 'localStorage', { value: { getItem: k => (k === key ? blocked() : real.getItem(k)), setItem: (k, v) => (k === key ? blocked() : real.setItem(k, v)), removeItem: k => real.removeItem(k) } });
  }, D.storage);
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

test('BOM images are decorative: empty alt, the part name sits in the same cell', async ({ page }) => {
  const data = structuredClone(D);
  data.bom.items[0].image = 'part.gif';
  await page.route(`${BASE}assets/part.gif`, r => r.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64') }));
  await inlinePage(page, 'bom-image/', data, '<div data-buildguide="bom"></div>');
  await page.goto(BASE + 'bom-image/');
  const cell = page.locator('.ag-part-cell').filter({ has: page.locator('img') });
  await expect(cell).toHaveCount(1);
  await expect(cell.locator('img')).toHaveAttribute('alt', '');
  await expect(cell).toContainText(data.bom.items[0].part);
});

// the small examples of the docs, one component each: they mount and show what the docs say
const minimal = name => JSON.parse(readFileSync(new URL(`../example/minimal/${name}.json`, import.meta.url)));
test('minimal examples: a BOM, a wiring board and a tubing board each mount from their own small guide', async ({ page }) => {
  const bom = minimal('bom'), wiring = minimal('wiring'), tubing = minimal('tubing');
  await inlinePage(page, 'minimal-bom/', bom, '<div data-buildguide="bom"></div>');
  await page.goto(BASE + 'minimal-bom/');
  await expect(page.locator('tbody tr:not(.ag-group)')).toHaveCount(bom.bom.items.length);
  for (const [name, data] of [['wiring', wiring], ['tubing', tubing]]) {
    await inlinePage(page, `minimal-${name}/`, data, `<div data-buildguide="board" data-board="${name}"></div>`);
    await page.goto(`${BASE}minimal-${name}/`); await ready(page);
    const all = data.boards[name].steps.flatMap(s => s.connections);
    await expect(page.locator('.ag-wire-row')).toHaveCount(all.length);
    await expect(page.locator('.ag-steps [data-step]')).toHaveCount(data.boards[name].steps.length);
  }
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

test('the anchor stays in view when a board pair follows it', async ({ page }) => {
  const w = D.boards.wiring, s = w.steps[1], c = s.connections[1];
  await inlinePage(page, 'scrolled/', D, `<div style="height:3000px"></div><h2 id="top">Top</h2><div data-buildguide="board" data-board="wiring"></div>`);
  await page.goto(`${BASE}scrolled/#top&${at('wiring', s, c)}`);
  await ready(page);
  await expect(page.locator('#top')).toBeInViewport();
  await expect(page.locator('.ag-wire-row.selected .ag-wire-number')).toHaveText(c.no);
});

test('a name-only fragment equal to a board key is an anchor, not a position', async ({ page }) => {
  await inlinePage(page, 'same/', D, '<h2 id="wiring">Wiring</h2><div data-buildguide="board" data-board="wiring"></div>');
  await page.goto(BASE + 'same/');
  const wiring = boardOf(page, 'wiring');
  await ready(wiring);
  await wiring.locator('[data-step="1"]').click();
  await expect(wiring.locator('.ag-steps [data-step="1"]')).toHaveAttribute('aria-current', 'step');
  await setHash(page, 'wiring');
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

test('a pending all-done announcement does not reach a later mount on the same element', async ({ page }) => {
  await inlinePage(page, 'pending/', D, '');
  await page.goto(BASE + 'pending/');
  await page.waitForFunction(() => window.BuildGuide);
  const text = await page.evaluate(async data => {
    const keys = data.bom.items.map(i => `bom-${i.id}:${i.part}`);
    localStorage.setItem(data.storage, JSON.stringify(Object.fromEntries(keys.slice(0, -1).map(k => [k, true]))));
    const el = document.createElement('div'); document.body.append(el);
    const stop = window.BuildGuide.mount(el, data, { view: 'bom' });
    el.querySelector(`[data-check="${CSS.escape(keys.at(-1))}"]`).click();
    stop();
    window.BuildGuide.mount(el, data, { view: 'bom' });
    await new Promise(r => setTimeout(r, 200));
    return el.querySelector('.ag-message').textContent;
  }, D);
  expect(text).toBe('');
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

// window and document listeners added after the marker and not removed yet
const trackListeners = page => page.addInitScript(() => {
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

test('unmounting removes every listener and the markup, mounting again works', async ({ page }) => {
  await trackListeners(page);
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

test('mounting again on the same root after an unmount: one render per hash change, body class follows the live mount', async ({ page }) => {
  await inlinePage(page, 'same-root/', D, '<div id="host"></div>');
  await page.goto(BASE + 'same-root/');
  await page.waitForFunction(() => window.BuildGuide);
  const [, second] = D.boards.wiring.steps, body = page.locator('body'), host = page.locator('#host');
  const mount = () => page.evaluate(data => { window.__stop = window.BuildGuide.mount(document.getElementById('host'), data, { view: 'board', board: 'wiring' }); }, D);
  await mount(); await ready(host);
  // unmounted while expanded: the first instance takes its body class with it
  await host.locator('[data-action=fullscreen]').click();
  await expect(body).toHaveClass(/ag-no-scroll/);
  await page.evaluate(() => window.__stop());
  await expect(body).not.toHaveClass(/ag-no-scroll/);
  await mount(); await ready(host);
  await expect(body).not.toHaveClass(/ag-no-scroll/);
  // a leaked first instance would render into the same root a second time
  await page.evaluate(() => { window.__renders = []; new MutationObserver(r => window.__renders.push(...r)).observe(document.getElementById('host'), { childList: true }); });
  await setHash(page, `wiring=${hashOf(second, second.connections[0])}`);
  await expect(host.locator('.ag-steps [data-step="1"]')).toHaveAttribute('aria-current', 'step');
  expect(await page.evaluate(() => window.__renders.filter(r => r.addedNodes.length).length)).toBe(1);
  await host.locator('[data-action=fullscreen]').click();
  await expect(body).toHaveClass(/ag-no-scroll/);
  await page.evaluate(() => window.__stop());
  await expect(body).not.toHaveClass(/ag-no-scroll/);
});

// the combined component: a tab for the BOM and one per board, the active tab's component in one panel
const TABS = ['Bill of materials', ...boards.map(([, b]) => b.title)];
const tabOf = (page, name) => page.getByRole('tab', { name, exact: true });
const panelOf = page => page.getByRole('tabpanel');
const hashNow = page => page.evaluate(() => decodeURIComponent(location.hash));
const selected = (page, name) => expect(page.getByRole('tab', { selected: true })).toHaveText(name);

test('guide: a tab for the BOM and one per board, in the order of the data, and the BOM component in the panel', async ({ page }) => {
  await page.goto(url('guide'));
  await expect(page.getByRole('tab')).toHaveText(TABS);
  await expect(page.getByRole('tablist')).toHaveCount(1);
  await selected(page, TABS[0]);
  await expect(panelOf(page)).toHaveAccessibleName(TABS[0]);
  await expect(panelOf(page).locator('tbody tr:not(.ag-group)')).toHaveCount(D.bom.items.length);
  // only the active tab's component exists
  await expect(page.locator('.ag-steps')).toHaveCount(0);
  await tabOf(page, TABS[1]).click();
  await selected(page, TABS[1]); await ready(panelOf(page));
  await expect(panelOf(page)).toHaveAccessibleName(TABS[1]);
  await expect(panelOf(page).locator(`nav[aria-label="${boards[0][1].title} steps"]`)).toHaveCount(1);
  await expect(page.locator('.ag-bom')).toHaveCount(0);
});

for (const [key, b] of boards) {
  test(`guide: ${key} is drawn at its real size when its tab is first shown, zoom and fit work`, async ({ page }) => {
    await page.goto(url('guide'));
    await tabOf(page, b.title).click(); await ready(panelOf(page));
    const canvas = panelOf(page).locator('.ag-board-canvas'), paper = canvas.locator('.joint-paper');
    expect((await canvas.boundingBox()).height).toBeGreaterThan(200);
    const width = (await paper.boundingBox()).width;
    expect(width).toBeGreaterThan(200);
    await panelOf(page).locator('[data-action=zoom-in]').click();
    expect((await paper.boundingBox()).width).toBeGreaterThan(width);
    await panelOf(page).locator('[data-action=zoom-fit]').click();
    expect((await paper.boundingBox()).width).toBe(width);
    // the connections of the first step are drawn, not squeezed into a hidden box
    await expect(canvas.locator('[data-connection]')).toHaveCount((b.scope || 'step') === 'all' ? b.steps.flatMap(s => s.connections).length : b.steps[0].connections.length);
  });
}

test('guide: keyboard, arrows move between the tabs, Home and End jump, one tab stop', async ({ page }) => {
  await page.goto(url('guide'));
  const tabs = page.getByRole('tab');
  await expect(tabs.first()).toHaveAttribute('tabindex', '0');
  await expect(tabs.nth(1)).toHaveAttribute('tabindex', '-1');
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await selected(page, TABS[1]); await expect(tabs.nth(1)).toBeFocused(); await ready(panelOf(page));
  await expect(tabs.nth(1)).toHaveAttribute('tabindex', '0');
  await expect(tabs.first()).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('End');
  await selected(page, TABS.at(-1)); await expect(tabs.last()).toBeFocused(); await ready(panelOf(page));
  await page.keyboard.press('ArrowRight');
  await selected(page, TABS[0]); await expect(tabs.first()).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await selected(page, TABS.at(-1)); await ready(panelOf(page));
  await page.keyboard.press('Home');
  await selected(page, TABS[0]); await expect(panelOf(page).locator('.ag-bom')).toHaveCount(1);
  // Tab leaves the tab list for the panel
  await page.keyboard.press('Tab');
  await expect(tabs.first()).not.toBeFocused();
});

test('guide: the tab is in the hash next to the board pairs, and the back button returns through the tabs', async ({ page }) => {
  const [w, t] = [D.boards.wiring, D.boards.tubing];
  await page.goto(url('guide'));
  expect(await hashNow(page)).toBe('');
  await tabOf(page, w.title).click(); await ready(panelOf(page));
  expect(await hashNow(page)).toBe('#guide=wiring');
  await panelOf(page).locator('[data-step="1"]').click();
  await expect(panelOf(page).locator('[data-step="1"]')).toHaveAttribute('aria-current', 'step');
  expect(await hashNow(page)).toBe(`#guide=wiring&wiring=${hashOf(w.steps[1], w.steps[1].connections[0])}`);
  await tabOf(page, t.title).click(); await ready(panelOf(page));
  expect(await hashNow(page)).toBe(`#guide=tubing&wiring=${hashOf(w.steps[1], w.steps[1].connections[0])}`);
  // the board that was left keeps its place
  await tabOf(page, w.title).click(); await ready(panelOf(page));
  await expect(panelOf(page).locator('[data-step="1"]')).toHaveAttribute('aria-current', 'step');
  await page.goBack(); await selected(page, t.title); await ready(panelOf(page));
  await page.goBack(); await selected(page, w.title); await ready(panelOf(page));
  await page.goBack(); await selected(page, w.title);
  await page.goBack(); await selected(page, TABS[0]);
  await expect(panelOf(page).locator('.ag-bom')).toHaveCount(1);
  await page.goForward(); await selected(page, w.title);
});

test('guide: the tab comes back from the hash on load, a board pair opens its tab, the guide pair wins over it', async ({ page }) => {
  const [w, t] = [D.boards.wiring, D.boards.tubing], tubingAt = at('tubing', t.steps[2], t.steps[2].connections[0]), wiringAt = at('wiring', w.steps[1], w.steps[1].connections[0]);
  await page.goto(`${url('guide')}#guide=tubing`); await selected(page, t.title); await ready(panelOf(page));
  await expect(panelOf(page).locator('[data-step="0"]')).toHaveAttribute('aria-current', 'step');
  await page.goto(`${url('guide')}#guide=bom`); await selected(page, TABS[0]);
  await page.goto(`${url('guide')}#${tubingAt}`); await selected(page, t.title); await ready(panelOf(page));
  await expect(panelOf(page).locator('[data-step="2"]')).toHaveAttribute('aria-current', 'step');
  await page.goto(`${url('guide')}#${wiringAt}&guide=tubing&${tubingAt}`); await selected(page, t.title); await ready(panelOf(page));
  await page.reload(); await selected(page, t.title); await ready(panelOf(page));
  // an unknown tab is no tab: the first one stays
  await page.goto(`${url('guide')}#guide=nowhere`); await selected(page, TABS[0]);
  // a link to a board pair opens that board's tab
  await page.goto(url('guide')); await selected(page, TABS[0]);
  await setHash(page, wiringAt);
  await selected(page, w.title); await ready(panelOf(page));
  await expect(panelOf(page).locator('[data-step="1"]')).toHaveAttribute('aria-current', 'step');
  await setHash(page, `${wiringAt}&${tubingAt}`);
  await selected(page, t.title); await ready(panelOf(page));
  await expect(panelOf(page).locator('[data-step="2"]')).toHaveAttribute('aria-current', 'step');
  // the pair of the tab that is shown moves its board and keeps the tab
  await setHash(page, `${wiringAt}&${at('tubing', t.steps[1], t.steps[1].connections[0])}`);
  await selected(page, t.title);
  await expect(panelOf(page).locator('[data-step="1"]')).toHaveAttribute('aria-current', 'step');
  // an anchor leaves the tab where it is
  await setHash(page, 'top'); await selected(page, t.title);
});

test('guide: a tab that is already shown keeps its component, Alt+Arrow is left to the browser', async ({ page }) => {
  await page.goto(url('guide'));
  const search = panelOf(page).locator('[data-role=search]');
  await search.fill('relay');
  await tabOf(page, TABS[0]).click();
  await expect(search).toHaveValue('relay');
  await tabOf(page, TABS[0]).focus();
  await page.keyboard.press('Home');
  await expect(search).toHaveValue('relay');
  await tabOf(page, TABS[0]).focus();
  await page.keyboard.press('Alt+ArrowRight');
  await selected(page, TABS[0]);
});

test('guide: a hash set from outside opens one tab, and back to a board pair without tab pair opens that board', async ({ page }) => {
  const [w, t] = [D.boards.wiring, D.boards.tubing], wiringAt = at('wiring', w.steps[1], w.steps[1].connections[0]);
  await page.goto(url('guide'));
  await page.evaluate(() => { window.__drawn = new Set(); new MutationObserver(() => document.querySelectorAll('nav.ag-steps').forEach(n => { window.__drawn.add(n.getAttribute('aria-label')); })).observe(document.body, { childList: true, subtree: true }); });
  await setHash(page, `guide=tubing&${wiringAt}`);
  await selected(page, t.title); await ready(panelOf(page));
  expect(await page.evaluate(() => [...window.__drawn])).toEqual([`${t.title} steps`]);
  await page.goto(`${url('guide')}#${wiringAt}`); await selected(page, w.title); await ready(panelOf(page));
  await tabOf(page, t.title).click(); await ready(panelOf(page));
  await page.goBack(); await selected(page, w.title);
});

test('guide: ticks of the BOM and the boards survive switching tabs and reloading', async ({ page }) => {
  const w = D.boards.wiring, all = w.steps.flatMap(s => s.connections);
  await page.goto(url('guide'));
  await panelOf(page).locator('tbody input[type=checkbox]').first().check();
  await tabOf(page, w.title).click(); await ready(panelOf(page));
  await panelOf(page).locator('.ag-verify input').check();
  await expect(panelOf(page).locator('.ag-progress')).toHaveText(`1 / ${all.length} checked`);
  await tabOf(page, TABS[0]).click();
  await expect(panelOf(page).locator('.ag-progress')).toHaveText(`1 / ${D.bom.items.length} checked`);
  await expect(panelOf(page).locator('tbody input[type=checkbox]').first()).toBeChecked();
  await page.reload();
  await expect(panelOf(page).locator('.ag-progress')).toHaveText(`1 / ${D.bom.items.length} checked`);
  // the status line and the progress tools exist once: those of the shown component
  await expect(page.locator('.ag-status')).toHaveCount(1);
  await expect(panelOf(page).locator('[data-role=import-file]')).toHaveCount(1);
});

test('guide: data-board picks tabs in the order given, an unknown key says so', async ({ page }) => {
  await inlinePage(page, 'subset/', D, '<div data-buildguide="guide" data-board="tubing   bom wiring"></div>');
  await page.goto(BASE + 'subset/');
  await expect(page.getByRole('tab')).toHaveText([D.boards.tubing.title, TABS[0], D.boards.wiring.title]);
  await selected(page, D.boards.tubing.title); await ready(panelOf(page));
  await tabOf(page, D.boards.wiring.title).click(); await ready(panelOf(page));
  await inlinePage(page, 'one/', D, '<div data-buildguide="guide" data-board="wiring"></div>');
  await page.goto(BASE + 'one/');
  await expect(page.getByRole('tab')).toHaveText([D.boards.wiring.title]);
  await ready(panelOf(page));
  const noBom = structuredClone(D); delete noBom.bom;
  await inlinePage(page, 'nobom/', noBom, '<div data-buildguide="guide"></div>');
  await page.goto(BASE + 'nobom/');
  await expect(page.getByRole('tab')).toHaveText(TABS.slice(1));
  await inlinePage(page, 'unknown-tabs/', D, '<div data-buildguide="guide" data-board="wiring nowhere"></div><div data-buildguide="guide" data-board="constructor"></div>');
  await page.goto(BASE + 'unknown-tabs/');
  await expect(page.locator('[data-buildguide]')).toHaveText(['Unknown guide component: guide wiring nowhere.', 'Unknown guide component: guide constructor.']);
  await inlinePage(page, 'empty-tabs/', { storage: 'x' }, '<div data-buildguide="guide"></div>');
  await page.goto(BASE + 'empty-tabs/');
  await expect(page.locator('[data-buildguide]')).toHaveText('Unknown guide component: guide.');
});

test('guide: the minimal example with a BOM and both boards mounts as three tabs', async ({ page }) => {
  const all = minimal('all');
  await inlinePage(page, 'minimal-guide/', all, '<div data-buildguide="guide"></div>');
  await page.goto(BASE + 'minimal-guide/');
  await expect(page.getByRole('tab')).toHaveText(['Bill of materials', all.boards.wiring.title, all.boards.tubing.title]);
  await expect(panelOf(page).locator('tbody tr:not(.ag-group)')).toHaveCount(all.bom.items.length);
  await tabOf(page, all.boards.tubing.title).click(); await ready(panelOf(page));
  await expect(panelOf(page).locator('.ag-steps [data-step]')).toHaveCount(all.boards.tubing.steps.length);
});

test('guide: unmounting removes the tabs, the panel and every listener, mounting again works', async ({ page }) => {
  await trackListeners(page);
  await inlinePage(page, 'tabs-remount/', D, '<div id="host"></div>');
  await page.goto(BASE + 'tabs-remount/');
  await page.waitForFunction(() => window.BuildGuide);
  await page.evaluate(() => { window.__mark = true; });
  for (const subset of ['', 'tubing wiring']) {
    await page.evaluate(([data, board]) => {
      const host = document.getElementById('host'), el = document.createElement('div');
      host.replaceChildren(el);
      window.__stop = window.BuildGuide.mount(el, data, { view: 'guide', board });
    }, [D, subset || undefined]);
    await expect(page.getByRole('tab')).toHaveCount(subset ? 2 : TABS.length);
    await tabOf(page, D.boards.wiring.title).click(); await ready(panelOf(page));
    expect(await page.evaluate(() => window.__live.length)).toBeGreaterThan(0);
    await page.evaluate(() => window.__stop());
    expect(await page.evaluate(() => window.__live.length)).toBe(0);
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.locator('.ag-guide')).toHaveCount(0);
    expect(await page.evaluate(() => document.getElementById('host').textContent)).toBe('');
  }
  await setHash(page, 'tubing=B&guide=wiring');
  await expect(page.locator('.ag-guide')).toHaveCount(0);
});

test('guide: a print shows the active component without the tabs', async ({ page }) => {
  await page.goto(url('guide'));
  await tabOf(page, D.boards.wiring.title).click(); await ready(panelOf(page));
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('tablist')).toBeHidden();
  await expect(panelOf(page).locator('.ag-board-canvas')).toBeVisible();
  await expect(panelOf(page).locator('[data-action=print]')).toBeHidden();
});

for (const want of ['light', 'dark']) {
  test(`guide: the tabs follow a ${want} scheme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: want });
    await page.goto(url('guide'));
    await signal(page, want);
    const colors = await page.locator('.ag-tabs').evaluate(el => {
      const [on, off] = [el.querySelector('[aria-selected=true]'), el.querySelector('[aria-selected=false]')];
      return { on: getComputedStyle(on).color, bar: getComputedStyle(on).borderBottomColor, off: getComputedStyle(off).color };
    });
    expect(colors).toEqual({ on: token('ink', want), bar: token('accent', want), off: token('muted', want) });
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('a component says it needs JavaScript', async ({ page }) => {
    await page.goto(url('bom'));
    expect(await page.content()).toContain('This guide needs JavaScript.');
  });
});

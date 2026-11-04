// Browser checks of the texts: a guide in German shows and speaks no English, and strings from the mount options, the guide and a
// board replace the English texts in that order. Runs against the same hosts as guide.spec.mjs (BUILDGUIDE_SITE, BUILDGUIDE_PREFIX).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { STRING_KEYS } from '../lib/buildguide-check.mjs';

const D = JSON.parse(readFileSync(new URL('../example/guide.json', import.meta.url)));
const DE = JSON.parse(readFileSync(new URL('./strings-de.json', import.meta.url)));
const PREFIX = process.env.BUILDGUIDE_PREFIX ?? '';
const ORIGIN = 'http://127.0.0.1:8080', BASE = `${ORIGIN}${PREFIX}/example/`;
const CORE = process.env.BUILDGUIDE_SITE ? `${PREFIX}/assets/buildguide/` : '/lib/';
const GIF = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64');

let problems;
test.beforeEach(async ({ page }) => {
  problems = { errors: [], missing: [] };
  page.on('pageerror', e => problems.errors.push(String(e)));
  page.on('response', r => r.status() >= 400 && problems.missing.push(r.url()));
  await page.route(`${BASE}assets/part.gif`, r => r.fulfill({ contentType: 'image/gif', body: GIF }));
});
test.afterEach(() => expect(problems).toEqual({ errors: [], missing: [] }));

const inlinePage = (page, path, data, components) => page.route(BASE + path, r => r.fulfill({ contentType: 'text/html', body:
  `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${CORE}buildguide.css">${components}
   <script type="application/json" id="guide-data" data-assets="../assets/">${JSON.stringify(data).replace(/</g, '\\u003c')}</script><script src="${CORE}buildguide.js" defer></script>` }));
const ready = scope => expect(scope.locator('.ag-board-canvas[data-ready=true]')).toHaveCount(1);
const csv = async (page, scope) => {
  const download = page.waitForEvent('download');
  await scope.locator('[data-action=export]').click();
  return readFileSync(await (await download).path(), 'utf8').replace(/^\uFEFF/, '');
};

test('the German table names every key once', () => {
  expect(Object.keys(DE)).toEqual([...STRING_KEYS]);
});

// The words a person meets: every text node and the accessible names, placeholders and alt texts in the page, the CSV files too.
// A word that is neither in the German table nor in the guide data is an English text the table does not reach.
const shown = page => page.evaluate(() => {
  const found = [], walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) { if (!n.parentElement.closest('script, style')) found.push(n.nodeValue); }
    else for (const name of ['aria-label', 'placeholder', 'alt', 'title']) if (n.hasAttribute(name)) found.push(n.getAttribute(name));
  }
  return found;
});
const words = text => text.toLowerCase().match(/\p{L}+/gu) ?? [];
// the example guide with all its prose replaced, so no English word of the data can hide an English word of the components
const PROSE = new Set(['title', 'part', 'spec', 'group', 'note', 'text', 'name', 'sub', 'label', 'la', 'lb', 'cable', 'size', 'linkLabel', 'imageAlt']);
const germanGuide = () => {
  const data = JSON.parse(JSON.stringify(D, (key, value) => typeof value === 'string' && PROSE.has(key) ? 'Inhalt' : value));
  delete data.$schema;
  for (const board of Object.values(data.boards)) board.legend = board.legend?.map(l => typeof l === 'string' ? 'Inhalt' : l);
  data.bom.items[0].image = 'part.gif';
  return data;
};

// Not opened here, so not covered by this test: the error texts (a file that did not load, an unknown component) and storage being unavailable
test('a guide with German strings shows and speaks no English text in its components and in the states the test opens', async ({ page }) => {
  const guide = germanGuide(), data = { ...guide, strings: DE }, texts = [];
  await inlinePage(page, 'german/', data, `<div lang="de">${['bom', 'steps', 'board" data-board="wiring', 'board" data-board="tubing', 'guide'].map(v => `<div data-buildguide="${v}"></div>`).join('')}</div>`);
  // the wiring board opens on its diode, whose ends have words of their own
  const wiringSteps = D.boards.wiring.steps, step = wiringSteps.find(s => s.connections.some(c => D.boards.wiring.colors[c.color].diode));
  const diode = step.connections.find(c => D.boards.wiring.colors[c.color].diode);
  await page.goto(`${BASE}german/#wiring=${encodeURIComponent(step.id)}${step.connections.length > 1 ? `/${encodeURIComponent(diode.no)}` : ''}`);
  const of = view => page.locator(`[data-buildguide="${view}"]`), bom = of('bom'), steps = of('steps'), wiring = page.locator('[data-buildguide=board][data-board=wiring]');
  // both boards, and the wiring board again in the tab the hash opens
  await expect(page.locator('.ag-board-canvas[data-ready=true]')).toHaveCount(3);
  await expect(page.getByRole('tab')).toHaveCount(4);
  texts.push(...await shown(page));
  // the states with texts of their own: full screen, the enlarged image, an empty search, every step ticked, a reset with its undo, a refused import
  await wiring.locator('[data-action=fullscreen]').click();
  await expect(wiring.locator('[data-action=fullscreen]')).toHaveAttribute('aria-pressed', 'true');
  texts.push(...await shown(page));
  await wiring.locator('[data-action=fullscreen]').click();
  await bom.locator('[data-zoom]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // the dialog sits in the body, outside the element with the language
  await expect(page.getByRole('dialog')).toHaveAttribute('lang', 'de');
  texts.push(...await shown(page));
  await page.keyboard.press('Escape');
  await expect(bom.locator('[data-role=filter] option')).toHaveText([DE.all, DE.missing, DE.done]);
  await bom.locator('[data-role=search]').fill('zzz');
  await bom.locator('[data-role=filter]').selectOption('Missing');
  await expect(bom.locator('.ag-empty')).toBeVisible();
  texts.push(...await shown(page));
  await steps.evaluate(el => { for (let box = el.querySelector('[data-check]:not(:checked)'); box; box = el.querySelector('[data-check]:not(:checked)')) box.click(); });
  await expect(steps.locator('.ag-message')).not.toBeEmpty();
  texts.push(...await shown(page));
  await steps.locator('[data-action=reset-progress]').click();
  await expect(steps.locator('[data-action=undo-progress]')).toBeVisible();
  texts.push(...await shown(page));
  await steps.locator('[data-action=undo-progress]').click();
  await expect(steps.locator('.ag-message')).toHaveText(DE.restored);
  texts.push(...await shown(page));
  await bom.locator('[data-role=import-file]').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from('[1]') });
  await expect(bom.locator('.ag-message')).not.toBeEmpty();
  texts.push(...await shown(page));
  await bom.locator('[data-role=search]').fill('');
  texts.push(await csv(page, bom), await csv(page, wiring));

  // the values of the data that a component shows (ids, terminal names, color names), not its keys and not the values it never shows
  const HIDDEN = new Set(['storage', 'export', 'image', 'prefix', 'kind', 'scope', 'level', 'key', 'diodeLoop']), values = [];
  JSON.stringify(guide, (key, value) => { if (typeof value === 'string' && !HIDDEN.has(key)) values.push(value); return value; });
  const allowed = new Set([...Object.values(DE).flatMap(s => words(s.replace(/\{\w+\}/g, ''))), ...values.flatMap(words)]);
  expect([...new Set(texts.flatMap(words))].filter(w => !allowed.has(w))).toEqual([]);
  // and the German texts are there
  const all = texts.join('\n');
  // ("Export", "CSV", "Filter", "Link" are German words too, so the word check above cannot tell the English texts that use them)
  for (const text of [DE.bom, DE.saved, DE.from, DE.cable, DE.ringEnd, DE.exitFullscreen, DE.close, DE.noMatch, 'Alle Schritte abgehakt', DE.reset, DE.undo,
    DE.restored, DE.notProgress, DE.caution, DE.warning, DE.byStep, DE.exportCsv])
    expect(all).toContain(text);
  expect(all).toContain('"Gruppe","Bauteil","Spezifikation","Menge","Inhalt","Erledigt"');
  expect(all).toContain('"Nr.","Von","Nach","Farbe","Kabel","Größe","Erledigt"');
});

test('strings of the mount options, the guide and a board replace the English texts in that order, as text, with their placeholders filled', async ({ page }) => {
  const data = structuredClone(D);
  data.strings = { print: 'Print (guide)', from: 'From (guide)', checked: '{m} to check, {n} done {x}', saved: '<img src=x onerror="window.injected = 1">' };
  data.boards.wiring.strings = { from: 'From (wiring)' };
  await inlinePage(page, 'order/', D, '<div id="bom"></div><div id="wiring"></div><div id="tubing"></div><div id="guide"></div>');
  await page.goto(BASE + 'order/');
  await page.waitForFunction(() => window.BuildGuide);
  await page.evaluate(data => {
    const strings = { print: 'Print (mount)', from: 'From (mount)', fit: 'Fit (mount)', bom: 'Parts (mount)', saved: 'Saved (mount)' };
    for (const [id, options] of [['bom', { view: 'bom' }], ['wiring', { view: 'board', board: 'wiring' }], ['tubing', { view: 'board', board: 'tubing' }], ['guide', { view: 'guide' }]])
      window.BuildGuide.mount(document.getElementById(id), data, { ...options, strings });
  }, data);
  const bom = page.locator('#bom'), wiring = page.locator('#wiring'), tubing = page.locator('#tubing'), guide = page.locator('#guide');
  await ready(wiring); await ready(tubing);
  await expect(bom.locator('[data-action=print]')).toHaveText('Print (guide)');
  await expect(bom.locator('.ag-progress')).toHaveText(`${D.bom.items.length} to check, 0 done {x}`);
  await expect(bom.locator('.ag-status')).toHaveText(data.strings.saved);
  await expect(bom.locator('.ag-status img')).toHaveCount(0);
  await expect(wiring.locator('.ag-connection-detail small').first()).toHaveText(/^From \(wiring\)/);
  await expect(tubing.locator('.ag-connection-detail small').first()).toHaveText('From (guide)');
  await expect(wiring.locator('[data-action=zoom-fit]')).toHaveText('Fit (mount)');
  // the combined guide passes the mount options' strings on to the component in its panel
  await expect(guide.getByRole('tab').first()).toHaveText('Parts (mount)');
  await expect(guide.locator('[role=tabpanel] [data-action=print]')).toHaveText('Print (guide)');
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

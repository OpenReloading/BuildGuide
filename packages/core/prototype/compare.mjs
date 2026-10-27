// Compares the shipped board renderer with the prototype (board-svg.js) on the example boards and on a dense one (dense-guide.json):
// screenshots, the geometry checks of tests/board-layout.spec.mjs as counts, size and time to ready.
// Run from packages/core, with the repository's dependencies installed:  node prototype/compare.mjs [output folder]
// It also runs the browser tests, unchanged, against the prototype (set SKIP_SPECS=1 to leave that out).
import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const CORE = resolve(import.meta.dirname, '..');
const OUT = resolve(process.argv[2] ?? `${CORE}/prototype/comparison`);
const WORK = `${CORE}/test-results/compare`;   // inside the package: the static server serves only folders of the repository
const gz = file => gzipSync(readFileSync(`${CORE}/${file}`)).length;
// the third-party scripts and the wasm module are the files in the folders under src/
const thirdParty = readdirSync(`${CORE}/src`, { recursive: true }).filter(f => /[\\/]/.test(f) && /\.(js|wasm)$/.test(f));
const SIZES = {
  shipped: ['buildguide-board.js', ...thirdParty].map(f => gz(`src/${f}`)).reduce((a, b) => a + b),
  prototype: gz('prototype/board-svg.js'),
};

// a copy of the package per renderer and guide: the prototype takes the place of the shipped board script, the third-party script is left empty
function copy(name, renderer, guide) {
  const dir = `${WORK}/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const part of ['src', 'example', 'tests', 'package.json', 'playwright.config.mjs']) cpSync(`${CORE}/${part}`, `${dir}/${part}`, { recursive: true });
  if (renderer === 'prototype') {
    cpSync(`${CORE}/prototype/board-svg.js`, `${dir}/src/buildguide-board.js`);
    for (const f of thirdParty.filter(f => f.endsWith('.min.js'))) writeFileSync(`${dir}/src/${f}`, '');
  }
  if (guide === 'dense') cpSync(`${CORE}/prototype/dense-guide.json`, `${dir}/example/guide.json`);
  return dir;
}

// the geometry of the board on the page, as tests/board-layout.spec.mjs reads it
const drawn = page => page.evaluate(() => {
  const at = el => el.transform.baseVal.consolidate()?.matrix ?? new DOMMatrix();
  const box = (el, g) => { const b = el.getBBox(), m = at(g); return { x: b.x + m.e, y: b.y + m.f, w: b.width, h: b.height }; };
  const polyline = d => {
    const cmds = [...d.matchAll(/([MLC])([^MLC]*)/g)].map(m => ({ c: m[1], n: m[2].trim().split(/\s+/).map(Number) }));
    const pts = [];
    let cur;
    cmds.forEach(({ c, n }, i) => {
      if (c === 'C') {
        const [x1, y1, x2, y2, x, y] = n;
        const a = Math.hypot(x1 - cur[0], y1 - cur[1]) > 1e-6 ? [x1 - cur[0], y1 - cur[1]] : [x2 - cur[0], y2 - cur[1]];
        const b = Math.hypot(x - x2, y - y2) > 1e-6 ? [x - x2, y - y2] : [x - x1, y - y1];
        const det = a[0] * b[1] - a[1] * b[0];
        if (Math.abs(det) > 1e-6) { const t = ((x2 - cur[0]) * b[1] - (y2 - cur[1]) * b[0]) / det; pts.push([cur[0] + a[0] * t, cur[1] + a[1] * t]); }
        cur = [x, y];
      } else { cur = n; if (cmds[i + 1]?.c !== 'C') pts.push(cur); }
      if (c === 'C' && i === cmds.length - 1) pts.push(cur);
    });
    const same = (p, q, k) => Math.abs(p[k] - q[k]) < 0.01;
    return pts.filter((p, i) => !i || i === pts.length - 1 || !(same(p, pts[i - 1], 0) && same(p, pts[i + 1], 0) || same(p, pts[i - 1], 1) && same(p, pts[i + 1], 1)));
  };
  const parts = {}, captions = [], connections = {}, badges = [];
  for (const g of document.querySelectorAll('.ag-board-canvas g[data-type="buildguide.Part"]')) {
    parts[g.getAttribute('model-id')] = { body: box(g.querySelector('[joint-selector=body]'), g), labels: ['title', 'sub'].map(s => g.querySelector(`[joint-selector=${s}]`)).filter(t => t.textContent.trim()).map(t => box(t, g)) };
  }
  for (const g of document.querySelectorAll('.ag-board-canvas g[data-type="buildguide.Caption"]')) captions.push(box(g.querySelector('text'), g));
  for (const g of document.querySelectorAll('.ag-board-canvas [data-connection]')) connections[g.dataset.connection] = polyline(g.querySelector('[joint-selector=line]').getAttribute('d'));
  for (const g of document.querySelectorAll('.ag-board-canvas .joint-labels-layer g.label')) badges.push({ no: g.parentNode.getAttribute('model-id').slice(1), pill: !!g.querySelector('[joint-selector=pill]'), ...box(g, g) });
  return { parts, captions, connections, badges };
});

const inside = (r, g = 0) => ({ x0: r.x + g, y0: r.y + g, x1: r.x + r.w - g, y1: r.y + r.h - g });
const hits = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const seg = (p, q) => ({ x0: Math.min(p[0], q[0]), y0: Math.min(p[1], q[1]), x1: Math.max(p[0], q[0]), y1: Math.max(p[1], q[1]) });
const segments = pts => pts.slice(1).map((q, i) => [pts[i], q]);
const horizontal = ([p, q]) => Math.abs(p[1] - q[1]) < 1, vertical = ([p, q]) => Math.abs(p[0] - q[0]) < 1;
const SLACK = 1.5, OUTLINE = 3;

// the checks of the browser tests as counts, plus what a reader sees: bends, crossings, length
function measure(guide, key, g, shown) {
  const found = { notOrthogonal: 0, throughPart: 0, acrossLabel: 0, tooClose: 0, badgeOverlap: 0, badgeOnPart: 0, badgeOnBend: 0, noRoute: 0, bends: 0, crossings: 0, length: 0 };
  const board = guide.boards[key], width = c => (board.colors[c.color].width || 4) + OUTLINE;
  const labels = [...Object.entries(g.parts).flatMap(([, p]) => p.labels), ...g.captions];
  const legs = new Map();
  for (const c of shown) {
    const pts = g.connections[c.no], own = [c.a, c.b].map(e => e.slice(0, e.indexOf(':')));
    if (!pts || pts.length < 2) { found.noRoute++; continue; }
    found.bends += pts.length - 2;
    legs.set(c, segments(pts).map(([p, q], i, all) => ({ p, q, ends: [i === 0 && c.a, i === all.length - 1 && c.b] })));
    segments(pts).forEach(([p, q], i, all) => {
      found.length += Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (!horizontal([p, q]) && !vertical([p, q])) found.notOrthogonal++;
      for (const [id, part] of Object.entries(g.parts)) if (!(own.includes(id) && (i === 0 || i === all.length - 1)) && hits(seg(p, q), inside(part.body, SLACK))) found.throughPart++;
      for (const l of labels) if (hits(seg(p, q), inside(l, SLACK))) found.acrossLabel++;
    });
  }
  const list = [...legs.keys()];
  for (const [i, c] of list.entries()) for (const d of list.slice(i + 1)) {
    const near = Math.max(width(c), width(d));
    for (const x of legs.get(c)) for (const y of legs.get(d)) {
      const shared = x.ends.some(e => e && y.ends.includes(e));
      if (horizontal([x.p, x.q]) && vertical([y.p, y.q]) || vertical([x.p, x.q]) && horizontal([y.p, y.q])) {
        const [h, v] = horizontal([x.p, x.q]) ? [x, y] : [y, x], hx = [h.p[0], h.q[0]].sort((a, b) => a - b), vy = [v.p[1], v.q[1]].sort((a, b) => a - b);
        if (v.p[0] > hx[0] + 1 && v.p[0] < hx[1] - 1 && h.p[1] > vy[0] + 1 && h.p[1] < vy[1] - 1) found.crossings++;
        continue;
      }
      if (shared) continue;
      const [a, z] = horizontal([x.p, x.q]) && horizontal([y.p, y.q]) ? [1, 0] : vertical([x.p, x.q]) && vertical([y.p, y.q]) ? [0, 1] : [];
      if (a === undefined) continue;
      const along = Math.min(Math.max(x.p[z], x.q[z]), Math.max(y.p[z], y.q[z])) - Math.max(Math.min(x.p[z], x.q[z]), Math.min(y.p[z], y.q[z]));
      if (along > SLACK && Math.abs(x.p[a] - y.p[a]) < near - 0.5) found.tooClose++;
    }
  }
  const badges = g.badges.map(x => ({ ...x, ...inside(x) }));
  for (const [i, x] of badges.entries()) {
    for (const y of badges.slice(i + 1)) if (x.no !== y.no && hits(x, y)) found.badgeOverlap++;
    for (const part of Object.values(g.parts)) for (const r of [part.body, ...part.labels]) if (hits(x, inside(r, SLACK))) found.badgeOnPart++;
    if (x.pill) for (const pts of Object.values(g.connections)) for (const p of pts.slice(1, -1)) if (hits(x, { x0: p[0], y0: p[1], x1: p[0], y1: p[1] })) found.badgeOnBend++;
  }
  found.length = Math.round(found.length);
  return found;
}

const median = list => [...list].sort((a, b) => a - b)[list.length >> 1];
const server = (dir, port) => spawn('node', ['tests/serve.mjs', String(port), dir], { cwd: CORE, stdio: 'ignore' });

async function run(renderer, dataset, port, browser) {
  const dir = copy(`${renderer}-${dataset}`, renderer, dataset), srv = server(dir, port);
  await new Promise(r => setTimeout(r, 600));
  const guide = JSON.parse(readFileSync(`${dir}/example/guide.json`)), out = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => {
    new MutationObserver(() => { if (document.querySelector('.ag-board-canvas[data-ready=true]')) window.__readyAt ??= performance.now(); }).observe(document, { subtree: true, childList: true, attributes: true });
  });
  const base = `http://127.0.0.1:${port}/example`;
  for (const [key, board] of Object.entries(guide.boards)) {
    const all = board.steps.flatMap(s => s.connections);
    const views = [{ view: 'all', shown: all, go: async () => { await page.goto(`${base}/${key}/`); if ((board.scope || 'step') !== 'all') await page.locator('[data-role=scope]').selectOption('all'); } },
      ...board.steps.map(s => ({ view: `step ${s.id}`, shown: s.connections, go: () => page.goto(`${base}/${key}/#${encodeURIComponent(key)}=${encodeURIComponent(s.id)}`) }))];
    for (const v of (board.scope === 'all' ? views.slice(0, 1) : views)) {
      await page.goto('about:blank'); await v.go();   // each view from a fresh load, as the tests do
      await page.waitForSelector('.ag-board-canvas[data-ready=true]');
      await page.waitForFunction(n => document.querySelectorAll('[data-connection]').length === n, v.shown.length);
      const row = { renderer, dataset, board: key, view: v.view, wires: v.shown.length, ...measure(guide, key, await drawn(page), v.shown) };
      if (v.view === 'all') {
        // the whole board in the shot: the canvas takes the height of the drawing
        await page.locator('.ag-board-canvas').evaluate(el => { el.style.height = 'auto'; el.style.overflow = 'visible'; });
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${OUT}/${dataset}-${key}-all-${renderer}.png`, clip: await page.locator('.ag-board-canvas').boundingBox() });
        // cold: a fresh load of the page up to the drawn board; all: drawing every connection after a change of the scope, the page and its scripts loaded
        const cold = [], every = [];
        for (let i = 0; i < 5; i++) {
          await page.goto('about:blank'); await page.goto(`${base}/${key}/`);
          await page.waitForSelector('.ag-board-canvas[data-ready=true]');
          cold.push(await page.evaluate(() => window.__readyAt));
          if ((board.scope || 'step') !== 'all') {
            await page.evaluate(() => { window.__t0 = performance.now(); window.__readyAt = undefined; });
            await page.locator('[data-role=scope]').selectOption('all');
            await page.waitForFunction(n => document.querySelectorAll('[data-connection]').length === n && window.__readyAt, all.length);
            every.push(await page.evaluate(() => window.__readyAt - window.__t0));
          }
        }
        row.coldMs = Math.round(median(cold)); row.allMs = every.length ? Math.round(median(every)) : null;
      }
      out.push(row);
    }
  }
  await page.close(); srv.kill();
  return out;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const rows = [];
let port = 8120;
for (const dataset of ['demo', 'dense']) for (const renderer of ['shipped', 'prototype']) rows.push(...await run(renderer, dataset, port++, browser));
await browser.close();

// the browser tests, unchanged, against the prototype
let specs = 'not run';
if (!process.env.SKIP_SPECS) {
  const dir = `${WORK}/prototype-demo`;
  try { specs = execFileSync('npx', ['playwright', 'test', '--reporter=line'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim().split('\n').slice(-3).join(' '); }
  catch (error) { specs = `failed: ${String(error.stdout).trim().split('\n').slice(-6).join(' ')}`; }
}

const sum = (renderer, dataset, field) => rows.filter(r => r.renderer === renderer && r.dataset === dataset).reduce((t, r) => t + r[field], 0);
const FIELDS = ['notOrthogonal', 'throughPart', 'acrossLabel', 'tooClose', 'badgeOverlap', 'badgeOnPart', 'badgeOnBend', 'noRoute', 'bends', 'crossings', 'length'];
const md = ['| dataset | renderer | views | ' + FIELDS.join(' | ') + ' |', '|' + Array(FIELDS.length + 3).fill('---').join('|') + '|'];
for (const dataset of ['demo', 'dense']) for (const renderer of ['shipped', 'prototype']) md.push(`| ${dataset} | ${renderer} | ${rows.filter(r => r.renderer === renderer && r.dataset === dataset).length} | ${FIELDS.map(f => sum(renderer, dataset, f)).join(' | ')} |`);
md.push('', '| board, all connections | renderer | wires | bends | crossings | too close | cold load to drawn (ms) | all connections drawn (ms) |', '|---|---|---|---|---|---|---|---|');
for (const r of rows.filter(r => r.view === 'all')) md.push(`| ${r.dataset} ${r.board} | ${r.renderer} | ${r.wires} | ${r.bends} | ${r.crossings} | ${r.tooClose} | ${r.coldMs} | ${r.allMs ?? 'n/a'} |`);
md.push('', 'times: median of 5 runs in headless Chromium on the development machine, loopback server', `gzipped bytes: shipped ${SIZES.shipped} (board script, two third-party scripts, wasm), prototype ${SIZES.prototype}`, `browser tests against the prototype: ${specs}`);
writeFileSync(`${OUT}/results.md`, md.join('\n') + '\n');
writeFileSync(`${OUT}/results.json`, JSON.stringify(rows, null, 1) + '\n');
console.log(md.join('\n'));

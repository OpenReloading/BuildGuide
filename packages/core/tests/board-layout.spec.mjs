// Browser checks of the geometry of the example boards: what the router and the renderer drew, read from the DOM.
// Expectations come from example/guide.json. The example pages exist in the core example, the MkDocs docs site and the Docusaurus example.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const D = JSON.parse(readFileSync(new URL('../example/guide.json', import.meta.url)));
const ORIGIN = 'http://127.0.0.1:8080';
const OUTLINE = 3;   // the outline of a connection is this much wider than its line (renderer)
const SLACK = 1.5;   // drawing tolerance in pixels: rounded corners, part borders

// the geometry of the board on the page, in the board's own coordinates
async function drawn(page) {
  return page.evaluate(() => {
    const at = el => el.transform.baseVal.consolidate()?.matrix ?? new DOMMatrix();
    const box = (el, g) => { const b = el.getBBox(), m = at(g); return { x: b.x + m.e, y: b.y + m.f, w: b.width, h: b.height }; };
    const num = v => Number(v);
    // the points of a connection: the ends, and the corner each rounded bend was drawn around
    const polyline = d => {
      const cmds = [...d.matchAll(/([MLC])([^MLC]*)/g)].map(m => ({ c: m[1], n: m[2].trim().split(/\s+/).map(num) }));
      const pts = [];
      let cur;
      cmds.forEach(({ c, n }, i) => {
        if (c === 'C') {
          const [x1, y1, x2, y2, x, y] = n;
          const a = Math.hypot(x1 - cur[0], y1 - cur[1]) > 1e-6 ? [x1 - cur[0], y1 - cur[1]] : [x2 - cur[0], y2 - cur[1]];
          const b = Math.hypot(x - x2, y - y2) > 1e-6 ? [x - x2, y - y2] : [x - x1, y - y1];
          const det = a[0] * b[1] - a[1] * b[0];
          if (Math.abs(det) > 1e-6) {
            const t = ((x2 - cur[0]) * b[1] - (y2 - cur[1]) * b[0]) / det;
            pts.push([cur[0] + a[0] * t, cur[1] + a[1] * t]);
          }
          cur = [x, y];
        } else {
          cur = n;
          if (cmds[i + 1]?.c !== 'C') pts.push(cur);   // a point before a curve is where the curve starts, not a bend
        }
        if (c === 'C' && i === cmds.length - 1) pts.push(cur);
      });
      // the bends only: a point on a straight line between its neighbours is dropped
      const same = (p, q, k) => Math.abs(p[k] - q[k]) < 0.01;
      return pts.filter((p, i) => !i || i === pts.length - 1 || !(same(p, pts[i - 1], 0) && same(p, pts[i + 1], 0) || same(p, pts[i - 1], 1) && same(p, pts[i + 1], 1)));
    };
    const parts = {}, captions = [];
    for (const g of document.querySelectorAll('.ag-board-canvas g[data-type="buildguide.Part"]')) {
      const id = g.getAttribute('model-id');
      parts[id] = { body: box(g.querySelector('[joint-selector=body]'), g), labels: ['title', 'sub'].map(s => g.querySelector(`[joint-selector=${s}]`)).filter(t => t.textContent.trim()).map(t => box(t, g)) };
    }
    for (const g of document.querySelectorAll('.ag-board-canvas g[data-type="buildguide.Caption"]')) captions.push(box(g.querySelector('text'), g));
    const connections = {}, badges = [];
    for (const g of document.querySelectorAll('.ag-board-canvas [data-connection]')) {
      connections[g.dataset.connection] = polyline(g.querySelector('[joint-selector=line]').getAttribute('d'));
    }
    for (const g of document.querySelectorAll('.ag-board-canvas .joint-labels-layer g.label')) {
      badges.push({ no: g.parentNode.getAttribute('model-id').slice(1), pill: !!g.querySelector('[joint-selector=pill]'), ...box(g, g) });
    }
    return { parts, captions, connections, badges };
  });
}

const inside = (r, g = 0) => ({ x0: r.x + g, y0: r.y + g, x1: r.x + r.w - g, y1: r.y + r.h - g });
const hits = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
// a segment is a degenerate rectangle
const seg = (p, q) => ({ x0: Math.min(p[0], q[0]), y0: Math.min(p[1], q[1]), x1: Math.max(p[0], q[0]), y1: Math.max(p[1], q[1]) });
const segments = pts => pts.slice(1).map((q, i) => [pts[i], q]);
const horizontal = ([p, q]) => Math.abs(p[1] - q[1]) < 1;   // the rounded corners of the drawing are off by half a pixel
const vertical = ([p, q]) => Math.abs(p[0] - q[0]) < 1;

function problems(b, g, shown) {
  const found = [];
  const obstacles = [...Object.entries(g.parts).flatMap(([id, p]) => p.labels.map(l => [id + ' label', l])), ...g.captions.map(l => ['caption', l])];
  for (const c of shown) {
    const pts = g.connections[c.no], own = [c.a, c.b].map(e => e.slice(0, e.indexOf(':')));
    if (!pts || pts.length < 2) { found.push(`${c.no}: no route`); continue; }
    segments(pts).forEach(([p, q], i, all) => {
      const where = `${c.no} segment ${i + 1}`;
      if (!horizontal([p, q]) && !vertical([p, q])) found.push(`${where}: not orthogonal ${p} to ${q}`);
      for (const [id, part] of Object.entries(g.parts)) {
        // the legs at its terminals may start inside the parts the connection joins
        if (own.includes(id) && (i === 0 || i === all.length - 1)) continue;
        if (hits(seg(p, q), inside(part.body, SLACK))) found.push(`${where}: through the body of ${id}`);
      }
      for (const [name, l] of obstacles) if (hits(seg(p, q), inside(l, SLACK))) found.push(`${where}: across ${name}`);
    });
  }
  const limit = (a, c) => Math.max(...[a, c].map(x => (D.boards[b].colors[x.color].width || 4) + OUTLINE));
  // a connection as segments with the terminals its first and last leg lead into
  const legs = c => segments(g.connections[c.no] || []).map(([p, q], i, all) => ({ p, q, ends: [i === 0 && c.a, i === all.length - 1 && c.b] }));
  for (const [i, c] of shown.entries()) for (const d of shown.slice(i + 1)) {
    const near = limit(c, d);
    for (const x of legs(c)) for (const y of legs(d)) {
      // two connections into the same terminal share the leg that ends there
      if (x.ends.some(e => e && y.ends.includes(e))) continue;
      const [a, z] = horizontal([x.p, x.q]) && horizontal([y.p, y.q]) ? [1, 0] : vertical([x.p, x.q]) && vertical([y.p, y.q]) ? [0, 1] : [];
      if (a === undefined) continue;
      const along = Math.min(Math.max(x.p[z], x.q[z]), Math.max(y.p[z], y.q[z])) - Math.max(Math.min(x.p[z], x.q[z]), Math.min(y.p[z], y.q[z]));
      const apart = Math.abs(x.p[a] - y.p[a]);
      if (along > SLACK && apart < near - 0.5) found.push(`${c.no} and ${d.no}: parallel ${apart.toFixed(1)} px apart, at least ${near} needed`);
    }
  }
  const badges = g.badges.map(x => ({ ...x, ...inside(x) }));
  for (const [i, x] of badges.entries()) {
    for (const y of badges.slice(i + 1)) if (x.no !== y.no && hits(x, y)) found.push(`badges ${x.no} and ${y.no} overlap`);
    for (const [id, part] of Object.entries(g.parts)) for (const r of [part.body, ...part.labels]) if (hits(x, inside(r, SLACK))) found.push(`badge ${x.no} on ${id}`);
    for (const l of g.captions) if (hits(x, inside(l, SLACK))) found.push(`badge ${x.no} on a caption`);
    // the badge of a connection sits on a straight stretch: no bend of any connection under it
    if (x.pill) for (const [no, pts] of Object.entries(g.connections)) for (const p of pts.slice(1, -1)) if (hits(x, { x0: p[0], y0: p[1], x1: p[0], y1: p[1] })) found.push(`badge ${x.no} (${x.x0},${x.y0},${x.x1},${x.y1}) on a bend of ${no} at ${p}`);
  }
  return found;
}

for (const [key, b] of Object.entries(D.boards)) {
  const all = b.steps.flatMap(s => s.connections);
  const views = [{ name: 'all connections', shown: all, go: async page => { await page.goto(`${ORIGIN}/example/${key}/`); if ((b.scope || 'step') !== 'all') await page.locator('[data-role=scope]').selectOption('all'); } },
    ...b.steps.map(s => ({ name: `step ${s.id}`, shown: s.connections, go: async page => { await page.goto(`${ORIGIN}/example/${key}/#${encodeURIComponent(key)}=${encodeURIComponent(s.id)}`); } }))];
  for (const v of (b.scope === 'all' ? views.slice(0, 1) : views)) {
    test(`${key}, ${v.name}: wires are orthogonal, apart, clear of parts, labels and each other's numbers`, async ({ page }) => {
      await v.go(page);
      await expect(page.locator('.ag-board-canvas')).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('[data-connection]')).toHaveCount(v.shown.length);
      const g = await drawn(page);
      expect(problems(key, g, v.shown)).toEqual([]);
    });
  }
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// the prototype renderer is browser code: it only sets window.BuildGuideBoard when loaded, and its router hangs off it
const window = {};
runInNewContext(readFileSync(new URL('../prototype/board-svg.js', import.meta.url), 'utf8'), { window });
// what the script builds lives in its own realm: compare plain copies
const route = (...args) => JSON.parse(JSON.stringify(window.BuildGuideBoard.route(...args)));

const part = (id, x0, y0, x1, y1, side, pins) => ({ id, x0, y0, x1, y1, pins: pins.map(([name, y]) => ({ key: `${id}:${name}`, x: side === 'right' ? x1 : x0, y, side })) });
const left = part('L', 0, 80, 40, 140, 'right', [['1', 100], ['2', 110]]);
const right = part('R', 400, 80, 440, 140, 'left', [['1', 100], ['2', 110]]);
const wall = { id: 'wall', x0: 200, y0: 20, x1: 240, y1: 160, pins: [] };
const orthogonal = pts => pts.every((p, i) => !i || p.x === pts[i - 1].x || p.y === pts[i - 1].y);
const inside = (p, b) => p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1;

test('a wire runs from terminal to terminal in horizontal and vertical legs', () => {
  const [pts] = route([left, right], [{ a: 'L:1', b: 'R:1' }]);
  assert.deepEqual([pts[0], pts.at(-1)], [{ x: 40, y: 100 }, { x: 400, y: 100 }]);
  assert.ok(orthogonal(pts));
});

test('a wire goes round a part that stands in the way, never through it', () => {
  const [pts] = route([left, right, wall], [{ a: 'L:1', b: 'R:1' }]);
  assert.ok(orthogonal(pts) && pts.length > 2);
  for (let i = 1; i < pts.length; i++) for (let t = 0; t <= 1; t += .05) {
    assert.ok(!inside({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }, wall), 'inside the wall');
  }
});

test('wires that share a detour are spread apart, the legs at the terminals stay', () => {
  const paths = route([left, right, wall], [{ a: 'L:1', b: 'R:1' }, { a: 'L:2', b: 'R:2' }]);
  assert.deepEqual(paths.map(p => [p[0].y, p.at(-1).y]), [[100, 100], [110, 110]]);
  const middle = paths.map(p => p.slice(1, -1)).map(p => p.find((q, i) => i && q.y === p[i - 1].y && Math.abs(q.x - p[i - 1].x) > 100).y);
  assert.ok(Math.abs(middle[0] - middle[1]) >= 13, `legs ${middle} apart`);
});

test('a terminal that is walled in gets the straight line, which shows', () => {
  const [pts] = route([left, right, { id: 'pen', x0: 30, y0: 60, x1: 380, y1: 160, pins: [] }, { id: 'pen2', x0: -20, y0: 60, x1: 380, y1: 70, pins: [] }], [{ a: 'L:1', b: 'R:1' }]);
  assert.equal(pts.length, 2);
});

test('no wires, no routes', () => assert.deepEqual(route([left, right], []), []));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// the renderer is browser code: it only sets window.BuildGuideBoard when loaded, and its pure helpers hang off it
const window = {};
runInNewContext(readFileSync(new URL('../src/buildguide-board.js', import.meta.url), 'utf8'), { window });
const { wheelFactor } = window.BuildGuideBoard;

test('wheel zoom: no movement keeps the zoom, up zooms in, down zooms out, both by the same factor', () => {
  assert.equal(wheelFactor(0, 0), 1);
  assert.ok(wheelFactor(-5, 0) > 1 && wheelFactor(5, 0) < 1);
  assert.ok(Math.abs(wheelFactor(-8, 0) * wheelFactor(8, 0) - 1) < 1e-12);
});

test('wheel zoom: a trackpad pinch (small deltas) zooms by its delta, a notch by at most 35 percent', () => {
  assert.ok(Math.abs(wheelFactor(-4, 0) - Math.exp(.04)) < 1e-12);
  for (const [delta, mode] of [[-100, 0], [-3, 1], [-1, 2], [-5000, 0]]) assert.ok(Math.abs(wheelFactor(delta, mode) - Math.exp(.3)) < 1e-12, `${delta} in mode ${mode}`);
  for (const [delta, mode] of [[100, 0], [3, 1], [1, 2]]) assert.ok(Math.abs(wheelFactor(delta, mode) - Math.exp(-.3)) < 1e-12, `${delta} in mode ${mode}`);
});

test('wheel zoom: a line step weighs 16 pixels, a missing mode is pixels', () => {
  assert.ok(Math.abs(wheelFactor(-1, 1) - Math.exp(.16)) < 1e-12);
  assert.equal(wheelFactor(-2), wheelFactor(-2, 0));
});

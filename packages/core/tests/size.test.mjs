import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// gzip budgets in bytes, about 10 % above the size at the time of writing; raise one only on purpose
const BUDGET = {
  'buildguide.js': 11800, // scan, pushState navigation, progress export and import, combined tabs, zoom and full screen: 11757 at the time (10583 before)
  'buildguide-board.js': 9100, // routing retries, number placement, pinch and wheel zoom: 9052 at the time (7441 before)
  'buildguide.css': 5700, // progress bar in three engines and forced colours: 5216 at the time (5070 before)
  'vendor/joint/joint.min.js': 160000,
  'vendor/libavoid/index.js': 19200,
  'vendor/libavoid/libavoid.wasm': 202000,
};
const byName = (a, b) => a.localeCompare(b);
const SRC = new URL('../src/', import.meta.url);
// the shipped files: the three own files and everything under vendor/ except licences and notes
const shipped = readdirSync(SRC, { recursive: true }).filter(f => /^(buildguide(-board)?\.(js|css)|vendor\/.+)$/.test(f) && !/(^|\/)(LICENSE|README\.txt)$/.test(f) && /\.\w+$/.test(f)).sort(byName);

test('every shipped file has a budget', () => assert.deepEqual(shipped, Object.keys(BUDGET).sort(byName)));

for (const [file, max] of Object.entries(BUDGET)) {
  test(`${file} stays within ${max} bytes gzipped`, () => {
    const size = gzipSync(readFileSync(new URL(file, SRC))).length;
    assert.ok(size <= max, `${file}: ${size} bytes gzipped, budget ${max}`);
  });
}

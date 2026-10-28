import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// gzip budgets in bytes, about 10 % above the size at the time of writing; raise one only on purpose
const BUDGET = {
  'buildguide.js': 12700, // scan, pushState navigation, progress export and import, combined tabs, text steps, zoom and full screen: 12002 at the time (11554 before)
  'buildguide-board.js': 9900, // routing retries, number placement, pinch and wheel zoom: 8989 at the time (7441 before)
  'buildguide-assembly.js': 4600, // prototype: STL parse, camera, step tween, keyboard and pointer: 4168 at the time
  'buildguide.css': 6300, // text steps: 5757 at the time (5567 before), progress bar in three engines and forced colours before that
  'vendor/joint/joint.min.js': 160000,
  'vendor/libavoid/index.js': 19200,
  'vendor/libavoid/libavoid.wasm': 202000,
};
const byName = (a, b) => a.localeCompare(b);
const SRC = new URL('../src/', import.meta.url);
// the shipped files: the own files and everything under vendor/ except licences and notes
const shipped = readdirSync(SRC, { recursive: true }).filter(f => /^(buildguide(-board|-assembly)?\.(js|css)|vendor\/.+)$/.test(f) && !/(^|\/)(LICENSE|README\.txt)$/.test(f) && /\.\w+$/.test(f)).sort(byName);

test('every shipped file has a budget', () => assert.deepEqual(shipped, Object.keys(BUDGET).sort(byName)));

for (const [file, max] of Object.entries(BUDGET)) {
  test(`${file} stays within ${max} bytes gzipped`, () => {
    const size = gzipSync(readFileSync(new URL(file, SRC))).length;
    assert.ok(size <= max, `${file}: ${size} bytes gzipped, budget ${max}`);
  });
}

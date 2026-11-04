import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// gzip budgets in bytes of the shipped files (lib/: the emitted scripts without their comments, the stylesheet, the third-party files);
// raise one only on purpose
const BUDGET = {
  'buildguide.js': 12700, // scan, pushState navigation, the loader of buildguide-<name>.js, text steps, zoom and full screen and the English string table: 10639 emitted at the time (10395 before, with the tabs and without the table)
  'buildguide-progress.js': 850, // export, import, reset and undo of progress: 576 emitted at the time, its messages in the string table (632 before)
  'buildguide-zoom.js': 1000, // the dialog of an enlarged BOM image: 674 emitted at the time (906 as the hand-written script)
  'buildguide-export.js': 1090, // CSV of the BOM and of boards, the print list of a board: 816 emitted at the time (988 as the hand-written script)
  'buildguide-tabs.js': 1600, // the combined guide: tabs over one panel and the guide pair in the hash: 1440 emitted at the time
  'buildguide-board.js': 9900, // routing retries, number placement, pinch and wheel zoom: 7504 emitted at the time (8989 as the hand-written script)
  'buildguide.css': 6300, // text steps: 5757 at the time (5567 before), progress bar in three engines and forced colours before that
  'vendor/joint/joint.min.js': 160000,
  'vendor/libavoid/index.js': 19200,
  'vendor/libavoid/libavoid.wasm': 202000,
};
const byName = (a, b) => a.localeCompare(b);
const SRC = new URL('../lib/', import.meta.url);
// the shipped files: the own files (buildguide.js, buildguide.css, buildguide-<name>.js) and everything under vendor/ except licences and notes;
// the declarations (.d.ts) and the check CLI are not loaded by a page
const shipped = readdirSync(SRC, { recursive: true }).filter(f => /^(buildguide(-[a-z]+)?\.(js|css)|vendor\/.+)$/.test(f) && !/(^|\/)(LICENSE|README\.txt)$/.test(f) && /\.\w+$/.test(f)).sort(byName);

test('every shipped file has a budget', () => assert.deepEqual(shipped, Object.keys(BUDGET).sort(byName)));

for (const [file, max] of Object.entries(BUDGET)) {
  test(`${file} stays within ${max} bytes gzipped`, () => {
    const size = gzipSync(readFileSync(new URL(file, SRC))).length;
    assert.ok(size <= max, `${file}: ${size} bytes gzipped, budget ${max}`);
  });
}

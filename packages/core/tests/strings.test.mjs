import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { STRING_KEYS } from '../lib/buildguide-check.mjs';

// the shipped German table as a page gets it: the emitted classic script run against a bare window
const window = {};
runInNewContext(readFileSync(new URL('../lib/buildguide-de.js', import.meta.url), 'utf8'), { window });
const { de } = window.BuildGuideModules;
// the {name} placeholders the components fill in, by key (buildguide*.ts); every other key gets none
const VARS = {
  checked: ['n', 'm'], allChecked: ['what'], whatChecked: ['what'], filter: ['filter'], components: ['n', 'm'], enlarge: ['name'], usesParts: ['parts'],
  stepsOf: ['title'], allOf: ['title', 'lower'], connection: ['no'], boardLabel: ['name'], connectionLabel: ['no', 'a', 'b'], ringAt: ['a'], unknown: ['name'],
};

test('the German file names every key but the plugins\' noScript, each with a text', () => {
  assert.deepEqual(Object.keys(de), STRING_KEYS.filter(k => k !== 'noScript'));
  for (const [key, text] of Object.entries(de)) assert.ok(typeof text === 'string' && text.trim(), key);
});

test('the German texts use only the placeholders the components fill in', () => {
  for (const [key, text] of Object.entries(de)) {
    const used = [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    assert.deepEqual(used.filter(name => !(VARS[key] ?? []).includes(name)), [], key);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const validate = new Ajv({ allErrors: true }).compile(read('../schema/buildguide.schema.json'));

test('the example guide matches the schema', () => {
  assert.equal(validate(read('../example/guide.json')), true, JSON.stringify(validate.errors));
});

test('the schema rejects a board without title and a misspelt key', () => {
  const guide = read('../example/guide.json');
  delete guide.boards.tubing.title;
  guide.bom.items[0].quantity = 1;
  assert.equal(validate(guide), false);
  assert.deepEqual(validate.errors.map(e => e.instancePath).sort((x, y) => x.localeCompare(y)), ['/boards/tubing', '/bom/items/0']);
});

test('the schema accepts a step note and rejects one that is not text', () => {
  const guide = read('../example/guide.json');
  guide.boards.wiring.steps[0].note = 'Unplug the supply';
  assert.equal(validate(guide), true);
  guide.boards.wiring.steps[0].note = 1;
  assert.equal(validate(guide), false);
  assert.deepEqual(validate.errors.map(e => e.instancePath), ['/boards/wiring/steps/0/note']);
});

test('the schema accepts a leveled note and rejects an unknown level, a missing text and a stray key', () => {
  const guide = read('../example/guide.json');
  const step = guide.boards.wiring.steps[0];
  assert.deepEqual(Object.keys(step.note), ['level', 'text']);
  assert.equal(validate(guide), true);
  for (const [note, path] of [[{ level: 'danger', text: 'x' }, '/note/level'], [{ level: 'note' }, '/note'], [{ level: 'note', text: 'x', icon: 1 }, '/note']]) {
    step.note = note;
    assert.equal(validate(guide), false);
    assert.deepEqual(validate.errors.map(e => e.instancePath), ['/boards/wiring/steps/0' + path]);
  }
});

test('the schema accepts the steps and rejects a step without title, a stray key and a note that is not text', () => {
  const guide = read('../example/guide.json');
  assert.equal(validate(guide), true);
  const [first] = guide.steps.items;
  for (const [change, path] of [[s => { delete s.title; }, ''], [s => { s.image = 'x.png'; }, ''], [s => { s.note = 1; }, '/note'], [s => { s.note = { level: 'danger', text: 'x' }; }, '/note/level'], [s => { s.parts = 'psu'; }, '/parts']]) {
    const copy = structuredClone(guide), step = copy.steps.items[0];
    change(step);
    assert.equal(validate(copy), false);
    assert.deepEqual(validate.errors.map(e => e.instancePath), ['/steps/items/0' + path]);
  }
  assert.deepEqual(Object.keys(first).sort((x, y) => x.localeCompare(y)), ['id', 'parts', 'text', 'title']);
});

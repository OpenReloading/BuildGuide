import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const validate = new Ajv({ allErrors: true }).compile(read('../schema/buildguide.schema.json'));

test('the example guide matches the schema', () => {
  assert.equal(validate(read('../example/guide.json')), true, JSON.stringify(validate.errors));
});

test('the schema rejects an unknown view and a misspelt key', () => {
  const guide = read('../example/guide.json');
  guide.pages[0].view = 'video';
  guide.bom.items[0].quantity = 1;
  assert.equal(validate(guide), false);
  assert.deepEqual(validate.errors.map(e => e.instancePath).sort((x, y) => x.localeCompare(y)), ['/bom/items/0', '/pages/0/view']);
});

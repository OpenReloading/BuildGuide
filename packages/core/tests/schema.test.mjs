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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import { check } from '../src/buildguide-check.mjs';

// the small examples of the docs (one component each): they must stay valid
const validate = new Ajv({ allErrors: true }).compile(JSON.parse(readFileSync(new URL('../schema/buildguide.schema.json', import.meta.url))));
const folder = new URL('../example/minimal/', import.meta.url);
const names = readdirSync(folder).filter(f => f.endsWith('.json'));

test('there is one minimal example per component', () => assert.deepEqual(names.sort((a, b) => a.localeCompare(b)), ['bom.json', 'tubing.json', 'wiring.json']));
for (const name of names) {
  test(`minimal/${name} matches the schema and the check`, () => {
    const data = JSON.parse(readFileSync(new URL(name, folder)));
    assert.equal(validate(data), true, JSON.stringify(validate.errors));
    assert.deepEqual(check(data), []);
  });
}

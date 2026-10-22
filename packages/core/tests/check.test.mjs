import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { check } from '../src/buildguide-check.mjs';

// shared with the MkDocs plugin's Python check: each fixture is a guide and the problem lines it must give
const fixtures = new URL('./fixtures/', import.meta.url);
for (const name of readdirSync(fixtures).filter((f) => f.endsWith('.json'))) {
  test(`fixture ${name}`, () => {
    const { guide, problems } = JSON.parse(readFileSync(new URL(name, fixtures)));
    assert.deepEqual(check(guide), problems);
  });
}

test('the example guide has no problems', () => {
  const data = JSON.parse(readFileSync(new URL('../example/guide.json', import.meta.url)));
  assert.deepEqual(check(data), []);
});

test('command line: exit 1 and one line per problem, exit 0 when clean', () => {
  const cli = new URL('../src/buildguide-check.mjs', import.meta.url).pathname;
  const example = new URL('../example/guide.json', import.meta.url).pathname;
  assert.equal(execFileSync('node', [cli, example], { encoding: 'utf8' }), '');
  const bad = new URL('./bad-guide.json', import.meta.url).pathname;
  let failed;
  try { execFileSync('node', [cli, bad], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { failed = e; }
  assert.equal(failed.status, 1);
  assert.equal(failed.stderr, 'bad-guide.json: storage: missing\n');
});

test('command line: runs through a symlink, exit 2 without files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bg-')), link = join(dir, 'check.mjs');
  symlinkSync(new URL('../src/buildguide-check.mjs', import.meta.url).pathname, link);
  let failed;
  try { execFileSync('node', [link, new URL('./bad-guide.json', import.meta.url).pathname], { stdio: 'pipe' }); } catch (e) { failed = e; }
  assert.equal(failed?.status, 1);
  failed = null;
  try { execFileSync('node', [link], { stdio: 'pipe' }); } catch (e) { failed = e; }
  assert.equal(failed?.status, 2);
});

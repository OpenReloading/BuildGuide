import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { check } from '../src/buildguide-check.mjs';

// smallest guide that uses every view: two parts, one wire, one BOM line
const guide = () => ({
  storage: 'test-guide',
  pages: [
    { id: 'intro', title: 'Introduction', view: 'intro' },
    { id: 'bom', title: 'BOM', view: 'bom' },
    { id: 'wiring', title: 'Wiring', view: 'board', board: 'wiring' },
  ],
  intro: { title: 'Kit', lead: 'A kit.', sections: [] },
  bom: { items: [{ id: 'psu', group: 'Power', part: 'Power supply', spec: '12 V', qty: 1 }] },
  boards: {
    wiring: {
      size: [400, 300],
      colors: { RD: { line: '#c00', outline: '#600' } },
      parts: {
        PSU: { name: 'Power supply', at: [20, 20], size: [80, 60], ports: { right: ['+', '-'] } },
        LAMP: { name: 'Lamp', at: [250, 20], size: [80, 60], ports: { left: ['1', '2'] } },
      },
      steps: [{ id: 'A', title: 'Power', connections: [{ no: '1', a: 'PSU:+', b: 'LAMP:1', color: 'RD' }] }],
    },
  },
});

test('a complete guide has no problems', () => {
  assert.deepEqual(check(guide()), []);
});

test('the example guide has no problems', () => {
  const data = JSON.parse(readFileSync(new URL('../example/guide.json', import.meta.url)));
  assert.deepEqual(check(data), []);
});

test('missing storage key and empty pages', () => {
  const g = guide();
  delete g.storage;
  g.pages = [];
  assert.deepEqual(check(g), ['storage: missing', 'pages: none']);
});

test('page with an unknown view, a missing board and a repeated id', () => {
  const g = guide();
  g.pages.push({ id: 'bom', title: 'Again', view: 'bom' }, { id: 'x', title: 'X', view: 'video' }, { id: 'air', title: 'Air', view: 'board', board: 'tubing' });
  assert.deepEqual(check(g), ['pages: id bom used twice', 'pages.x: unknown view video', 'pages.air: no board tubing']);
});

test('intro and BOM pages need their data', () => {
  const g = guide();
  delete g.intro;
  delete g.bom;
  assert.deepEqual(check(g), ['pages.intro: intro missing', 'pages.bom: bom missing']);
});

test('BOM lines need an id once, a part and a quantity', () => {
  const g = guide();
  g.bom.items.push({ id: 'psu', group: 'Power', part: '', spec: '' });
  assert.deepEqual(check(g), ['bom: id psu used twice', 'bom.psu: part missing', 'bom.psu: qty missing']);
});

test('a connection to an unknown part or terminal', () => {
  const g = guide();
  g.boards.wiring.steps[0].connections.push({ no: '2', a: 'PSU:3', b: 'FAN:1', color: 'RD' });
  assert.deepEqual(check(g), ['wiring 2: PSU has no terminal 3', 'wiring 2: no part FAN']);
});

test('a connection end without a terminal', () => {
  const g = guide();
  g.boards.wiring.steps[0].connections[0].b = 'LAMP';
  assert.deepEqual(check(g), ['wiring 1: end LAMP is not PART:terminal']);
});

test('unknown colour and a repeated connection number', () => {
  const g = guide();
  g.boards.wiring.steps[0].connections.push({ no: '1', a: 'PSU:-', b: 'LAMP:2', color: 'BK' });
  assert.deepEqual(check(g), ['wiring: connection 1 used twice', 'wiring 1: unknown colour BK']);
});

test('repeated step id', () => {
  const g = guide();
  g.boards.wiring.steps.push({ id: 'A', title: 'Again', connections: [{ no: '2', a: 'PSU:-', b: 'LAMP:2', color: 'RD' }] });
  assert.deepEqual(check(g), ['wiring: step A used twice']);
});

test('more connections on one terminal than the board allows, exempt kinds and colours not counted', () => {
  const g = guide();
  const w = g.boards.wiring;
  w.rules = { perTerminal: 2, exempt: { kinds: ['join'], colors: ['DIODE'] } };
  w.colors.DIODE = { line: '#ddd', outline: '#111', diode: true };
  w.parts.J = { kind: 'join', name: 'Join', at: [150, 150], size: [40, 20], ports: { top: ['1'] } };
  w.steps[0].connections.push(
    { no: '2', a: 'PSU:+', b: 'J:1', color: 'RD' },
    { no: '3', a: 'LAMP:1', b: 'LAMP:2', color: 'DIODE' },
    { no: '4', a: 'J:1', b: 'LAMP:2', color: 'RD' },
    { no: '5', a: 'J:1', b: 'LAMP:2', color: 'RD' },
  );
  assert.deepEqual(check(g), []);
  w.steps[0].connections.push({ no: '6', a: 'PSU:+', b: 'J:1', color: 'RD' });
  assert.deepEqual(check(g), ['wiring: 3 connections on PSU:+ (1, 2, 6), at most 2']);
});

test('board next must name a page', () => {
  const g = guide();
  g.boards.wiring.next = 'tubing';
  assert.deepEqual(check(g), ['wiring: next page tubing does not exist']);
});

test('command line: exit 1 and one line per problem, exit 0 when clean', () => {
  const cli = new URL('../src/buildguide-check.mjs', import.meta.url).pathname;
  const example = new URL('../example/guide.json', import.meta.url).pathname;
  assert.equal(execFileSync('node', [cli, example], { encoding: 'utf8' }), '');
  const bad = new URL('./bad-guide.json', import.meta.url).pathname;
  let failed;
  try { execFileSync('node', [cli, bad], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { failed = e; }
  assert.equal(failed.status, 1);
  assert.equal(failed.stderr, 'bad-guide.json: storage: missing\nbad-guide.json: pages: none\n');
});

test('board ids: repeated terminals, a part named like a connection, a diode across two parts', () => {
  const g = guide(), w = g.boards.wiring;
  w.colors.DIODE = { line: '#ccc', outline: '#111', diode: true };
  w.parts.LAMP.ports.right = ['1'];
  w.parts.c1 = { at: [150, 200], size: [40, 40], ports: { top: ['x'] } };
  w.steps[0].connections.push({ no: '2', a: 'PSU:-', b: 'LAMP:2', color: 'DIODE' });
  assert.deepEqual(check(g), ['wiring: part LAMP repeats terminal 1', 'wiring: part c1 clashes with connection 1', 'wiring 2: diode ends on two parts']);
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

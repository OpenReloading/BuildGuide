#!/usr/bin/env node
// Checks a guide's data before it is published: BOM lines, text steps, and every board connection
// against its parts, terminals, colours and the board's per-terminal limit.
// Use: node buildguide-check.mjs guide.json [...]   (exit 1 and one line per problem)
import { readFileSync, realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const repeated = (values) => [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];

function checkBoard(key, board) {
  const found = [];
  if (!board.title) found.push(`${key}: title missing`);
  const parts = board.parts || {}, colors = board.colors || {};
  const has = (object, name) => Object.hasOwn(object, name);
  const steps = board.steps || [];
  const connections = steps.flatMap((s) => s.connections || []);
  for (const id of repeated(steps.map((s) => s.id))) found.push(`${key}: step ${id} used twice`);
  for (const s of steps) if (s.note && typeof s.note === 'object' && !['note', 'caution', 'warning'].includes(s.note.level)) found.push(`${key}: step ${s.id} note level ${s.note.level} unknown`);
  for (const no of repeated(connections.map((c) => c.no))) found.push(`${key}: connection ${no} used twice`);
  for (const [id, part] of Object.entries(parts)) {
    for (const pin of repeated(Object.values(part.ports || {}).flat())) found.push(`${key}: part ${id} repeats terminal ${pin}`);
  }
  // the board draws connection n as cell 'c' + n, next to the parts' own ids
  for (const c of connections) if (has(parts, 'c' + c.no)) found.push(`${key}: part c${c.no} clashes with connection ${c.no}`);
  const ends = {};
  const exempt = board.rules?.exempt || {};
  for (const c of connections) {
    for (const end of [c.a, c.b]) {
      const at = String(end).indexOf(':');
      if (at < 1) { found.push(`${key} ${c.no}: end ${end} is not PART:terminal`); continue; }
      const id = end.slice(0, at), pin = end.slice(at + 1), part = has(parts, id) ? parts[id] : undefined;
      if (!part) { found.push(`${key} ${c.no}: no part ${id}`); continue; }
      if (!Object.values(part.ports || {}).flat().includes(pin)) { found.push(`${key} ${c.no}: ${id} has no terminal ${pin}`); continue; }
      if (!(exempt.kinds || []).includes(part.kind) && !(exempt.colors || []).includes(c.color)) { ends[end] ||= []; ends[end].push(c.no); }
    }
    if (!has(colors, c.color)) found.push(`${key} ${c.no}: unknown colour ${c.color}`);
    else if (colors[c.color].diode && String(c.a).split(':')[0] !== String(c.b).split(':')[0]) found.push(`${key} ${c.no}: diode ends on two parts`);
  }
  const limit = board.rules?.perTerminal;
  if (limit) for (const [end, nos] of Object.entries(ends)) {
    if (nos.length > limit) found.push(`${key}: ${nos.length} connections on ${end} (${nos.join(', ')}), at most ${limit}`);
  }
  return found;
}

export function check(data) {
  const found = [];
  if (!data.storage) found.push('storage: missing');
  const items = data.bom?.items || [];
  for (const id of repeated(items.map((i) => i.id))) found.push(`bom: id ${id} used twice`);
  for (const i of items) {
    if (!i.part) found.push(`bom.${i.id}: part missing`);
    if (i.qty === undefined || i.qty === '') found.push(`bom.${i.id}: qty missing`);
  }
  const steps = data.steps?.items || [], bomIds = items.map((i) => i.id);
  for (const id of repeated(steps.map((s) => s.id))) found.push(`steps: id ${id} used twice`);
  for (const s of steps) {
    if (!s.title) found.push(`steps.${s.id}: title missing`);
    if (s.note && typeof s.note === 'object' && !['note', 'caution', 'warning'].includes(s.note.level)) found.push(`steps.${s.id}: note level ${s.note.level} unknown`);
    for (const id of s.parts || []) if (!bomIds.includes(id)) found.push(`steps.${s.id}: no bom item ${id}`);
  }
  const boards = Object.entries(data.boards || {});
  for (const [key, board] of boards) found.push(...checkBoard(key, board));
  // tick keys start with the prefix: boards, the BOM ('bom') and the text steps ('step') must not share one
  const prefixes = boards.map(([key, board]) => [key, board.prefix || key]);
  for (const prefix of repeated(prefixes.map(([, p]) => p))) found.push(`boards: prefix ${prefix} used twice`);
  for (const [key, prefix] of prefixes) if (prefix === 'bom') found.push(`${key}: prefix bom is taken by the BOM`);
  for (const [key, prefix] of prefixes) if (prefix === 'step') found.push(`${key}: prefix step is taken by the steps`);
  // the combined guide's tab 'steps' is the text steps, not a board
  if (data.steps && boards.some(([key]) => key === 'steps')) found.push('boards: key steps is taken by the steps');
  return found;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  if (process.argv.length < 3) { process.stderr.write('Use: buildguide-check.mjs guide.json [...]\n'); process.exit(2); }
  let failed = false;
  for (const file of process.argv.slice(2)) {
    for (const problem of check(JSON.parse(readFileSync(file, 'utf8')))) {
      process.stderr.write(`${basename(file)}: ${problem}\n`);
      failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
}

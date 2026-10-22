#!/usr/bin/env node
// Checks a guide's data before it is published: BOM lines, and every board connection
// against its parts, terminals, colours and the board's per-terminal limit.
// Use: node buildguide-check.mjs guide.json [...]   (exit 1 and one line per problem)
import { readFileSync, realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const repeated = (values) => [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];

function checkBoard(key, board) {
  const found = [];
  const parts = board.parts || {}, colors = board.colors || {};
  const steps = board.steps || [];
  const connections = steps.flatMap((s) => s.connections || []);
  for (const id of repeated(steps.map((s) => s.id))) found.push(`${key}: step ${id} used twice`);
  for (const no of repeated(connections.map((c) => c.no))) found.push(`${key}: connection ${no} used twice`);
  for (const [id, part] of Object.entries(parts)) {
    for (const pin of repeated(Object.values(part.ports || {}).flat())) found.push(`${key}: part ${id} repeats terminal ${pin}`);
  }
  // the board draws connection n as cell 'c' + n, next to the parts' own ids
  for (const c of connections) if (('c' + c.no) in parts) found.push(`${key}: part c${c.no} clashes with connection ${c.no}`);
  const ends = {};
  const exempt = board.rules?.exempt || {};
  for (const c of connections) {
    for (const end of [c.a, c.b]) {
      const at = String(end).indexOf(':');
      if (at < 1) { found.push(`${key} ${c.no}: end ${end} is not PART:terminal`); continue; }
      const id = end.slice(0, at), pin = end.slice(at + 1), part = parts[id];
      if (!part) { found.push(`${key} ${c.no}: no part ${id}`); continue; }
      if (!Object.values(part.ports || {}).flat().includes(pin)) { found.push(`${key} ${c.no}: ${id} has no terminal ${pin}`); continue; }
      if (!(exempt.kinds || []).includes(part.kind) && !(exempt.colors || []).includes(c.color)) { ends[end] ||= []; ends[end].push(c.no); }
    }
    if (!(c.color in colors)) found.push(`${key} ${c.no}: unknown colour ${c.color}`);
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
  for (const [key, board] of Object.entries(data.boards || {})) found.push(...checkBoard(key, board));
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

#!/usr/bin/env node
// Checks a guide's data before it is published: BOM lines, text steps, and every board connection
// against its parts, terminals, colours and the board's per-terminal limit.
// Use: node buildguide-check.mjs guide.json [...]   (exit 1 and one line per problem)
import { readFileSync, realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// The guide data, as schema/buildguide.schema.json describes it

/** `[x, y]` or `[width, height]` in board units. */
export type Point = [number, number];
/** The note of a step: plain text or text with a level. */
export type Note = string | { level: 'note' | 'caution' | 'warning'; text: string };
/** One line of the BOM; its tick key is `bom-<id>:<part>`. */
export interface BomItem { id: string; group: string; part: string; spec?: string; qty: number | string; image?: string; imageAlt?: string; link?: string }
export interface Bom { note?: string; export?: string; linkLabel?: string; items: BomItem[] }
/** One text step; its tick key is `step-<id>`. */
export interface TextStep { id: string; title: string; text?: string; note?: Note; parts?: string[] }
export interface TextSteps { title?: string; note?: string; items: TextStep[] }
/** One wire or tube between two ends written `PART:terminal`; its tick key is `<prefix>-<no>:<a>:<b>`. */
export interface Connection { no: string; a: string; b: string; color: string; la?: string; lb?: string; cable?: string; size?: string }
export interface BoardStep { id: string; title: string; note?: Note; connections: Connection[] }
export interface ColorCode { line: string; outline: string; swatch?: string; width?: number; diode?: boolean }
export interface PartKind {
  fill?: string; stroke?: string; rx?: number; round?: boolean; inset?: number; offset?: { top?: number; bottom?: number };
  pins?: Record<string, string>; band?: boolean | string; diodeLoop?: 'around';
}
export type Side = 'left' | 'right' | 'top' | 'bottom';
export interface Part { kind?: string; name?: string; sub?: string; color?: string; at: Point; size: Point; ports: Partial<Record<Side, string[]>> }
export interface Area { title: string; at: Point; size: Point; color?: string; frame?: boolean; glands?: [number, string][] }
/** One wiring or tubing board. */
export interface Board {
  title: string;
  label?: string;
  size: Point;
  prefix?: string;
  scope?: 'step' | 'all';
  single?: boolean;
  listAll?: boolean;
  listColor?: boolean;
  legend?: (string | { text: string; key?: 'diode' })[];
  colors: Record<string, ColorCode>;
  kinds?: Record<string, PartKind>;
  rules?: { perTerminal?: number; exempt?: { kinds?: string[]; colors?: string[] } };
  areas?: Record<string, Area>;
  props?: { name: string; at: Point; size: Point }[];
  parts: Record<string, Part>;
  steps: BoardStep[];
}
/** One guide: the data of the BOM, the text steps and the boards. */
export interface Guide {
  $schema?: string;
  storage: string;
  bom?: Bom;
  steps?: TextSteps;
  boards?: Record<string, Board>;
}

const repeated = <T,>(values: T[]): T[] => [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
const has = (object: object, name: string): boolean => Object.hasOwn(object, name);
const LEVELS: unknown[] = ['note', 'caution', 'warning'];
// a note object with a level the schema does not know (the check also runs on data no schema has seen)
const badLevel = (note: Note | undefined): note is Exclude<Note, string> => !!note && typeof note === 'object' && !LEVELS.includes(note.level);

function checkBoard(key: string, board: Board): string[] {
  const found: string[] = [];
  if (!board.title) found.push(`${key}: title missing`);
  const parts = board.parts || {}, colors = board.colors || {};
  const steps = board.steps || [];
  const connections = steps.flatMap((s) => s.connections || []);
  for (const id of repeated(steps.map((s) => s.id))) found.push(`${key}: step ${id} used twice`);
  for (const s of steps) if (badLevel(s.note)) found.push(`${key}: step ${s.id} note level ${s.note.level} unknown`);
  for (const no of repeated(connections.map((c) => c.no))) found.push(`${key}: connection ${no} used twice`);
  for (const [id, part] of Object.entries(parts)) {
    for (const pin of repeated(Object.values(part.ports || {}).flat())) found.push(`${key}: part ${id} repeats terminal ${pin}`);
  }
  // the board draws connection n as cell 'c' + n, next to the parts' own ids
  for (const c of connections) if (has(parts, `c${c.no}`)) found.push(`${key}: part c${c.no} clashes with connection ${c.no}`);
  const ends: Record<string, string[]> = {};
  const exempt = board.rules?.exempt || {}, exemptKinds: (string | undefined)[] = exempt.kinds || [];
  for (const c of connections) {
    for (const end of [c.a, c.b]) {
      const at = String(end).indexOf(':');
      if (at < 1) { found.push(`${key} ${c.no}: end ${end} is not PART:terminal`); continue; }
      const id = end.slice(0, at), pin = end.slice(at + 1), part = has(parts, id) ? parts[id] : undefined;
      if (!part) { found.push(`${key} ${c.no}: no part ${id}`); continue; }
      if (!Object.values(part.ports || {}).flat().includes(pin)) { found.push(`${key} ${c.no}: ${id} has no terminal ${pin}`); continue; }
      if (!exemptKinds.includes(part.kind) && !(exempt.colors || []).includes(c.color)) ends[end] = [...(ends[end] ?? []), c.no];
    }
    const color = has(colors, c.color) ? colors[c.color] : undefined;
    if (!color) found.push(`${key} ${c.no}: unknown colour ${c.color}`);
    else if (color.diode && String(c.a).split(':')[0] !== String(c.b).split(':')[0]) found.push(`${key} ${c.no}: diode ends on two parts`);
  }
  const limit = board.rules?.perTerminal;
  if (limit) for (const [end, nos] of Object.entries(ends)) {
    if (nos.length > limit) found.push(`${key}: ${nos.length} connections on ${end} (${nos.join(', ')}), at most ${limit}`);
  }
  return found;
}

/** The problems of a guide that the schema cannot find, one line each; an empty list when there are none. */
export function check(data: Guide): string[] {
  const found: string[] = [];
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
    if (badLevel(s.note)) found.push(`steps.${s.id}: note level ${s.note.level} unknown`);
    for (const id of s.parts || []) if (!bomIds.includes(id)) found.push(`steps.${s.id}: no bom item ${id}`);
  }
  const boards = Object.entries(data.boards || {});
  for (const [key, board] of boards) found.push(...checkBoard(key, board));
  // tick keys start with the prefix: boards, the BOM ('bom') and the text steps ('step') must not share one
  const prefixes = boards.map(([key, board]) => [key, board.prefix || key] as const);
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
    // the data is not validated against the schema here: check() reads it as the schema describes it
    for (const problem of check(JSON.parse(readFileSync(file, 'utf8')) as Guide)) {
      process.stderr.write(`${basename(file)}: ${problem}\n`);
      failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
}

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fetched, filesTable, precacheLines, preprocess, ROOT, SRC, schemaTable, snippet, table, tokenTable, walk } from './markdown.mts'

const rows = (t: string) => t.split('\n').slice(2).map((line) => line.slice(2, -2).split(' | ').map((cell) => cell.replace(/^`|`$/g, '')))
const byPath = (t: string) => Object.fromEntries(rows(t).map((r) => [r[0], r]))

test('snippets: a whole file, a dedented section without nested markers, a line range, indented like the line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'snippet-'))
  writeFileSync(join(dir, 'a.md'), 'one\n<!-- --8<-- [start:s] -->\n   two\n   <!-- --8<-- [start:t] -->\n     three\n   <!-- --8<-- [end:t] -->\n<!-- --8<-- [end:s] -->\n')
  assert.equal(snippet('a.md:s', dir), 'two\n  three')
  assert.equal(snippet('a.md:t', dir), 'three')
  assert.equal(snippet('a.md:1:1', dir), 'one')
  assert.equal(snippet('a.md', dir), 'one\n   two\n     three')
  assert.throws(() => snippet('a.md:nothing', dir), /no section nothing/)
  assert.throws(() => snippet('missing.md', dir), /ENOENT/)
  // a real one, through the preprocessor: the README's install command, indented inside a list
  const page = preprocess({ fileContent: 'x\n  --8<-- "packages/core/README.md:about"\ny' })
  assert.match(page, /^x\n {2}Browser components .*\ny$/s)
  assert.doesNotMatch(page, /--8<--/)
})

test('board table walks maps, arrays and refs', () => {
  const r = byPath(schemaTable('board'))
  assert.deepEqual(r['boards.<key>.title']?.slice(1, 3), ['string', 'yes'])
  assert.equal(r['boards.<key>.size']?.[1], 'array of number') // $ref to point, with the board's own description
  assert.match(r['boards.<key>.size']?.[3] ?? '', /drawing width/)
  assert.equal(r['boards.<key>.steps[].connections[].no']?.[1], 'string')
  assert.equal(r['boards.<key>.legend[].text']?.[2], 'yes') // object alternative of a oneOf item
  assert.match(r['boards.<key>.scope']?.[1] ?? '', /^one of/)
  assert.ok(!r['boards.<key>.steps[]'] && r['boards.<key>.steps']) // no second row for the list's elements
  assert.equal(r['boards.<key>.areas.<key>.glands']?.[1], 'array of array of [number, string]')
})

test('steps table walks the items and the shared note; MDX characters in a meaning are escaped', () => {
  const r = byPath(schemaTable('steps'))
  assert.equal(r['steps.items']?.[2], 'yes')
  assert.equal(r['steps.items[].id']?.[2], 'yes')
  assert.match(r['steps.items[].id']?.[3] ?? '', /step-\\<id>/)
  assert.equal(r['steps.items[].note']?.[1], 'string or object') // $ref to the note shared with a board's steps
  assert.match(r['steps.items[].note.level']?.[1] ?? '', /^one of/)
  assert.equal(r['steps.items[].parts']?.[1], 'array of string')
})

test('root and BOM tables; an unknown table or a node without type fails', () => {
  assert.deepEqual(rows(schemaTable('root')).map((r) => r[0]), ['$schema', 'storage', 'bom', 'steps', 'boards'])
  const bom = byPath(schemaTable('bom'))
  assert.equal(bom['bom.items[].qty']?.[1], 'integer or string')
  assert.equal(bom['bom.items[].id']?.[2], 'yes')
  assert.throws(() => schemaTable('nothing'), /nothing/)
  const schema = { type: 'object', properties: { x: { description: 'anything' } } }
  assert.throws(() => walk(schema, schema, 'root', true), /root\.x/)
})

test('a pipe is escaped in and outside code, braces and < only outside', () => {
  assert.equal(table(['A'], [['`a|{b}` c|{d}<e>']]).split('\n')[2], '| `a\\|{b}` c\\|\\{d\\}\\<e> |')
})

test('token table lists every colour with both schemes, and fails on one it cannot read', () => {
  assert.deepEqual(rows(tokenTable(':root{--ag-ink:light-dark(#111, #eee);\n --ag-page:light-dark(#fff, #000);}')), [
    ['--ag-ink', '#111', '#eee'],
    ['--ag-page', '#fff', '#000'],
  ])
  assert.ok(rows(preprocess({ fileContent: '<!-- generated: tokens -->' })).length > 20)
  assert.throws(() => tokenTable('a{}'))
  assert.throws(() => tokenTable(':root{--ag-ink:light-dark(#111, #eee); --ag-x:light-dark(rgb(0,0,0), #000);}'), /light-dark/)
})

test('files table and precache list the shipped files with sizes, licences and notes left out', () => {
  const dir = mkdtempSync(join(tmpdir(), 'core-'))
  mkdirSync(join(dir, 'libs/lib'), { recursive: true })
  for (const name of ['buildguide.css', 'buildguide.js', 'buildguide-board.js', 'buildguide-progress.js', 'libs/lib/a.wasm', 'libs/lib/LICENSE', 'libs/README.txt'])
    writeFileSync(join(dir, name), 'x'.repeat(100))
  const r = rows(filesTable(dir))
  assert.deepEqual(r.map((row) => row[0]), ['buildguide.css', 'buildguide.js', 'buildguide-board.js', 'buildguide-progress.js', 'libs/lib/a.wasm'])
  assert.equal(r[0]?.[1], '100')
  assert.ok(Number(r[0]?.[2]) < 100)
  const real = fetched(SRC)
  assert.ok(real.some((name) => name.endsWith('/libavoid.wasm')))
  assert.deepEqual(real.slice(0, 3), ['buildguide.css', 'buildguide.js', 'buildguide-board.js'])
  const modules = real.filter((name) => !name.includes('/')).slice(3) // every buildguide-<name>.js on demand, sorted
  assert.ok(modules.includes('buildguide-progress.js'))
  assert.deepEqual(modules, [...modules].sort())
  const lines = precacheLines(SRC).split('\n')
  assert.equal(lines[0], "  '/assets/buildguide-<version>/buildguide.css',")
  assert.equal(lines.length, real.length)
})

test('markers are replaced, unknown ones fail; the root is the repository', () => {
  const page = preprocess({ fileContent: 'before\n<!-- generated: tokens -->\nafter' })
  assert.doesNotMatch(page, /<!--/)
  assert.match(page, /\| `--ag-ink` \|/)
  assert.match(preprocess({ fileContent: '<!-- generated: files -->' }), /\| `buildguide\.js` \|/)
  assert.throws(() => preprocess({ fileContent: '<!-- generated: schema nothing -->' }), /nothing/)
  assert.match(snippet('package.json:2:2', ROOT), /buildguide-monorepo/)
})

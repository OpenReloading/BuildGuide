// The Markdown of the docs pages before MDX reads it (markdown.preprocessor in docusaurus.config.ts), so the pages
// follow the files they describe:
// - a line `--8<-- "path"`, `--8<-- "path:name"` or `--8<-- "path:from:to"` takes that file, the lines between
//   `--8<-- [start:name]` and `--8<-- [end:name]` (dedented), or lines from to to; paths are from the repository root.
//   The syntax is pymdownx.snippets', which the READMEs' section markers were written for.
// - <!-- generated: schema NAME -->, <!-- generated: tokens -->, <!-- generated: files --> and
//   <!-- generated: precache --> become tables walked from the data schema, from the --ag-* colours of the stylesheet
//   and from the shipped files of core.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))
// the shipped core files: the emitted lib/ (npm run build -w packages/core)
export const SRC = join(ROOT, 'packages/core/lib')
const SCHEMA = join(ROOT, 'packages/core/schema/buildguide.schema.json')
const SNIPPET = /^([ \t]*)--8<-- "([^"]+)"[ \t]*$/gm
const MARKER = /<!-- generated: (schema|tokens|files|precache)(?: (\S+))? -->/g
const SECTION = /--8<-- \[(start|end):[\w-]+\]/
const TOKEN = /--ag-([\w-]+):light-dark\((#[0-9a-fA-F]+), (#[0-9a-fA-F]+)\)/g
const DECLARED = /--ag-[\w-]+:\s*light-dark\(/g

const dedent = (lines: string[]): string[] => {
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)?.[0].length ?? 0))
  return Number.isFinite(indent) ? lines.map((l) => l.slice(indent)) : lines
}

/** The lines a snippet names: the whole file, a section or a line range, without any section marker. */
export function snippet(spec: string, root = ROOT): string {
  const [file = '', ...rest] = spec.split(':')
  let lines = readFileSync(join(root, file), 'utf8').replace(/\n$/, '').split('\n')
  if (rest.length === 2) lines = lines.slice(Number(rest[0]) - 1, Number(rest[1]))
  else if (rest.length === 1) {
    const start = lines.findIndex((l) => l.includes(`--8<-- [start:${rest[0]}]`))
    const end = lines.findIndex((l, i) => i > start && l.includes(`--8<-- [end:${rest[0]}]`))
    if (start < 0 || end < 0) throw new Error(`snippet ${spec}: no section ${rest[0]}`)
    lines = dedent(lines.slice(start + 1, end))
  }
  return lines.filter((l) => !SECTION.test(l)).join('\n')
}

// biome-ignore lint/suspicious/noExplicitAny: a JSON Schema node, read key by key
type Node = any

/** The node with its $ref filled in; keys next to the $ref win. */
const resolve = (schema: Node, node: Node): Node => {
  if (!('$ref' in node)) return node
  const { $ref, ...own } = node
  return { ...schema.$defs[$ref.replace('#/$defs/', '')], ...own }
}

export function describeType(schema: Node, node: Node, path: string): string {
  const n = resolve(schema, node)
  if ('enum' in n) return `one of ${n.enum.map((v: unknown) => `\`${JSON.stringify(v)}\``).join(', ')}`
  if ('oneOf' in n) return n.oneOf.map((a: Node) => describeType(schema, a, path)).join(' or ')
  const kind = n.type
  if (kind === undefined) throw new Error(`schema node ${path} has no type or $ref`)
  if (Array.isArray(kind)) return kind.join(' or ')
  if (kind === 'array') {
    if ('prefixItems' in n) return `array of [${n.prefixItems.map((i: Node) => describeType(schema, i, path)).join(', ')}]`
    return `array of ${describeType(schema, n.items, path)}`
  }
  return kind
}

type Row = [path: string, kind: string, required: string, meaning: string]

/** Rows of a node and everything below it. */
export function walk(schema: Node, node: Node, path: string, required: boolean): Row[] {
  const n = resolve(schema, node)
  let meaning: string = n.description ?? ''
  if ('propertyNames' in n) meaning = `${meaning} Keys: ${n.propertyNames.enum.join(', ')}.`.trim()
  const rows: Row[] = [[path, describeType(schema, n, path), required ? 'yes' : '', meaning]]
  const children = (props: Node, req: string[] | undefined, prefix: string) => {
    for (const [key, child] of Object.entries(props ?? {})) rows.push(...walk(schema, child, `${prefix}.${key}`, !!req?.includes(key)))
  }
  children(n.properties, n.required, path)
  if (n.additionalProperties && typeof n.additionalProperties === 'object') rows.push(...walk(schema, n.additionalProperties, `${path}.<key>`, false))
  const item = n.items && typeof n.items === 'object' && !Array.isArray(n.items) ? resolve(schema, n.items) : {}
  // the element's own row would repeat the list's row
  if ('properties' in item) children(item.properties, item.required, `${path}[]`)
  else if ('oneOf' in item) rows.push(...walk(schema, item, `${path}[]`, false))
  for (const alternative of n.oneOf ?? []) if ('properties' in alternative) children(alternative.properties, alternative.required, path)
  return rows
}

/** A Markdown table; | is escaped, and outside code spans the characters MDX reads as JSX or an expression. */
export const table = (header: string[], rows: string[][]): string => {
  const cell = (text: string) =>
    text
      .split(/(`[^`]*`)/)
      .map((part, i) => (i % 2 ? part : part.replace(/[{}<]/g, (c) => `\\${c}`)).replaceAll('|', '\\|'))
      .join('')
  return [`| ${header.join(' | ')} |`, `|${'---|'.repeat(header.length)}`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n')
}

export function schemaTable(name: string): string {
  const schema = JSON.parse(readFileSync(SCHEMA, 'utf8'))
  let rows: Row[]
  if (name === 'root')
    rows = Object.entries(schema.properties).map(([key, child]) => [key, describeType(schema, child, key), schema.required.includes(key) ? 'yes' : '', resolve(schema, child).description ?? ''])
  else if (name === 'bom' || name === 'steps') rows = walk(schema, schema.properties[name], name, false)
  else if (name === 'board') rows = walk(schema, schema.$defs.board, 'boards.<key>', false)
  else throw new Error(`no schema table named ${name}`)
  return table(['Key', 'Type', 'Required', 'Meaning'], rows.map(([path, kind, need, meaning]) => [`\`${path}\``, kind.includes('`') ? kind : `\`${kind}\``, need, meaning]))
}

export function tokenTable(css: string): string {
  const found = [...css.matchAll(TOKEN)]
  if (!found.length || found.length !== [...css.matchAll(DECLARED)].length) throw new Error('an --ag-* colour of the stylesheet is not written as light-dark(#hex, #hex)')
  return table(['Token', 'Light', 'Dark'], found.map(([, name, light, dark]) => [`\`--ag-${name}\``, `\`${light}\``, `\`${dark}\``]))
}

/** The files a page fetches, own files first (packages/core/tests/size.test.mjs lists the same set). */
export function fetched(src: string): string[] {
  const own = ['buildguide.css', 'buildguide.js', 'buildguide-board.js']
  const files = readdirSync(src, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
  const modules = files.filter((e) => e.parentPath === src && /^buildguide-.*\.js$/.test(e.name) && !own.includes(e.name)).map((e) => e.name)
  const nested = files.filter((e) => e.parentPath !== src && !['LICENSE', 'README.txt'].includes(e.name)).map((e) => relative(src, join(e.parentPath, e.name)).split(sep).join('/'))
  // code point order, as Python's sorted()
  const sorted = (a: string[]) => a.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
  return [...own, ...sorted(modules), ...sorted(nested)]
}

/** The core files as the quoted URLs of the service worker example on the offline page. */
export const precacheLines = (src: string): string => fetched(src).map((name) => `  '/assets/buildguide-<version>/${name}',`).join('\n')

/** Size and gzip size in bytes of the fetched files; level 6 is zlib's default, as in the size budgets. */
export function filesTable(src: string): string {
  const rows = fetched(src).map((name) => {
    const data = readFileSync(join(src, name))
    return [`\`${name}\``, data.length.toLocaleString('en-US'), gzipSync(data, { level: 6 }).length.toLocaleString('en-US')]
  })
  return table(['File', 'Bytes', 'Gzipped, about'], rows)
}

/** markdown.preprocessor: snippets first (a README section may hold a marker), then the generated tables. */
export function preprocess({ fileContent }: { fileContent: string }): string {
  return fileContent
    .replace(SNIPPET, (_, indent: string, spec: string) => snippet(spec).replace(/^(?=.)/gm, indent))
    .replace(MARKER, (_, kind: string, name: string) => {
      if (kind === 'files') return filesTable(SRC)
      if (kind === 'precache') return precacheLines(SRC)
      return kind === 'tokens' ? tokenTable(readFileSync(join(SRC, 'buildguide.css'), 'utf8')) : schemaTable(name)
    })
}

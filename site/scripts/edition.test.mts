import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { editionGuides } from './edition.mts'

const site = () => {
  const dir = mkdtempSync(join(tmpdir(), 'edition-'))
  writeFileSync(join(dir, 'guide.json'), JSON.stringify({ storage: 'demo', bom: { items: [] } }))
  writeFileSync(join(dir, 'second.json'), JSON.stringify({ storage: 'second-demo' }))
  return { dir, files: { data: 'guide.json', second: 'second.json' } }
}

test('the next edition suffixes every storage key and keeps the rest of the data', () => {
  const { dir, files } = site()
  const out = editionGuides(files, dir, 'next')
  assert.deepEqual(JSON.parse(readFileSync(out.data, 'utf8')), { storage: 'demo-next', bom: { items: [] } })
  assert.equal(JSON.parse(readFileSync(out.second, 'utf8')).storage, 'second-demo-next')
  // the site's own files stay as they are
  assert.equal(JSON.parse(readFileSync(join(dir, 'guide.json'), 'utf8')).storage, 'demo')
})

test('any other edition builds from the given files', () => {
  const { dir, files } = site()
  for (const edition of [undefined, 'stable', '']) assert.equal(editionGuides(files, dir, edition), files)
})

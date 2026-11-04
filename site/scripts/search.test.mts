import assert from 'node:assert/strict'
import { test } from 'node:test'
import { marked } from './search.mts'

test('the main content of a docs page is indexed, a page without it is not', () => {
  assert.equal(
    marked('<div class="theme-doc-markdown markdown"><h1>BOM</h1></div>'),
    '<div class="theme-doc-markdown markdown" data-pagefind-body><h1>BOM</h1></div>',
  )
  assert.equal(marked('<main>Page not found</main>'), '<main>Page not found</main>')
})

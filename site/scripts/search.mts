// Writes the Pagefind index of the built site to <outDir>/pagefind/: the main content of each page. Runs after
// `docusaurus build` (postBuild in the config): `node scripts/search.mts <outDir>`.
import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import * as pagefind from 'pagefind'

const open = '<div class="theme-doc-markdown markdown">'

/** The page with its main content marked for Pagefind. A page without one (the 404) is left out of the index. */
export const marked = (html: string): string =>
  html.replace(open, `${open.slice(0, -1)} data-pagefind-body>`)

async function writeSearchIndex(outDir: string): Promise<void> {
  try {
    // the heading anchors repeat each heading; the BuildGuide components are empty until the browser runs them
    const { index, errors } = await pagefind.createIndex({
      excludeSelectors: ['.hash-link', 'noscript'],
      forceLanguage: 'en',
    })
    if (!index) throw new Error(`pagefind: ${errors.join(', ')}`)
    for (const file of readdirSync(outDir, { recursive: true, encoding: 'utf8' })) {
      if (!file.endsWith('.html')) continue
      const path = file.replaceAll(sep, '/')
      const html = marked(readFileSync(join(outDir, file), 'utf8'))
      await index.addHTMLFile({ url: `/${path.replace(/index\.html$/, '')}`, content: html })
    }
    await index.writeFiles({ outputPath: join(outDir, 'pagefind') })
  } finally {
    await pagefind.close()
  }
}

if (import.meta.main) await writeSearchIndex(process.argv[2] ?? 'build')

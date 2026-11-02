// Edition of the docs site. The stable site (the latest release) is at the root, the next site (main) under /next/,
// both on one origin, so they share localStorage. BUILDGUIDE_EDITION=next gives the guides of the next site their own
// storage keys: copies of the guide files with `-next` after each key, which the plugin then checks and serves.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

/** The guide files to build from, relative to `siteDir` or absolute: the given ones, or for the next edition copies with suffixed storage keys. */
export function editionGuides<T extends Record<string, string>>(files: T, siteDir: string, edition = process.env.BUILDGUIDE_EDITION): T {
  if (edition !== 'next') return files
  const dir = mkdtempSync(join(tmpdir(), 'buildguide-next-'))
  const out: Record<string, string> = {}
  for (const [id, file] of Object.entries(files)) {
    const data = JSON.parse(readFileSync(resolve(siteDir, file), 'utf8'))
    data.storage += '-next'
    out[id] = join(dir, `${id}-${basename(file)}`)
    writeFileSync(out[id], JSON.stringify(data))
  }
  return out as T
}

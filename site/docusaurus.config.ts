import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { Options as DocsOptions } from '@docusaurus/plugin-content-docs'
import type { Options as ThemeOptions } from '@docusaurus/theme-classic'
import type { UserThemeConfig } from '@docusaurus/theme-common'
import type { Config } from '@docusaurus/types'
import { editionGuides } from './scripts/edition.mts'
import { preprocess } from './scripts/markdown.mts'
import { repoFacts } from './scripts/repo-facts.mts'
import site from './site.json'

// GitHub Pages: DOCS_URL is the site origin, DOCS_BASE_URL the path of the edition (pages.yml builds main under /BuildGuide/next/)
const baseUrl = process.env.DOCS_BASE_URL ?? site.baseUrl
const repo = `https://github.com/${site.repo}`
// the example guide of core and two minimal guides: example/second.mdx shows `minimal`, the home page `home`, which
// has a storage key of its own, so ticking there leaves the example guides alone
const { data, ...guides } = editionGuides(
  {
    data: '../packages/core/example/guide.json',
    minimal: '../packages/core/example/minimal/all.json',
    home: '../packages/core/example/minimal/wiring.json',
  },
  // the config loader (jiti 1) has import.meta.url, not import.meta.dirname
  fileURLToPath(new URL('.', import.meta.url)),
)

const config = async (): Promise<Config> => ({
  title: site.title,
  tagline: site.description,
  url: process.env.DOCS_URL ?? site.url,
  baseUrl,
  trailingSlash: true,
  titleDelimiter: '-',
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: {
    hooks: { onBrokenMarkdownLinks: 'throw' },
    // README sections and generated tables (scripts/markdown.mts)
    preprocessor: preprocess,
  },
  // the search box of src/theme/SearchBar.tsx: it reads the index next to this script
  stylesheets: [`${baseUrl}pagefind/pagefind-component-ui.css`],
  scripts: [{ src: `${baseUrl}pagefind/pagefind-component-ui.js`, defer: true }],
  // the pieces of the classic preset the site uses, without its blog, pages, SVG-as-component and search plugins
  themes: [
    [
      '@docusaurus/theme-classic',
      // brand.css: tokens and their mapping, shared by the OpenReloading sites; buildguide-site.css: this site's layout
      { customCss: ['./src/css/brand.css', './src/css/buildguide-site.css'] } satisfies ThemeOptions,
    ],
  ],
  plugins: [
    ['@docusaurus/plugin-content-docs', { routeBasePath: '/', sidebarPath: './sidebars.ts' } satisfies DocsOptions],
    '@docusaurus/plugin-sitemap',
    // the plugin of this repository (packages/docusaurus): docs and plugin are released together
    ['@openreloading/docusaurus-plugin-buildguide', { data, guides }],
    // the search index of the built site (scripts/search.mts), in its own process: the config loader cannot
    // require the ESM-only pagefind package
    ({ siteDir }) => ({
      name: 'search-index',
      postBuild: ({ outDir }) => {
        execFileSync(process.execPath, ['scripts/search.mts', outDir], { cwd: siteDir, stdio: 'inherit' })
      },
    }),
  ],
  themeConfig: {
    navbar: {
      // the wordmark names the site: dark ink on the light navbar, light on the dark one
      logo: { alt: site.title, src: 'assets/buildguide-light.svg', srcDark: 'assets/buildguide-dark.svg' },
      items: [
        { type: 'doc', docId: 'example/index', label: 'Live example', position: 'left', activeBasePath: 'example' },
        // every page but the home page and the example guide is a docs page
        { to: '/core/', label: 'Docs', position: 'left', activeBaseRegex: '/(core|mkdocs|docusaurus|examples|data-format|theming|reference|testing|offline)/$' },
        // read once per build, the browser makes no request to GitHub
        { type: 'custom-repo', repo: site.repo, facts: await repoFacts(site.repo), position: 'right' },
        { type: 'search', position: 'right' },
      ],
    },
    footer: {
      links: [
        { label: 'Releases', href: `${repo}/releases` },
        { label: 'GitHub', href: repo },
        { label: 'Security policy', href: 'https://github.com/OpenReloading/.github/blob/main/SECURITY.md' },
      ],
      // keep it in step with the third-party notice in packages/core/src
      copyright: 'MIT license. Core bundles JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later) unmodified.',
    },
    colorMode: { respectPrefersColorScheme: true },
    // code in the token colors: one color for every token keeps 4.5:1 in both schemes
    prism: { theme: { plain: { color: 'var(--ink)', backgroundColor: 'var(--surface-alt)' }, styles: [] } },
  } satisfies UserThemeConfig,
})

export default config

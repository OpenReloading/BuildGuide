# BuildGuide for Docusaurus

Docusaurus 3 plugin: checks the guide data at build time, serves the core browser files and provides the `<BuildGuide />` component for a BOM checklist or a wiring or tubing board. Your pages, notices and navigation stay your own.

## Use

1. Install the package, from GitHub Packages or from a release file.

   GitHub Packages asks for a token with the `read:packages` scope even for public packages. In the site's `.npmrc`:

   ```ini
   @openreloading:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```

   ```sh
   npm install @openreloading/docusaurus-plugin-buildguide
   ```

   Without a token: download `openreloading-docusaurus-plugin-buildguide-<version>.tgz` from a `docusaurus-v*` [release](https://github.com/OpenReloading/BuildGuide/releases) and run `npm install ./openreloading-docusaurus-plugin-buildguide-<version>.tgz`.

2. Add the plugin to `docusaurus.config.js`:

   ```js
   plugins: [['@openreloading/docusaurus-plugin-buildguide', { data: 'guide.json' }]],
   ```

   | Option | Meaning | Default |
   |---|---|---|
   | `data` | guide data (JSON, core data format), relative to the site folder | required |
   | `assets` | folder of BOM images below `baseUrl` | `assets/` |

3. Use the component in any page, as often as you like on one page. The page has its own title (Docusaurus prints it) and notices (admonitions):

   ```mdx
   ---
   title: Wiring
   ---

   import BuildGuide from '@theme/BuildGuide';

   :::warning[Safety]
   Work with the supply unplugged.
   :::

   <BuildGuide view="board" board="wiring" />
   <BuildGuide view="bom" />
   ```

   | Prop | Meaning |
   |---|---|
   | `view` | `bom` or `board` |
   | `board` | key in `boards`, for `board` |

The build stops on a problem the core check finds (`buildguide-check.mjs`), one line per problem. Core is served from `<baseUrl>assets/buildguide/` in `docusaurus start` and `docusaurus build`. Every page carries the data in `<script type="application/json" id="buildguide-data">` and loads `buildguide.css`. The component loads `buildguide.js`, calls `BuildGuide.mount` and removes the component when it unmounts, so client-side navigation between pages works. An unknown view or board key shows `Unknown guide component` in the page. Dark theme: `html[data-theme="dark"] .ag-guide` gets the dark tokens and `html[data-theme="light"] .ag-guide` the light ones (the plugin's own stylesheet), whatever the browser prefers.

## Development

From the repository root, in the dev container: `npm test` (plugin tests), `npm run build -w packages/docusaurus` (example site in `example/build/`, the example pages under `/example/`), `npm run start -w packages/docusaurus` (dev server on port 8080) and `npm run test:browser` (the core browser tests, also against the example build). `npm run dist -w packages/docusaurus` writes the .tgz to `dist/`. Builds, tests and `npm pack` copy `packages/core/src` into `core/` (git-ignored) first, so the package ships core at its own tag (#7).

## Licenses

MIT (`LICENSE`). The package bundles core with its vendored JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later), see `core/vendor/README.txt` in the package.

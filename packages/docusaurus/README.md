# BuildGuide for Docusaurus

Docusaurus 3 plugin: checks the guide data at build time, serves the core browser files and provides the `<BuildGuide page="..."/>` component.

## Use

1. Download `openreloading-docusaurus-plugin-buildguide-<version>.tgz` from a `docusaurus-v*` [release](https://github.com/OpenReloading/BuildGuide/releases) and install it in the site:

   ```sh
   npm install ./openreloading-docusaurus-plugin-buildguide-<version>.tgz
   ```

2. Add the plugin to `docusaurus.config.js`:

   ```js
   plugins: [['@openreloading/docusaurus-plugin-buildguide', { data: 'guide.json', site: '/guide/' }]],
   ```

   | Option | Meaning | Default |
   |---|---|---|
   | `data` | guide data (JSON, core data format), relative to the site folder | required |
   | `site` | URL path of the guide's root below `baseUrl`. Page paths in the data (`path`, or the defaults: empty for the first page, else `<id>/`) are relative to it | `/` |
   | `assets` | folder of brand mark, BOM images and intro media, relative to `site` | `assets/` |

3. Put one guide page on each Docusaurus page whose URL matches its path:

   ```mdx
   ---
   title: Wiring
   hide_title: true
   hide_table_of_contents: true
   ---

   import BuildGuide from '@theme/BuildGuide';

   <BuildGuide page="wiring" />
   ```

The build stops on a problem the core check finds (`buildguide-check.mjs`), one line per problem. Core is served from `<baseUrl>assets/buildguide/` in `docusaurus start` and `docusaurus build`. Every page carries the data in `<script type="application/json" id="buildguide-data">` and loads `buildguide.css`. The component loads `buildguide.js` and calls `BuildGuide.mount`. Guide pages reached through Docusaurus links mount without a full page load. Links inside the guide load the target page in full.

## Development

From the repository root, in the dev container: `npm test` (plugin tests), `npm run build -w packages/docusaurus` (example site in `example/build/`, the core example guide under `/example/`), `npm run start -w packages/docusaurus` (dev server on port 8080) and `npm run test:browser` (the core browser tests, also against the example build). `npm run dist -w packages/docusaurus` writes the .tgz to `dist/`. Builds, tests and `npm pack` copy `packages/core/src` into `core/` (git-ignored) first, so the package ships core at its own tag (#7).

## Licenses

MIT (`LICENSE`). The package bundles core with its vendored JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later), see `core/vendor/README.txt` in the package.

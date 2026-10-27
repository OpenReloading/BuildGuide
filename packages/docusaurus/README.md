# BuildGuide for Docusaurus

Docusaurus 3 plugin: validates and checks the guide data at build time, serves the core browser files and provides the `<BuildGuide />` component for a BOM checklist, text steps or a wiring or tubing board. Your pages, notices and navigation stay your own.

<!-- --8<-- [start:docs] -->
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
   | `guides` | more guides on the same site, `id: path` (letters, digits, `-` and `_`), each in the core data format | none |
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
   | `view` | `bom`, `steps`, `board`, or `guide` (the BOM, the steps and all boards behind tabs) |
   | `board` | key in `boards`, for `board`; for `guide` a space separated list of `bom`, `steps` and board keys to show, in that order |
   | `guide` | an id from `guides`; without it the component shows the guide of `data` |

   One site can hold several guides: `<BuildGuide guide="second" view="board" board="wiring" />`. A page can use several guides.

The build validates the data of every guide against the JSON schema, then runs the core cross-reference check, and stops on a problem. It also stops when two guides (`data` included) have the same `storage` key: `localStorage` is per origin, so guides with the same key tick each other's connections. It then writes the validated data to `<baseUrl>assets/buildguide/guide.json` (without whitespace) and each named guide to `<baseUrl>assets/buildguide/guides/<id>.json`: no page holds any data, and a page with a component makes one extra request for each file it uses, shared by its components. The message names the data file and, one line per problem, the key (`/bom/items/0/quantity: must NOT have additional properties`). An unknown view or board key shows `Unknown guide component` in the page; an id that is not in `guides` shows `Guide data unavailable.` (the file is not found), the build does not see the id. The theme follows Docusaurus's colour mode ([Theming](https://openreloading.github.io/BuildGuide/theming/)).

<!-- --8<-- [end:docs] -->

## Development

From the repository root, in the dev container: `npm test` (plugin tests), `npm run build -w packages/docusaurus` (example site in `example/build/`, the example pages under `/example/`), `npm run start -w packages/docusaurus` (dev server on port 8080) and `npm run test:browser` (the core browser tests, also against the example build). `npm run dist -w packages/docusaurus` writes the .tgz to `dist/`. Builds, tests and `npm pack` copy `packages/core/src` into `core/` (git-ignored) first, so the package ships core at its own tag (#7).

## Licenses

MIT (`LICENSE`). The package bundles core with its vendored JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later), see `core/vendor/README.txt` in the package.

# BuildGuide core

Browser components (BOM checklist, wiring and tubing boards), JSON Schema and check CLI for any static site. Plain JavaScript and CSS, no build step. Docs: https://openreloading.github.io/BuildGuide/

<!-- --8<-- [start:docs] -->
## Use

1. Install. Download `buildguide-<version>.tar.gz` and `SHA256SUMS` from a `core-v*` [release](https://github.com/OpenReloading/BuildGuide/releases), check the archive and unpack it into the site's assets:

   ```sh
   sha256sum -c SHA256SUMS
   tar -xzf buildguide-<version>.tar.gz -C assets/
   ```

   Or install `@openreloading/buildguide` from GitHub Packages, which asks for a token with the `read:packages` scope even for public packages. In the project's `.npmrc`:

   ```ini
   @openreloading:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```

   then `npm install @openreloading/buildguide` and copy `node_modules/@openreloading/buildguide/src/` into the site's assets.

2. Put the components into your own pages. The page owns its title, notices, text and navigation: a component draws only a BOM checklist or one board (wiring or tubing). Use as many as you like on one page, each board once:

   ```html
   <link rel="stylesheet" href="assets/buildguide-<version>/buildguide.css">
   <div data-buildguide="bom" data-src="guide.json"></div>
   <div data-buildguide="board" data-board="wiring" data-src="guide.json"><noscript>This guide needs JavaScript.</noscript></div>
   <script src="assets/buildguide-<version>/buildguide.js" defer></script>
   ```

   | Attribute | Meaning | Default |
   |---|---|---|
   | `data-buildguide` | `bom`, `board`, or `guide` (the BOM and all boards behind tabs) | required |
   | `data-board` | key in `boards`, for `board`; for `guide` a space separated list of `bom` and board keys to show, in that order | required for `board`, all for `guide` |
   | `data-src` | URL of the guide data. Components with the same URL share one request | the JSON in an element with the id `guide-data` |
   | `data-assets` | folder of BOM images, relative to the page | `assets/` (or the `data-assets` of `#guide-data`) |

   Colours and dark mode: [Theming](https://openreloading.github.io/BuildGuide/theming/). The script, hash and storage details: [Reference](https://openreloading.github.io/BuildGuide/reference/).

3. Write the guide data: [Data format](https://openreloading.github.io/BuildGuide/data-format/) describes every key, `buildguide.schema.json` (JSON Schema 2020-12) is the formal definition.

4. Check the data before publishing: `node assets/buildguide-<version>/buildguide-check.mjs guide.json` prints one line per problem and exits 1 ([Reference](https://openreloading.github.io/BuildGuide/reference/#check-cli)).

<!-- --8<-- [end:docs] -->

## Development

`npm run serve` serves `example/`; the other commands are in [CONTRIBUTING.md](../../CONTRIBUTING.md). `npm run dist` builds `dist/buildguide-<version>.tar.gz` and `SHA256SUMS`, reproducible: the same commit gives the same checksum.

## Licenses

MIT (`LICENSE`). Vendored unmodified in `src/vendor/` (`src/vendor/README.txt`): [JointJS](https://github.com/clientIO/joint) `@joint/core` 4.3.3 (MPL-2.0) and [libavoid-js](https://github.com/Aksem/libavoid-js) 0.5.0-beta.5 (LGPL-2.1-or-later).

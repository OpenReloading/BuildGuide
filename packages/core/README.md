# BuildGuide core

Browser components (BOM checklist, wiring and tubing boards), JSON Schema and check CLI. Plain JavaScript and CSS, no build step. Example pages: `example/` (`npm run serve`, then http://127.0.0.1:8080/example/).

## Use

1. Download `buildguide-<version>.tar.gz` and `SHA256SUMS` from a `core-v*` [release](https://github.com/OpenReloading/BuildGuide/releases), check the archive and unpack it into the site's assets:

   ```sh
   sha256sum -c SHA256SUMS
   tar -xzf buildguide-0.1.0.tar.gz -C assets/
   ```

   Or install `@openreloading/buildguide` from GitHub Packages (see [GitHub Packages](#github-packages)) and copy `node_modules/@openreloading/buildguide/src/` into the site's assets.

2. Put the components into your own pages. The page owns its title, notices, text and navigation: a component draws only a BOM checklist or one board (wiring or tubing). Use as many as you like on one page:

   ```html
   <link rel="stylesheet" href="assets/buildguide-0.1.0/buildguide.css">
   <div data-buildguide="bom" data-src="guide.json"></div>
   <div data-buildguide="board" data-board="wiring" data-src="guide.json"><noscript>This guide needs JavaScript.</noscript></div>
   <script src="assets/buildguide-0.1.0/buildguide.js" defer></script>
   ```

   | Attribute | Meaning | Default |
   |---|---|---|
   | `data-buildguide` | `bom` or `board` | required |
   | `data-board` | key in `boards`, for `board` | required for `board` |
   | `data-src` | URL of the guide data. Components with the same URL share one request | the JSON in `<script type="application/json" id="guide-data">` |
   | `data-assets` | folder of BOM images, relative to the page | `assets/` (or the `data-assets` of `#guide-data`) |

   The script mounts every `[data-buildguide]` element by itself. `BuildGuide.mount(root, data, {view, board, assets})` mounts any other element and returns a function that removes the component again (listeners, drawing, markup). An element that names an unknown view or board shows `Unknown guide component`. `BuildGuide.scan()` mounts the components that are not mounted yet and unmounts those that left the document: the script runs it at load, when it is evaluated a second time, and on each emission of Material's `document$`, so a host that swaps pages without a reload (Material's instant navigation) only needs to evaluate the script again or call it. `#guide-data` may be any element with that id (the MkDocs plugin uses a hidden `div`).

   Each component carries the class `ag-guide`, takes the width of its container and has no title: the host page names it. Boards keep their position in the URL hash, one `key=step/number` pair per board, for example `#wiring=B/4&tubing=3`. A board changes the hash with `history.pushState`, so it fires no `hashchange` and no `popstate` (Material's instant navigation swaps the page on a `popstate`). Use each board once per page. A hash without a board's pair (a heading anchor such as `#intro`) leaves that board where it is; a foreign fragment stays in the hash and is scrolled to when the components mount. Boards also follow `popstate`.

   Colours, the dark theme and print: [Theming and dark mode](https://openreloading.github.io/BuildGuide/theming/).

3. Write the guide data: [Data format](https://openreloading.github.io/BuildGuide/data-format/) describes every key, `buildguide.schema.json` (JSON Schema 2020-12) is the formal definition, and `example/guide.json` uses every part of it.

4. Check the data before publishing:

   ```sh
   node assets/buildguide-0.1.0/buildguide-check.mjs guide.json
   ```

   It checks what the schema cannot: unique ids, numbers and terminal names, ends that name an existing part and terminal, defined colours, diodes with both ends on one part, the per-terminal limit, a board `title`, and tick prefixes that are unique across boards and not `bom`. It prints one line per problem and exits 1, or 2 without a file. `check(data)` from the same module returns the list. The schema itself is checked with any JSON Schema validator.

## GitHub Packages

Each `core-v*` release is also published as `@openreloading/buildguide` on the GitHub Packages npm registry, which asks for a token with the `read:packages` scope even for public packages. In the project's `.npmrc`:

```ini
@openreloading:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

then `npm install @openreloading/buildguide`. The package holds `src/` (components, vendored libraries, `buildguide-check.mjs`, also the `buildguide-check` command) and `schema/`.

## Development

Commands from the repository root are in the root README. Here: `npm run serve` serves `example/`. The browser tests fail on any page error, missing file or request outside the test server. `npm run dist` builds `dist/buildguide-<version>.tar.gz` and `SHA256SUMS`, reproducible: the same commit gives the same checksum.

## Licenses

MIT (`LICENSE`). Vendored unmodified in `src/vendor/` (`src/vendor/README.txt`):

- [JointJS](https://github.com/clientIO/joint) `@joint/core` 4.3.3, MPL-2.0
- [libavoid-js](https://github.com/Aksem/libavoid-js) 0.5.0-beta.5, LGPL-2.1-or-later

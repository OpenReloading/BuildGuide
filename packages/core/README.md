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

   The script mounts every `[data-buildguide]` element by itself. `BuildGuide.mount(root, data, {view, board, assets})` mounts any other element and returns a function that removes the component again (listeners, drawing, markup). An element that names an unknown view or board shows `Unknown guide component`.

   Each component carries the class `ag-guide`, takes the width of its container and has no title: the host page names it. Boards keep their position in the URL hash, one `key=step/number` pair per board, for example `#wiring=B/4&tubing=3`. Use each board once per page. A hash without a board's pair (a heading anchor such as `#intro`) leaves that board where it is; a foreign fragment stays in the hash, but once a board pair follows it the browser no longer scrolls to the anchor. Boards also follow `popstate`.

   Colours are `--ag-*` custom properties on `.ag-guide` (list at the top of `buildguide.css`). A site overrides them in its own stylesheet, for example `.ag-guide{--ag-accent:#0a5}`. `--ag-page` is the component background.

   Dark theme: every colour is a `light-dark()` pair (Chrome 123, Firefox 120, Safari 17.5 and later) that follows the component's `color-scheme`. Without a host signal the browser preference applies (`prefers-color-scheme`); `data-ag-scheme="light"` on the component or an ancestor opts out. A host that signals dark sets `color-scheme: dark` and `--ag-board-filter: invert(.9) hue-rotate(180deg)` on `.ag-guide`, which also darkens the board drawing. Print is always light.

3. Write the guide data. `buildguide.schema.json` (JSON Schema 2020-12) describes it, and `example/guide.json` uses every part of it.

   - `storage`: localStorage key for the ticks, shared by all components. A tick belongs to one exact connection (number and both ends): changing an end clears it. Each component says at its bottom whether progress is saved.
   - `bom`: note, BOM items with groups, search and CSV export.
   - `boards`: one entry per board key, with a required `title` (step navigation label, list heading, accessible name). Parts with terminals on their sides (`ports`), connections in `steps` (each step has an `id`, a `title`, an optional `note` shown as plain text with the step above its connection list, and its `connections`) from `PART:terminal` to `PART:terminal`, colour codes, part kinds, areas with cable glands, and `rules` such as connections per terminal. Routes are computed (libavoid), not drawn.

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

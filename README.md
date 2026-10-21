<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/buildguide-dark.svg"><img src="docs/assets/buildguide-light.svg" width="320" alt="OpenReloading BuildGuide"></picture></p>

# BuildGuide

Browser library that renders an interactive build guide from one JSON file: introduction, BOM checklist, and board views for wiring and tubing with a tick per connection. Plain JavaScript and CSS, no framework, no build step, no requests outside the site. It works with any static site.

Example: `example/` (served by `npm run serve`, see Development).

## Use

1. Download `buildguide-<version>.tar.gz` and `SHA256SUMS` from [Releases](https://github.com/OpenReloading/BuildGuide/releases), check the archive and unpack it into the site's assets:

   ```sh
   sha256sum -c SHA256SUMS
   tar -xzf buildguide-0.1.0.tar.gz -C assets/
   ```

2. Write one HTML page per guide page. The first page sits at the site root, every other page at `<id>/` (or the page's `path`):

   ```html
   <link rel="stylesheet" href="../assets/buildguide-0.1.0/buildguide.css">
   <div id="assembly-guide" data-page="wiring" data-site="../" data-src="../guide.json"><noscript>This guide needs JavaScript.</noscript></div>
   <script src="../assets/buildguide-0.1.0/buildguide.js" defer></script>
   ```

   | Attribute | Meaning | Default |
   |---|---|---|
   | `data-page` | page `id` from `pages` | the first page |
   | `data-site` | site root, relative to this page | `./` |
   | `data-assets` | folder of brand mark, BOM images and intro media, relative to the site root | `assets/` |
   | `data-src` | URL of the guide data | the JSON in `<script type="application/json" id="guide-data">` |

   The script mounts `#assembly-guide` by itself. `BuildGuide.mount(root, data, {page, site, assets})` mounts any other element. Board pages load `vendor/joint/` and `buildguide-board.js` from the script's own folder.

3. Write the guide data. `buildguide.schema.json` (JSON Schema 2020-12) describes it, and `example/guide.json` uses every part of it.

   - `storage`: localStorage key for the ticks. A tick belongs to one exact connection (number and both ends): changing an end clears it.
   - `pages`: `intro`, `bom` or `board` views, in navigation order.
   - `intro`, `bom`: text, steps, media placeholders, BOM items with groups, search and CSV export.
   - `boards`: parts with terminals on their sides (`ports`), connections in `steps` from `PART:terminal` to `PART:terminal`, colour codes, part kinds, areas with cable glands, and `rules` such as connections per terminal. Routes are computed (libavoid), not drawn.
   - Links: `<page>/#<step>/<no>`, or `#<step>` for a step with one connection.

4. Check the data before publishing:

   ```sh
   node assets/buildguide-0.1.0/buildguide-check.mjs guide.json
   ```

   It checks what the schema cannot: unique ids, numbers and terminal names, ends that name an existing part and terminal, defined colours, diodes with both ends on one part, the per-terminal limit, and pages that `next` and `board` point to. It prints one line per problem and exits 1, or 2 without a file. `check(data)` from the same module returns the list. The schema itself is checked with any JSON Schema validator.

## Development

Builds and tests run in the dev container (`.devcontainer/`, Playwright image):

```sh
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . npm test             # checker and schema
devcontainer exec --workspace-folder . npx playwright test  # browser tests of the example
devcontainer exec --workspace-folder . npm run serve        # http://127.0.0.1:8080/example/
devcontainer exec --workspace-folder . npm run dist         # dist/buildguide-<version>.tar.gz and SHA256SUMS
```

The browser tests fail on any page error, missing file or request outside the test server.

Release: set `version` in `package.json`, merge, push the tag `v<version>`. The Release workflow runs the tests and attaches the archive and `SHA256SUMS`. The archive is reproducible: the same commit gives the same checksum.

## Licenses

BuildGuide: MIT (`LICENSE`). Vendored unmodified in `src/vendor/`, see `src/vendor/README.txt`:

- [JointJS](https://github.com/clientIO/joint) `@joint/core` 4.3.3, MPL-2.0
- [libavoid-js](https://github.com/Aksem/libavoid-js) 0.5.0-beta.5, LGPL-2.1-or-later

Logo: [OpenReloading Artwork](https://github.com/OpenReloading/Artwork).

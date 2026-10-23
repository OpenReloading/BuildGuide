# Reference

The surface a site may style or test against. Anything not listed here can change in any release.

## Markup

| Name | Meaning |
|---|---|
| `.ag-guide` | the root of a mounted component |
| `.ag-*` | the component classes inside it |
| `data-buildguide` | on the element to fill: `bom` or `board` |
| `data-board` | the board key, for `board` |
| `data-src` | URL of the guide data; components with the same URL share one request |
| `data-assets` | folder of BOM images, relative to the page |
| `#guide-data` | an element holding the guide data as JSON (`<script type="application/json">`, or any element with that id) |
| `data-step`, `data-wire`, `data-conn`, `data-connection` | step buttons, connection rows and board connections |
| `data-role` | `scope`, `search`, `import-file` |
| `data-ag-scheme` | `light` opts a component out of the browser's dark preference |
| `--ag-board-filter` | filter applied to the board drawing |

`data-action` values: `fullscreen`, `zoom-in`, `zoom-out`, `zoom-fit`, `prev-wire`, `next-wire`, `export` (BOM as CSV), `print`, `export-progress`, `import-progress`, `reset-progress`.

The [`--ag-*` tokens](theming.md#tokens) are stable too.

## Position and storage

| Name | Format |
|---|---|
| Hash pair | `<board key>=<step>/<no>`, one per board, joined with `&`: `#wiring=B/4&tubing=3`. `<step>` and `<no>` are percent-encoded; the number is left out for a step with one connection. A fragment without `=` is an anchor and leaves every board where it is. |
| Tick key | `<prefix>-<no>:<a>:<b>` for a connection, `bom-<id>:<part>` for a BOM item |
| Storage key | the `storage` of the guide data: one `localStorage` key holding an object of `true` and `false` values |

A change to a tick key or to the storage key drops the ticks people saved.

## Script

| Call | Meaning |
|---|---|
| `BuildGuide.mount(root, data, {view, board, assets})` | renders one component into `root` and returns the function that removes it again (listeners, drawing, markup). An unknown view or board shows `Unknown guide component`. |
| `BuildGuide.scan()` | mounts the components that are not mounted yet and unmounts those that left the document. The script runs it at load, when it is evaluated again, and on each emission of Material's `document$`. |

| Event on `document` | Meaning |
|---|---|
| `buildguide-progress` | the saved progress was imported or reset: `detail: {storage, saved}`. Every mounted component takes the new object. |

## Check CLI

```sh
npx buildguide-check guide.json [more.json ...]
# or, from a release archive
node assets/buildguide-<version>/buildguide-check.mjs guide.json
```

It prints one line per problem and exits 1, or 2 without a file. `check(data)` from `buildguide-check.mjs` returns the list of problems. It checks what the schema cannot: unique ids, numbers and terminal names, ends that name an existing part and terminal, defined colours, diodes with both ends on one part, the per-terminal limit, a board `title`, and tick prefixes that are unique across boards and not `bom`. The MkDocs plugin runs the same checks (`check.py`) and stops the build on a problem.

## MkDocs plugin

```yaml
plugins:
  - buildguide:
      data: guide.json
```

| Option | Meaning | Default |
|---|---|---|
| `data` | guide data (JSON or YAML), relative to `mkdocs.yml` | required |
| `assets` | folder of BOM images, relative to the site root | `assets/` |

An unknown view or board key in a page is a warning, an error with `--strict`.

## Docusaurus plugin

```js
plugins: [['@openreloading/docusaurus-plugin-buildguide', { data: 'guide.json' }]],
```

| Option | Meaning | Default |
|---|---|---|
| `data` | guide data (JSON, core data format), relative to the site folder | required |
| `assets` | folder of BOM images below `baseUrl` | `assets/` |

`<BuildGuide>` (from `@theme/BuildGuide`):

| Prop | Meaning |
|---|---|
| `view` | `bom` or `board` |
| `board` | key in `boards`, for `board` |

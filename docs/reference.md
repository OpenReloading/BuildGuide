# Reference

The surface a site may style or test against. Anything not listed here can change in any release.

## Markup

| Name | Meaning |
|---|---|
| `.ag-guide` | the root of a mounted component |
| `.ag-*` | the component classes inside it |
| `data-buildguide` | on the element to fill: `bom`, `board` or `guide` |
| `data-board` | the board key, for `board`; for `guide` a space separated list of `bom` and board keys (so no key with a space) to show as tabs, in that order, empty for the BOM and every board |
| `.ag-tabbed`, `.ag-tabs`, `role=tab`, `role=tabpanel` | the root of a `guide` component (it carries `.ag-guide` too), its tab list, its tabs and its one panel; the panel is a mounted BOM or board component |
| `data-src` | URL of the guide data; components with the same URL share one request |
| `data-assets` | folder of BOM images, relative to the page |
| `#guide-data` | an element holding the guide data as JSON (`<script type="application/json">`, or any element with that id), used by components without `data-src`; its `data-assets` is the default for them |
| `data-step`, `data-wire`, `data-conn`, `data-connection` | step buttons, connection rows and board connections |
| `data-role` | `scope`, `search`, `import-file` |
| `data-ag-scheme` | `light` opts a component out of the browser's dark preference |
| `--ag-board-filter` | filter applied to the board drawing |
| `--ag-board-ratio` | set by the component on a board's `.ag-guide`: the board size from the guide data as `<width> / <height>` (`1360 / 860`), a valid `aspect-ratio` value, see [Board size](theming.md#board-size) |
| `--ag-done-opacity`, `--ag-done-decoration` | opacity (default `1`; applies to a done BOM cell or wire button and its contents, the checkbox in the BOM cell included) and `text-decoration` (default `none`) of a ticked BOM or wire row's text, see [Done state](theming.md#done-state) |

`data-action` values: `fullscreen`, `zoom-in`, `zoom-out`, `zoom-fit`, `prev-wire`, `next-wire`, `export` (BOM as CSV), `print`, `export-progress`, `import-progress`, `reset-progress`.

The [`--ag-*` tokens](theming.md#tokens) are stable too.

## Position and storage

| Name | Format |
|---|---|
| Hash pair | `<board key>=<step>/<no>`, one per board, joined with `&`: `#wiring=B/4&tubing=3`. `<step>` and `<no>` are percent-encoded; the number is left out for a step with one connection. A fragment without `=` is an anchor and leaves every board where it is. |
| Tab pair | `guide=<key>`, for the shown tab of a `guide` component, `bom` for the BOM: `#guide=wiring&wiring=B/4`. It sits next to the board pairs. |
| Tick key | `<prefix>-<no>:<a>:<b>` for a connection, `bom-<id>:<part>` for a BOM item |
| Storage key | the `storage` of the guide data: one `localStorage` key holding an object of `true` and `false` values |

A board changes the hash with `history.pushState`, so it fires no `hashchange` and no `popstate` (Material's instant navigation swaps the page on a `popstate`); boards follow `popstate`. Use each board once per page, also across a `guide` component and standalone boards. A foreign fragment stays in the hash and is scrolled to when the components mount.

A `guide` component mounts the shown tab only: a board is drawn when its tab is shown, never in a hidden box, and a tab that is left releases its drawing and search text. Ticks and each board's position (its hash pair) stay. When the hash is read (on load, `hashchange`, `popstate`), the tab pair names the tab; without one, a board pair that changed (on load: the first) opens its board's tab; without that, an anchor or a pair of the shown board leaves the tab as it is, and a hash with none of these shows the first tab. Printing prints the shown component, without the tabs. A board whose key is `guide` or `bom` is not usable in a `guide` component.

A change to a tick key or to the storage key drops the ticks people saved.

## Script

| Call | Meaning |
|---|---|
| `BuildGuide.mount(root, data, {view, board, assets})` | renders one component into `root` and returns the function that removes it again (listeners, drawing, markup). An unknown view, board, or key in the `board` list of a `guide` shows `Unknown guide component`. |
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

## Plugins

Options and markup of the [MkDocs](mkdocs.md) and [Docusaurus](docusaurus.md) plugins are on their getting started pages.

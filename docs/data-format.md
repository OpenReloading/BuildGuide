# Data format

A guide is one JSON or YAML object that every component reads: the BOM checklist and each board. `buildguide.schema.json` (JSON Schema 2020-12, shipped in the core package under `schema/`) is the formal definition. The core check (`buildguide-check.mjs`, ported in the MkDocs plugin) covers what a schema cannot: ids, numbers and terminal names, ends that name an existing part and terminal, defined colours and the per-terminal limit, see [the check CLI](reference.md#check-cli). The [minimal examples](#minimal-examples) show one component each, the [example pages](example/index.md) use every part of the format.

## What the keys do

- **`storage`** is the `localStorage` key for the ticks. All components of a site share it. A tick belongs to one exact connection (number and both ends): changing an end clears it. Each component says at its bottom whether progress is saved in this browser, and offers `Export progress`, `Import progress` and `Reset progress`. Export downloads `<storage>.json`. Import replaces the saved progress from such a file (only an object of `true` and `false` values is accepted). Reset removes it after a confirmation. Import and reset change every component on the page at once, through a `buildguide-progress` event on `document` (`detail: {storage, saved}`).
- **`bom`** holds a note, the items with groups, a search box and the CSV export (`export` is the file name, `linkLabel` the text of the item links and of the CSV column). The component also has a `Print` button.
- **`boards`** has one entry per board key. A board has a required `title` (step navigation label, list heading and accessible name). Its parts have terminals on their sides (`ports`). Connections sit in `steps`: each step has an `id`, a `title`, an optional `note` (plain text, shown with the step above its connection list) and its `connections`, each from `PART:terminal` to `PART:terminal` with a colour code. A board also defines colour codes, part kinds, areas with cable glands and `rules` such as connections per terminal. Routes are computed (libavoid), not drawn.

Tick keys are `<prefix>-<no>:<a>:<b>` for a connection (the prefix is the board's `prefix`, default its key) and `bom-<id>:<part>` for a BOM item. Prefixes must be unique across boards and not `bom`.

## Minimal examples

One small, complete guide per component. Each file is checked against the schema and the check CLI in the tests, and each mounts in the browser tests. Save one as `guide.json`, point the plugin or `data-src` at it and place the component. The full example below uses every key.

### BOM checklist

Items with a group, a name, a specification and a quantity; the component adds search, a tick per item and the CSV export.

```json
--8<-- "packages/core/example/minimal/bom.json"
```

Place it with `<div data-buildguide="bom"></div>` (core, MkDocs) or `<BuildGuide view="bom" />` (Docusaurus). Live with the full example data: [BOM](example/bom.md).

### Wiring board

Parts with terminals on their sides, drawn where `at` and `size` put them, and numbered connections from `PART:terminal` to `PART:terminal` in steps. The colour code names the wire; the routes are computed.

```json
--8<-- "packages/core/example/minimal/wiring.json"
```

Place it with `<div data-buildguide="board" data-board="wiring"></div>` or `<BuildGuide view="board" board="wiring" />`. Live with the full example data: [Wiring](example/wiring.md).

### Tubing board

The same structure with one colour for the tube. `scope: "all"` shows every tube at first and `listAll` lists them all, whichever step is selected.

```json
--8<-- "packages/core/example/minimal/tubing.json"
```

Place it with `<div data-buildguide="board" data-board="tubing"></div>` or `<BuildGuide view="board" board="tubing" />`. Live with the full example data: [Tubing](example/tubing.md). A guide can hold a BOM and any number of boards, and a page can place any of them, as the [All components](example/all.md) page does.

## Fields

Paths read from the top of the object. `<key>` stands for a name the author chooses (a board key, a part id, a colour code), `[]` for each element of a list.

### Top level

<!-- generated: schema root -->

### BOM

<!-- generated: schema bom -->

### Boards

<!-- generated: schema board -->

## Example

```json
--8<-- "packages/core/example/guide.json"
```

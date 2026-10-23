# Data format

A guide is one JSON or YAML object that every component reads: the BOM checklist and each board. `buildguide.schema.json` (JSON Schema 2020-12, shipped in the core package under `schema/`) is the formal definition. The core check (`buildguide-check.mjs`, ported in the MkDocs plugin) covers what a schema cannot: ids, numbers and terminal names, ends that name an existing part and terminal, defined colours and the per-terminal limit, see [the check CLI](reference.md#check-cli). [Examples](examples.md) show one small guide per component, the [example pages](example/index.md) use every part of the format.

## What the keys do

- **`storage`** is the `localStorage` key for the ticks. All components of a site share it. A tick belongs to one exact connection (number and both ends): changing an end clears it. Each component says at its bottom whether progress is saved in this browser, and offers `Export progress`, `Import progress` and `Reset progress`. Export downloads `<storage>.json`. Import replaces the saved progress from such a file (only an object of `true` and `false` values is accepted). Reset removes it after a confirmation. Import and reset change every component on the page at once, through a `buildguide-progress` event on `document` (`detail: {storage, saved}`).
- **`bom`** holds a note, the items with groups, a search box and the CSV export (`export` is the file name, `linkLabel` the text of the item links and of the CSV column). The component also has a `Print` button.
- **`boards`** has one entry per board key. A board has a required `title` (step navigation label, list heading and accessible name). Its parts have terminals on their sides (`ports`). Connections sit in `steps`: each step has an `id`, a `title`, an optional `note` (plain text, shown with the step above its connection list) and its `connections`, each from `PART:terminal` to `PART:terminal` with a colour code. A board also defines colour codes, part kinds, areas with cable glands and `rules` such as connections per terminal. Routes are computed (libavoid), not drawn. A part's `name` is drawn inside the part when it has terminals on top, and its `sub` label when it has terminals at the bottom (otherwise outside, above and below), so such a part needs about 50 px of height for both, and a `#rrggbb` fill to get light text on a dark part.

Tick keys are `<prefix>-<no>:<a>:<b>` for a connection (the prefix is the board's `prefix`, default its key) and `bom-<id>:<part>` for a BOM item. Prefixes must be unique across boards and not `bom`.

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

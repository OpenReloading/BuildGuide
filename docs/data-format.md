# Data format

A guide is one JSON or YAML object that every component reads: the BOM checklist, the text steps and each board. `buildguide.schema.json` (JSON Schema 2020-12, shipped in the core package under `schema/`) is the formal definition. The core check (`buildguide-check.mjs`, ported in the MkDocs plugin) covers what a schema cannot: ids, numbers and terminal names, ends that name an existing part and terminal, defined colours and the per-terminal limit, see [the check CLI](reference.md#check-cli). [Examples](examples.md) show one small guide per component, the [example pages](example/index.md) use every part of the format.

## What the keys do

- **`storage`** is the `localStorage` key for the ticks. All components of a guide share it. `localStorage` belongs to one origin (scheme, host and port), not to a path: every guide served from an origin, a preview under another path of the same site included, reads and writes the same key. Give each guide its own `storage` (for example `<site>-<guide>`; the MkDocs and Docusaurus plugins fail the build when two guides of a site share one), or two guides tick each other's connections that have the same number and ends, see [Web Storage on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API). A guide on another origin never sees the ticks. A tick belongs to one exact connection (number and both ends): changing an end clears it. Each component says at its bottom whether progress is saved in this browser, and offers `Export progress`, `Import progress` and `Reset progress`. Export downloads `<storage>.json`. Import replaces the saved progress from such a file (only an object of `true` and `false` values is accepted). Reset removes it. Import and reset act at once, without a confirmation: the status line of the component says what happened and offers `Undo` until the next tick, a change from another component or tab, or 10 seconds. Undo brings back the previous progress, also when the browser blocks storage (then only in memory, for this visit). Import and reset change every component on the page at once, through a `buildguide-progress` event on `document` (`detail: {storage, saved, before}`).
- **`bom`** holds a note, the items with groups (each header shows how many of its items are ticked), a search box, an `All / Missing / Done` filter and the CSV export (the rows shown, with a `Done` column) (`export` is the file name, `linkLabel` the text of the item links and of the CSV column). The component also has a `Print` button.
- **`steps`** holds the text steps: an optional `title` (the tab label in the combined component, default `Steps`), an optional `note` above the list and the `items`. Each step has an `id` (unique among the steps), a `title`, an optional `text` (plain text, line breaks are kept), an optional `note` (the same string or `{ "level", "text" }` as a board step's note) and `parts`, the ids of the `bom` items the step uses (the check fails on an id the BOM does not have). The component lists the steps in order with a tick each, the names of their parts, a progress bar and a `Print` button. A board's steps are another thing: they hold connections. The 3D assembly view planned in [#47](https://github.com/OpenReloading/BuildGuide/issues/47) uses the same step shape.
- **`boards`** has one entry per board key. A board has a required `title` (step navigation label, list heading and accessible name). Its parts have terminals on their sides (`ports`). Connections sit in `steps`: each step has an `id`, a `title`, an optional `note` (plain text, shown with the step above its connection list; a string, or `{ "level": "note" | "caution" | "warning", "text": "..." }`, which shows the level word before the text and a border of its own: use `warning` for what can hurt someone or break a part, `caution` for what is easy to get wrong) and its `connections`, each from `PART:terminal` to `PART:terminal` with a colour code. A board also defines colour codes, part kinds, areas with cable glands and `rules` such as connections per terminal. Routes are computed (libavoid), not drawn. A part's `name` is drawn inside the part when it has terminals on top, and its `sub` label when it has terminals at the bottom (otherwise outside, above and below), so such a part needs about 50 px of height for both, and a `#rrggbb` fill to get light text on a dark part.

Tick keys are `<prefix>-<no>:<a>:<b>` for a connection (the prefix is the board's `prefix`, default its key), `bom-<id>:<part>` for a BOM item and `step-<id>` for a text step. Prefixes must be unique across boards and not `bom` or `step`. A board key `steps` clashes with the steps tab of the combined component and fails the check when the guide has a `steps` object.

## Fields

Paths read from the top of the object. `<key>` stands for a name the author chooses (a board key, a part id, a colour code), `[]` for each element of a list.

### Top level

<!-- generated: schema root -->

### BOM

<!-- generated: schema bom -->

### Steps

<!-- generated: schema steps -->

### Boards

<!-- generated: schema board -->

## Example

```json
--8<-- "packages/core/example/guide.json"
```

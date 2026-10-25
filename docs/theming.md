# Theming and dark mode

A component takes its colours from `--ag-*` custom properties on `.ag-guide` and its width from its container. A site restyles it by setting a token in its own stylesheet, for example `.ag-guide{--ag-accent:#0a5}`. `--ag-page` is the component background. Everything in `buildguide.css` is scoped to `.ag-guide`, so host styles for headings, tables or buttons do not reach into a component.

## Tokens

Every colour is a `light-dark(light, dark)` pair, so one value serves both schemes. The table is generated from `buildguide.css`.

<!-- generated: tokens -->

## Font and size

Two plain properties on `.ag-guide`, next to the colours:

| Property | Default | Meaning |
|---|---|---|
| `--ag-font` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | font family of the component: its text, its controls and the text in the board drawing |
| `--ag-text-small` | `11px` | font size of the smallest text: step counts, toolbar and legend, wire navigation, table headers, source links, counts, status and progress buttons, and on a phone the buttons of the wire rows and the primary button. The board canvas uses it as the smallest size a drawn label shows at on a phone (below) |

No text of the component is smaller than `--ag-text-small`. Set it to a length that resolves in the component (`12px`, `0.75rem`).

```css
/* the font of the host: give --ag-font the host's own family */
.ag-guide{--ag-font:var(--md-text-font-family)}      /* MkDocs Material */
.ag-guide{--ag-font:var(--ifm-font-family-base)}     /* Docusaurus */
.ag-guide{--ag-font:Georgia,serif}                   /* any stack */
/* larger small text */
.ag-guide{--ag-text-small:12px}
```

Set both in the stylesheet: the board reads `--ag-text-small` when it draws and when its canvas is resized, not when the property changes later. The names `--md-text-font-family` and `--ifm-font-family-base` are the ones the Material and Infima (Docusaurus) stylesheets declare; check them against the version of your theme.

Every checkbox (BOM rows, wire rows, the detail's Mark checked box) is 24 x 24 px, the minimum target size of WCAG 2.2 ([2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum)).

## Done state

A ticked BOM row or wire row stays fully legible: a tint (`--ag-done-bg`), the muted text colour and a check mark in front of the part name or connection number mark it, next to the checked box. The check mark has empty alternative text; the checkbox carries the state. In forced-colours mode the system colours apply and the check mark and box remain. Printed rows are not dimmed. In a board drawing the number pill of a ticked connection reads `✓ <number>` on a green tint (a diode has no pill, its name label gets the check mark); the check mark is text, so it survives dark mode, forced colours and printing without background graphics, and the connection's accessible name ends with `; checked`.

Two plain properties on `.ag-guide` restore dimming or strike-through. Both default to the plain look:

| Property | Default | Meaning |
|---|---|---|
| `--ag-done-opacity` | `1` | opacity of a done BOM cell or wire button and its contents, the checkbox in the BOM cell included |
| `--ag-done-decoration` | `none` | `text-decoration` of a done row's text |

```css
/* dim done rows (opacity lowers the contrast of the text and of the checkbox in it: check your colours) */
.ag-guide{--ag-done-opacity:.7}
/* strike done rows through */
.ag-guide{--ag-done-decoration:line-through}
```

## Forced colours

With `forced-colors: active` the browser replaces the component's colours with the user's system colours, and shadows and tints disappear. The stylesheet then marks state with shapes, in system colours only, so each marker stays visible (`CanvasText` is the colour a forced-colours palette guarantees to read on the background):

| State | Marker in forced colours | Otherwise |
|---|---|---|
| Selected wire row | 3px `CanvasText` outline | tint and a bar from `--ag-row-selected` and `--ag-row-selected-bar` |
| Done wire row or BOM row | 6px `CanvasText` start border, next to the check mark and the checked box | tint from `--ag-done-bg` |
| Current step | 3px border instead of 1px | tint and border from `--ag-step-current-bg` and `--ag-step-current-line` |

Outside that media query nothing changes. The tokens do not apply in forced colours.

## Board size

A board component sets `--ag-board-ratio` on its `.ag-guide` to the size of the board in the guide data, written `<width> / <height>`, for example `1360 / 860`. A host that wants the canvas as tall as the drawing needs no copy of the numbers:

```css
.ag-guide .ag-board-canvas{height:auto;aspect-ratio:var(--ag-board-ratio)}
```

On a canvas narrower than 560 px (phones) the drawing is drawn large enough for its smallest label to show at `--ag-text-small` (11 px by default, 1.29 times its natural size) or more, and the canvas pans; it opens on the selected connection. Fit shows the whole board, and zoom out stops there. In fullscreen below a component width of 900 px the canvas takes at least half the screen height (`50dvh`) and the rest of the step scrolls.

## Light and dark

Which side of a `light-dark()` pair applies follows the component's `color-scheme`:

- **Without a host signal** the browser preference decides (`prefers-color-scheme`). `data-ag-scheme="light"` on the component or on an ancestor opts out and keeps the component light.
- **With a host signal** the host sets `color-scheme: dark` on `.ag-guide`. It also sets `--ag-board-filter: invert(.9) hue-rotate(180deg)`, which darkens the board drawing: its colours come from the data, so the filter turns white paper to near black and keeps the hue of wires and parts. Set `--ag-board-filter: none` for a light host.
- **Print** is always light, whatever the screen shows. The step navigation, toolbar, search, wire navigation, Export CSV, Print and the progress buttons are hidden.

The plugins send the signal of their theme, whatever the browser prefers:

| Host | Dark when | Rule |
|---|---|---|
| MkDocs Material | `data-md-color-scheme="slate"` on `<body>` | `buildguide-mkdocs.css` |
| Docusaurus | `data-theme="dark"` on `<html>` | `buildguide-docusaurus.css` |
| Plain HTML (core) | the browser prefers dark | `buildguide.css` |

Any other host can do the same with two declarations on `.ag-guide`.

## Browser support

| Feature | Chrome | Firefox | Safari |
|---|---|---|---|
| `light-dark()` colours | 123 | 120 | 17.5 |

Older browsers drop the colour declarations and show the browser's defaults. Source: [`light-dark()` on MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark).

## Contrast

The pairs the stylesheet puts on each other meet WCAG 2.2 AA in both schemes (4.5:1 for text, 3:1 for controls, focus rings and drawn parts), done rows included; `tests/contrast.test.mjs` checks them against these tokens and `tests/guide.spec.mjs` measures a ticked row in light, dark and forced colours, and the selected, done and current markers in forced colours (width above zero, 3:1 against the row). A host that sets `--ag-done-opacity` below 1 lowers the contrast of the text and the checkbox and checks it itself. A token you override is yours to check.

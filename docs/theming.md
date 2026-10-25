# Theming and dark mode

A component takes its colours from `--ag-*` custom properties on `.ag-guide` and its width from its container. A site restyles it by setting a token in its own stylesheet, for example `.ag-guide{--ag-accent:#0a5}`. `--ag-page` is the component background. Everything in `buildguide.css` is scoped to `.ag-guide`, so host styles for headings, tables or buttons do not reach into a component.

## Tokens

Every colour is a `light-dark(light, dark)` pair, so one value serves both schemes. The table is generated from `buildguide.css`.

<!-- generated: tokens -->

## Done state

A ticked BOM row or wire row stays fully legible: a tint (`--ag-done-bg`), the muted text colour and a check mark in front of the part name or connection number mark it, next to the checked box. The check mark has empty alternative text; the checkbox carries the state. In forced-colours mode the system colours apply and the check mark and box remain. Printed rows are not dimmed.

Two plain properties on `.ag-guide` restore dimming or strike-through. Both default to the plain look:

| Property | Default | Meaning |
|---|---|---|
| `--ag-done-opacity` | `1` | opacity of a done row's text |
| `--ag-done-decoration` | `none` | `text-decoration` of a done row's text |

```css
/* dim done rows (check the contrast of your colours: opacity lowers it) */
.ag-guide{--ag-done-opacity:.7}
/* strike done rows through */
.ag-guide{--ag-done-decoration:line-through}
```

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

The pairs the stylesheet puts on each other meet WCAG 2.2 AA in both schemes (4.5:1 for text, 3:1 for controls, focus rings and drawn parts), done rows included; `tests/contrast.test.mjs` checks them against these tokens and `tests/guide.spec.mjs` measures a ticked row in light, dark and forced colours. A host that sets `--ag-done-opacity` below 1 lowers this contrast and checks it itself. A token you override is yours to check.

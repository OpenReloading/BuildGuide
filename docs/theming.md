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

By default no text of the component is smaller than `--ag-text-small`. All other text is 12 px or larger and stays fixed, so a value above `12px` makes the small text larger than some text around it: check the result. Set it to a length that resolves in the component (`12px`, `0.75rem`).

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

A ticked BOM row, step row or wire row stays fully legible: a tint (`--ag-done-bg`), the muted text colour and a check mark in front of the part name, step title or connection number mark it, next to the checked box. The check mark has empty alternative text; the checkbox carries the state. In forced-colours mode the system colours apply and the check mark and box remain. Printed rows are not dimmed. In a board drawing the number pill of a ticked connection reads `✓ <number>` on a green tint (a diode has no pill, its name label gets the check mark); the check mark is text, so it survives dark mode, forced colours and printing without background graphics, and the connection's accessible name ends with `; checked`.

Two plain properties on `.ag-guide` restore dimming or strike-through. Both default to the plain look:

| Property | Default | Meaning |
|---|---|---|
| `--ag-done-opacity` | `1` | opacity of a done BOM cell, step title and text or wire button and its contents, the checkbox in the BOM cell included |
| `--ag-done-decoration` | `none` | `text-decoration` of a done row's text |

```css
/* dim done rows (opacity lowers the contrast of the text and of the checkbox in it: check your colours) */
.ag-guide{--ag-done-opacity:.7}
/* strike done rows through */
.ag-guide{--ag-done-decoration:line-through}
```

## Note levels

A step note whose data has a `level` shows the level word (`note`, `caution` or `warning`, in capitals by CSS, the text itself is the data's word) in bold before the text, so the level never rests on colour alone. The note carries `data-level` with that level (empty for a plain string note). `caution` and `warning` also get a start border of their own style and width, which stays when a print drops backgrounds and when forced colours replace the colours (below), and a tint. A site sets the four tokens `--ag-caution-bg`, `--ag-caution-line`, `--ag-warning-bg` and `--ag-warning-line` (see [Tokens](#tokens)); keep 4.5:1 for `--ag-ink` on a background and 3:1 for a line against the page surface and its own background, as `tests/contrast.test.mjs` does for the defaults.

## Forced colours

With `forced-colors: active` the browser replaces the component's colours with the user's system colours, and shadows and tints disappear. The stylesheet then marks state with shapes, in system colours only, so each marker stays visible (`CanvasText` is the colour a forced-colours palette guarantees to read on the background):

| State | Marker in forced colours | Otherwise |
|---|---|---|
| Selected wire row | 3px `CanvasText` outline | tint and a bar from `--ag-row-selected` and `--ag-row-selected-bar` |
| Done wire row, BOM row or step | 6px `CanvasText` start border, next to the check mark and the checked box | tint from `--ag-done-bg` |
| Current step | 3px border instead of 1px | tint and border from `--ag-step-current-bg` and `--ag-step-current-line` |
| Caution note | 6px double start border | tint and border from `--ag-caution-bg` and `--ag-caution-line` |
| Warning note | 8px solid start border | tint and border from `--ag-warning-bg` and `--ag-warning-line` |

Outside that media query nothing changes. The tokens do not apply in forced colours.

## Board size

A board component sets `--ag-board-ratio` on its `.ag-guide` to the size of the board in the guide data, written `<width> / <height>`, for example `1360 / 860`. A host that wants the canvas as tall as the drawing needs no copy of the numbers:

```css
.ag-guide .ag-board-canvas{height:auto;aspect-ratio:var(--ag-board-ratio)}
```

On a canvas narrower than 560 px (phones) the drawing is drawn large enough for its smallest label to show at `--ag-text-small` (11 px by default, 1.29 times its natural size) or more, and the canvas pans; it opens on the selected connection. Fit shows the whole board, and zoom out stops there. In fullscreen below a component width of 900 px the canvas takes at least half the screen height (`50dvh`) and the rest of the step scrolls.

## Board controls

A board never traps the page scroll: a swipe or a wheel turn over a board reaches the page unless you are deliberately zooming or panning the board. The zoom stays between the whole board (Fit) and the largest size of the Zoom buttons.

| | Touch | Mouse | Trackpad | Keyboard |
|---|---|---|---|---|
| Zoom | Pinch with two fingers, around the point between them | Ctrl or Cmd with the wheel, around the pointer; the **+** and **−** buttons | Pinch (in browsers that report it as Ctrl with the wheel) | The **+** and **−** buttons |
| Pan a zoomed board | One finger; at the edge of the board the swipe goes on into the page. Two fingers pan while they pinch | Drag; a sideways wheel | Swipe sideways with two fingers | Not available |
| Scroll the page | One finger on a board that shows the whole drawing | The wheel, also over a zoomed board | Swipe up or down with two fingers | Not available |
| Show the whole board | **Fit**, which also resets the pan | **Fit** | **Fit** | **Fit** |
| Select a connection | Tap its number | Click its number | Click its number | Tab to a connection, Enter or Space; the previous and next connection buttons |
| Fullscreen | The **Fullscreen** button; the page behind does not scroll and returns to its position when the board closes | Same | Same | Same; Escape leaves it |

## Light and dark

Which side of a `light-dark()` pair applies follows the component's `color-scheme`:

- **Without a host signal** the browser preference decides (`prefers-color-scheme`). `data-ag-scheme` on the component or on an ancestor picks the side: `dark` forces dark (the `color-scheme` and the board filter below), `light` opts out and keeps the component light, `auto` is the same as no attribute: the host signal if there is one, otherwise the browser. When both `dark` and `light` are set on the component and its ancestors, `light` wins. A light host signal (the plugins' rules) wins over `dark`.
- **With a host signal** the host sets `color-scheme: dark` on `.ag-guide`. It also sets `--ag-board-filter: invert(.9) hue-rotate(180deg)`, which darkens the board drawing: its colours come from the data, so the filter turns white paper to near black and keeps the hue of wires and parts. Set `--ag-board-filter: none` for a light host.
- **Print** is always light, whatever the screen shows. The step navigation, toolbar, search, wire navigation, Export CSV, Print and the progress buttons are hidden.

The plugins send the signal of their theme, whatever the browser prefers:

| Host | Dark when | Rule |
|---|---|---|
| MkDocs Material | `data-md-color-scheme="slate"` on `<body>` | `buildguide-mkdocs.css` |
| Docusaurus | `data-theme="dark"` on `<html>` | `buildguide-docusaurus.css` |
| Plain HTML (core) | the browser prefers dark | `buildguide.css` |

Any other host can do the same with `data-ag-scheme="dark"` or with two declarations on `.ag-guide`.

## Host recipes

A few declarations on `.ag-guide` give the component the font, brand colour and page background of its host. The MkDocs plugin adds its stylesheets before the site's `extra_css`, so a plain `.ag-guide{...}` rule there wins at equal specificity. The Docusaurus recipe writes `:root .ag-guide`, which outranks the component's own rule whatever the order of the stylesheets. Both recipes use the host's own variables, which change with its colour mode, so one rule serves light and dark. This docs site loads the Material block and the Docusaurus example site the Docusaurus block (`docs/assets/buildguide-material.css`, `packages/docusaurus/example/src/css/custom.css`); `tests/guide.spec.mjs` checks the font, the colours and every pair of `tests/contrast-pairs.mjs` in both schemes against the built sites.

`--ag-accent` and `--ag-primary` take the brand colour. `--ag-surface` is also the text colour on `--ag-primary` (buttons), so the brand colour must reach 4.5:1 against the background in both schemes. A ticked row is tinted with `--ag-done-bg`, and the accent colour also colours links on it (source links): the recipes darken the background by 8 % for that tint, because the default green tint is lighter than a dark host's background and drops a link in the host's dark link colour below 4.5:1 (3.52:1 for Material's). `--ag-primary-hover` mixes the brand colour 20 % towards black in light and towards white in dark, which keeps the button text readable on hover. `color-mix()` needs Chrome 111, Firefox 113 or Safari 16.2 ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix)).

### MkDocs Material

```css
--8<-- "docs/assets/buildguide-material.css:recipe"
```

Save it as `docs/stylesheets/buildguide-material.css` in your site (this site keeps its copy in `docs/assets/`) and list it in `mkdocs.yml`:

```yaml
extra_css:
  - stylesheets/buildguide-material.css
```

Material's `--md-primary-fg-color` (the header) and `--md-accent-fg-color` do not make safe text colours: with the palette of this site (`blue grey`, `deep orange`) the primary is 2.94:1 on the dark background and the accent 2.78:1 on the light one. `--md-typeset-a-color` is the colour of the links in the page, which Material keeps readable in both schemes. Names and values: [Changing the colors](https://squidfunk.github.io/mkdocs-material/setup/changing-the-colors/); check the variables against your version.

### Docusaurus

```css
--8<-- "packages/docusaurus/example/src/css/custom.css:recipe"
```

Add the file to the classic preset (or the `theme` of `docusaurus.config.js`):

```js
presets: [['classic', { theme: { customCss: './src/css/custom.css' } }]],
```

Infima's `--ifm-background-color` is `transparent` in light mode, so the recipe uses `--ifm-background-surface-color`, which is opaque in both modes. Infima's default `--ifm-color-primary` (`#3578e5`) is 4.23:1 under white text and fails, so set the brand per colour mode as above. The dark value (`#25c2a0`) is the Docusaurus template's; its light green (`#2e8555`) is below 4.5:1 on the done tint (3.87:1 on the default one), so the recipe darkens it to `#277548`. See [Styling your site with Infima](https://docusaurus.io/docs/styling-layout#styling-your-site-with-infima).

### Contrast of the recipes

Measured in Chromium by the browser test, against the background the recipe sets:

| Host and scheme | Brand on background, background on brand (4.5) | Background on primary hover (4.5) | Brand on done row (4.5) | Body text (4.5) | Control border (3) | Focus ring (3) |
|---|---|---|---|---|---|---|
| Material, light | 6.86 | 9.11 | 5.75 | 13.08 | 3.61 | 4.21 |
| Material, dark | 4.77 | 6.27 | 4.93 | 13.28 | 4.63 | 9.13 |
| Docusaurus, light | 5.64 | 7.72 | 4.73 | 13.08 | 3.61 | 4.21 |
| Docusaurus, dark | 6.80 | 7.92 | 7.06 | 12.67 | 4.42 | 8.71 |

The bracketed numbers are the WCAG 2.2 AA minimum for the pair. Material is measured with the `blue grey` palette of this site and Docusaurus with the brand colours above (versions: Docusaurus 3.10.2, Material 9.7.7).

The host's variables follow the host's colour mode, not the component's: on a light host, `data-ag-scheme="dark"` would put a dark component's light text on the host's white background, so leave `--ag-page` and `--ag-surface` out of a site that forces the scheme.

The recipes only move `--ag-accent`, `--ag-primary`, `--ag-primary-hover`, `--ag-page`, `--ag-surface` and `--ag-done-bg`. Tints such as `--ag-surface-soft` and `--ag-line` keep their green; a site whose background is far from white or near black overrides them too. For your own colours, keep 4.5:1 for `--ag-accent` on `--ag-page`, `--ag-surface` and `--ag-done-bg` and for `--ag-surface` on `--ag-primary` and `--ag-primary-hover`, 3:1 for `--ag-control-line` and `--ag-focus` on the page, and run the browser test with your stylesheet.

### Storage key

`localStorage` belongs to one origin (scheme, host and port), not to a path. Two guides on the same origin, or a preview under another path of the site, read and write the same ticks unless their data names different keys. Set a unique `storage` per guide (see [`storage`](data-format.md#what-the-keys-do)); another origin never shares ticks. Changing a key later drops the ticks people saved under the old one.

## Browser support

| Feature | Chrome | Firefox | Safari |
|---|---|---|---|
| `light-dark()` colours | 123 | 120 | 17.5 |

Older browsers drop the colour declarations and show the browser's defaults. Source: [`light-dark()` on MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark).

## Contrast

The pairs the stylesheet puts on each other meet WCAG 2.2 AA in both schemes (4.5:1 for text, 3:1 for controls, focus rings and drawn parts), done rows included; `tests/contrast.test.mjs` checks them against these tokens and `tests/guide.spec.mjs` measures a ticked row in light, dark and forced colours, and the selected, done and current markers in forced colours (width above zero, 3:1 against the row). A host that sets `--ag-done-opacity` below 1 lowers the contrast of the text and the checkbox and checks it itself. A token you override is yours to check.

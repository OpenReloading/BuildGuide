# On-demand modules for core, and types as a check only

Status: proposed (spike #129, for the owner's decision).

## Decision

1. Split `buildguide.js` into classic scripts that load on demand, one file per feature, next to it in `packages/core/src/` (`buildguide-<name>.js`). Core loads them with the loader that already loads the board renderer. The budget of `buildguide.js` stays at 12700 bytes gzipped; each new file gets its own budget in `size.test.mjs`. That test finds shipped files with a name pattern that only knows `buildguide.js`, `buildguide-board.js`, `buildguide.css` and the third-party folder, so the pattern and the `BUDGET` keys change together: a budget alone fails the "every shipped file has a budget" test, a file alone is not measured.
2. No ES modules. Classic scripts keep working from `file:`, with the plugins' script tags and with `document.currentScript`.
3. No TypeScript source and no build step. Add JSDoc-compatible type checking with `tsc --checkJs --noEmit` as a check only, non-strict first, with the declarations in a `.d.ts` file instead of inline comments (inline JSDoc counts against the gzip budget).

## State at the time of writing

Base `f39be44`, gzip level 6 as in `packages/core/tests/size.test.mjs`.

| File | Gzipped | Budget | Left |
|---|---|---|---|
| `buildguide.js` | 12217 | 12700 | 483 |
| `buildguide-board.js` | 9052 | 9900 | 848 |
| `buildguide.css` | 5770 | 6300 | 530 |

The issue text quotes 11555 of 11600 for `buildguide.js`: the budget was raised since (#141, #145). The owner decision "split, do not raise" stands.

## Measured candidates

"Alone" is the gzip size of the new file, "core" the change in `buildguide.js` after the code moved out and a call site (and, where the code needs core's state, a context object) was added. Rows marked prototype were written for this spike and not run in a browser; rows marked estimate are not measured on code.

| Candidate | Alone | Core | Basis |
|---|---|---|---|
| Loader helper `ext(name)` | | +34 | prototype; reuses `loadScript` and the base URL of `boardRenderer` |
| Progress: export, import, reset, undo (lines 29-31 and 248-284 of `buildguide.js`, passive listeners stay) | 1178 | -636 | prototype, context object included |
| Tabs (`mountTabs`) | 1783 | -1256 | prototype, helpers passed in |
| Progress and tabs together | | -1885 | prototype; leaves 2368 bytes of the 12700 |
| CSV of the BOM (exists today) | 279 | -90 | prototype; too small to move alone |
| Print all connections and CSV of boards (#75) | about 650 | about +100 | estimate; the owner measured +261 when inline (comment on #75) |
| Image zoom dialog (#76) | 333 | +104 | prototype of the module; the call site was measured in the file; needs about 300 bytes of CSS too |
| UI strings (#77): English table kept in core | | about +300 | estimate: 66 distinct literals, 1001 bytes raw, 534 gzipped as text, 723 as a keyed table, plus the lookups |
| UI strings: one more language | about 550 | 0 | estimate, loaded only when a language is set |
| Fullscreen (board only) | 523 | -306 | prototype range cut; no context cost measured |
| Board-only interface in `buildguide.js` (steps, toolbar, summary, rows, fit) | about 2400 to 2800 | -1900 to -2200 before the context object | range cut only; not worth doing before the others |
| Text steps (`renderSteps`) | 512 | -223 | stays: used by a whole view and just shipped |

What follows from the numbers:

- Progress and tabs free about 1.9 kB and cover #75 (+100), #76 (+104) and #77 (+300) with room left. Without any split, #75 (+100) or #76 (+104, and about 300 of the 530 CSS bytes) alone fits the 483 bytes of headroom today; the three together (+504 with #77) do not.
- Moving only the BOM CSV does not pay. The export module pays once #75 puts the board CSV and the print list into it.
- Inline JSDoc is expensive under this budget: 130 synthetic one-line `@param` comments add about 485 gzipped bytes to `buildguide.js`.

## ES modules or classic scripts

Classic scripts. Reasons:

- Browsers refuse module scripts from `file:` URLs with a CORS error ([MDN, JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)). The data format accepts `file:` URLs (`safeURL` in `buildguide.js`) and the offline page targets tablets in a workshop. Unverified in this repository's tests: none opens a page from `file:`.
- `document.currentScript` is not set in module scripts; they use `import.meta.url` ([MDN, `Document.currentScript`](https://developer.mozilla.org/en-US/docs/Web/API/Document/currentScript)). Core finds the board renderer and its libraries from it, and the MkDocs plugin (`<script src defer>` in `plugin.py`) and the Docusaurus component (a script element appended in `theme/BuildGuide/index.js`) load core as a classic script. Switching changes both plugins and the example pages.
- A hybrid, a classic entry that calls dynamic `import()`, works ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)) but loses `file:` for the on-demand files, and gives no retry: `loadScript` already forgets a failed load so the next render tries again. Whether a browser retries a failed `import()` is unverified.
- Nothing in core needs bundling or tree shaking, which is what modules would add.

Request cost: each module is one more request after `buildguide.js`. A board page already loads the board renderer, its router and the WebAssembly file in a chain. Start every file a view is known to need in parallel at mount (tabs when the view is `guide`) and load click-only features (progress, the download action of export, zoom, language) when first used. The `export` module is the exception for the print list: it loads when a board mounts (see follow-up 2). Plain HTML pages need nothing: the files sit next to `buildguide.js`, which the dist archive, the MkDocs wheel and the Docusaurus copy already ship as the whole `src/` folder.

Contract for a module: a classic script that adds one function to `window.BuildGuideModules` under its name. Core passes what it needs in a context object. Mutable state (`saved`, `persistent`, `undo`) goes through accessors, which is the main cost of the split (included in the Core column).

## TypeScript

No source in TypeScript:

- Browsers do not run it, so it needs a build step, against the rule in `AGENTS.md` ("plain browser JavaScript and CSS, no build step"). The example pages, the dist script, the MkDocs build hook and `copy-core.mjs` all take `src/` as it is.
- The published `buildguide-check` command runs from `node_modules`, where Node refuses to run TypeScript files ([Node.js, TypeScript](https://nodejs.org/api/typescript.html)).

JSDoc with `tsc --checkJs` as a check only keeps the rule. Measured with TypeScript 7.0.2 over `buildguide.js` and `buildguide-board.js` (`--allowJs --checkJs --noEmit --lib es2023,dom,dom.iterable`):

| Setting | Errors |
|---|---|
| the flags above (defaults of TypeScript 7, strict) | 273, of which 187 are untyped parameters (TS7006) |
| the flags above plus `--strict false` | 16: globals the code adds (`window.BuildGuide`, `BuildGuideBoard`, `document$`, `joint`), `dataset` and `src` on elements typed as `Element`, one `fetch` overload; none is a logic fault |

Effect on the published packages: none. No emit, no change to the files that ship. Costs: a `typescript` dev dependency (3.6 MB installed), a `tsconfig.json`, an `npm run typecheck` step in `npm run lint` and the `check` job, and the 16 fixes. Put the globals and the guide data types in a `.d.ts` file outside `src/`; annotate inline only at module boundaries. The check is `tsc -p packages/core` (the `npm run typecheck` script): `packages/core/tsconfig.json` lists `buildguide.js`, `buildguide-board.js` and the `.d.ts` in `files`, so the declarations are part of every run. Going strict later needs about 190 parameter types and costs bytes (see above), so it is not part of this decision.

## Follow-up work

1. Loader and the `progress` module (first user of the loader; the size test, the file list in `docs/hooks/reference.py` and the offline page learn about extra files).
2. #75 as an `export` module on top of 1 (CSV and print list; the print list must exist for Ctrl+P, which cannot wait for a load, so the module loads when a board mounts).
3. Tabs as a module.
4. Type check with `tsc --checkJs`, non-strict.
5. #76 (`zoom` module and its CSS) and #77 (English table in core, one file per language) follow 1; their own issues stay.

Unmeasured: behaviour of any prototype in a browser, the context object for the board interface, the CSS of the zoom dialog, the requests of a cold `file:` page.

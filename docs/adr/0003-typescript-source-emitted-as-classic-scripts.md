# TypeScript source, emitted as classic scripts

Status: accepted. Supersedes decision 3 and the TypeScript section of [0001](0001-on-demand-modules-and-types.md).

## Decision

1. Core (the browser scripts and the check CLI) and the Docusaurus plugin are written in TypeScript and type checked in strict mode, with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals` and `noUnusedParameters` on top (`tsconfig.base.json`). No suppression comments.
2. Plain `tsc` emits them, in build mode with project references (`tsc -b`). No bundler: the browser files import nothing at run time, so there is nothing to bundle.
3. The browser files stay classic scripts. Their sources have no `import` or `export`, so the compiler treats them as scripts and emits them without either; `document.currentScript` still finds the sibling files and pages still work from `file:`. They compile with `module: esnext` and `moduleResolution: bundler`, because with `module: nodenext` the package's `"type": "module"` would make every `.ts` file a module ([moduleDetection](https://www.typescriptlang.org/tsconfig/#moduleDetection)). Their shared declarations (the guide data, `window.BuildGuide`, the mount options, the `buildguide-progress` event, the contracts of the on-demand files) are global declarations in `buildguide.ts`; the guide data types are exported by the check module and referenced with `import()` types, which keep a script a script.
4. `src/` is the source: the TypeScript files, `buildguide.css` and the unmodified third-party files in `src/vendor/`. `lib/` is the folder that ships: the emitted scripts and the check CLI, their generated declarations, and the stylesheet and third-party files copied unchanged. `npm run build` builds it from scratch, so no output of a renamed or deleted source stays. The release archive is `lib/` without the declarations, in the same layout as before.
5. The declarations are generated, never written by hand: `buildguide-check.d.mts` (the guide data types and `check`) and `buildguide.d.ts` (the global browser surface). The hand-written `types/buildguide.d.ts` is gone; it was one field behind the schema (`imageAlt`).
6. The gzip budgets of `tests/size.test.mjs` apply to the emitted files in `lib/`. The emitted scripts carry no comments (`removeComments`); the comments stay in the source. The budgets keep their values.
7. The Docusaurus plugin compiles in two parts, as Docusaurus' own plugins do: the Node part as CommonJS (`export =`, so `require` returns the plugin function as before) and the theme component as an ES module for the site's bundler.

## State at the time of writing

Emitted with TypeScript 7.0.2, measured with zlib level 6 against the budgets:

| File | Budget | Hand-written script before | Emitted |
|---|---|---|---|
| `buildguide.js` | 12,700 | 12,174 | 10,352 |
| `buildguide-board.js` | 9,900 | 9,015 | 7,504 |
| `buildguide-progress.js` | 850 | 771 | 632 |
| `buildguide-zoom.js` | 1,000 | 944 | 674 |
| `buildguide-export.js` | 1,090 | 988 | 816 |

The compiler reprints the code (four-space indentation, one statement per line). With comments the emitted `buildguide.js` measured 12,560 bytes before typing, 140 bytes under its budget; without them the string table and the tabs work have room again.

## Findings of the spike

- TypeScript 7.0.2 emits script-mode files as classic scripts, builds project references with `tsc -b` and emits declarations for scripts and modules alike.
- `removeComments` also strips the doc comments from the emitted declarations of the browser scripts; the check module keeps them, since its configuration keeps comments.
- The JointJS types come from `@joint/core` at the vendored version (4.3.3), a dev dependency used for types only. The published declarations of libavoid-js 0.5.0-beta.5 name a file in `exports` that the package does not contain and type the library as `any`, so the board renderer declares the dozen members it uses itself.
- The Docusaurus types need `skipLibCheck` for the plugin's Node part: they pull in React, MDX and bundler declarations that do not check on their own.

## Rejected

- JSDoc with `checkJs` in strict mode: the types would have to be inline comments, which count against the gzip budgets, and JSDoc types are weaker.
- A bundler: a second tool for files that import nothing.
- Emitting into `src/` next to the sources: generated files mixed with source files.

## Consequences

- A build step comes before the example pages and the browser tests: `npm run build -w packages/core` (`npm run serve`, `npm test`, `npm run test:browser` and `npm run dist` run it). The Docusaurus plugin's `npm run compile` builds core first and copies its `lib/` into `core/`.
- The npm package of core ships `lib/` instead of `src/`. The release archive keeps its layout.
- The release jobs install the dependencies before they build.

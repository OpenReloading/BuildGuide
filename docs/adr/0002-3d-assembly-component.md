# 3D assembly component: own renderer, on demand

Status: proposed (spike #130 for #47, for the owner's decision).

## Acceptance criteria

Derived from the issue body and the owner's comment on #130 (the comment overrides the body):

1. An option table with gzip size, licence and offline behaviour per option, and whether it loads only on a page with an assembly block.
2. A prototype on a branch (not merged) that moves one AutoLever part into place, with its byte cost.
3. A recommendation (go, change scope or drop) and follow-up issues.
4. Answers to the questions of the issue: own file and own budget, the keys of #47 against AutoLever's guide and the smallest first version, accessibility.

Item 2 is the branch `ESchuderer/q-buildguide-130-prototype`, commit [`9bc055d`](https://github.com/OpenReloading/BuildGuide/tree/9bc055d89bc5926a23cddcf44d0000cede655374/packages/core/prototype/assembly), with its own README. This pull request carries the decision record only. The follow-up issues are drafted below and not filed.

## Decision

1. Go, with a reduced scope: write the renderer in this repository (WebGL, binary STL, no third-party code), as the classic script `buildguide-assembly.js` next to `buildguide.js`. Core loads it with `loadScript` when a `data-buildguide="assembly"` block mounts, so other pages never request it.
2. Its own budget in `size.test.mjs` (4600 bytes gzipped for the prototype, which measures 4187).
3. First version: one `assembly` object, STL models, steps that move parts and fasteners into place, a "play all" that runs the steps in sequence (not in the prototype: it is the same tween over every step, so no new technique), an orbit camera on pointer and keyboard, a step list, reduced motion, progress ticks in the shared `storage`. No explode slider, no section cut, no transparency, no glTF.
4. Do not bundle three.js or `<model-viewer>`. Revisit only if a consumer needs lit physically based materials, glTF animation or skinning. AutoLever does not; the Feeder viewer uses a standard material (see "Not decided here").

This changes the line of #47 that reads "three.js bundled or pinned" to "no third-party code"; the offline requirement (no request outside the site) stays.

## Options

Gzip level 6 as in `packages/core/tests/size.test.mjs`, 2026-10-28. Library bundles built with esbuild 0.28.2 (`--bundle --minify --format=iife`) from the npm release named, the entry file importing only the listed names. "Alone" is what a page with an assembly block downloads for the renderer, without models.

| Option | Alone, gzipped | Licence (npm metadata) | Loads on demand | Offline | Notes |
|---|---|---|---|---|---|
| Own WebGL renderer (prototype) | 4187, plus 155 in `buildguide.js` and 140 in `buildguide.css` | MIT (this repository) | yes, `loadScript` from the call site | yes, no request but the models | STL only; camera, step motion, keyboard, step list included |
| three.js 0.186.1, tree-shaken: renderer, standard material, two lights, STL loader, orbit controls | 142591 | MIT | yes, if bundled as one classic file | yes | the 0.186.1 package has no classic (non-module) build, so the file is a generated bundle; the scene, camera and step logic are still ours |
| three.js 0.186.1, whole namespace | 191625 | MIT | as above | yes | `three.module.js` plus `three.core.js` unbundled: 131382 plus 288150, modules only |
| OGL 1.0.11: renderer, camera, mesh, program, geometry, orbit | 15844 | Unlicense | yes, if bundled | yes | no loader, no lighting: shader and STL parser are still ours, so nothing is saved over the prototype |
| twgl.js 7.0.0: program, buffer and draw helpers, `m4` | 13528 (`twgl-full.js` as published: 87370) | MIT | yes | yes | helpers only: no camera, no loader |
| regl 2.1.1 (`regl.min.js` as published) | 28458 | MIT | yes | yes | state wrapper only: no camera, no loader |
| `@google/model-viewer` 4.4.0 (`model-viewer-umd.min.js`, three inside) | 289966 (143873 without three, which it then needs separately) | Apache-2.0 | yes, as a custom element | not by default, see below | glTF and GLB only, no STL |

Offline of `<model-viewer>`: the published bundle contains the default locations `https://www.gstatic.com/draco/versioned/decoders/1.5.6/` and `https://www.gstatic.com/basis-universal/versioned/2021-04-15-ba1c3e4/` (found by searching the file). I did not run it, so whether a page requests them only for Draco or KTX2 content is unverified; the locations can be overridden in its API (unverified). It animates through the animation clips stored in a glTF file, so each assembly step would be authored as a clip in the CAD export, not as data in the guide. Not measured on a page.

For scale, the board stack that a board page loads today is 351280 bytes gzipped: `joint.min.js` 144003, `libavoid.wasm` 180983, `libavoid/index.js` 17289, `buildguide-board.js` 9005. Even the tree-shaken three.js (142591) is below that, so the size alone would not forbid it. What forbids it is the convention in `AGENTS.md` that third-party code sits in the third-party folder of `src/`, unmodified: a tree-shaken three.js is a generated file, and a repository build step for it is a decision of its own. The prototype needs none.

How the library numbers were made: `npm install --legacy-peer-deps` of the releases named in a scratch folder (`@google/model-viewer` asks for three `^0.183.0`), then esbuild on an entry file that imports only these names and assigns them to `window`: three.js `WebGLRenderer, Scene, PerspectiveCamera, Mesh, MeshStandardMaterial, DirectionalLight, HemisphereLight, Color, Group` plus `STLLoader` and `OrbitControls` from `examples/jsm`; OGL `Renderer, Camera, Transform, Mesh, Program, Geometry, Orbit, Mat4, Vec3`; twgl.js `createProgramInfo, createBufferInfoFromArrays, setBuffersAndAttributes, setUniforms, drawBufferInfo, resizeCanvasToDisplaySize, m4` from `twgl.js/dist/7.x/twgl-full.module.js`. The "whole namespace" row assigns all of `three` to `window`. The published files (regl, `twgl-full.js`, model-viewer, the two three.js modules) were measured as shipped. The entry files are not in the repository.

## Prototype

A page with two clamp halves and two bolts: the lower half rises into place, the upper half lowers onto it, the bolts drop in along their axes ([screenshots](https://github.com/OpenReloading/BuildGuide/tree/9bc055d89bc5926a23cddcf44d0000cede655374/packages/core/prototype/assembly)). The clamp halves are the handle clamp of `cad/` in OpenReloading/AutoLever (MIT, commit `d31a866`), rendered with OpenSCAD 2021.01 in about 2 seconds for both halves; the bolt is invented. Struts, nuts and washers are not modelled.

| Part | Raw | Gzipped |
|---|---|---|
| `buildguide-assembly.js` | 10351 | 4187 |
| call site in `buildguide.js` | | +155 (12157 of 12700) |
| rules in `buildguide.css` | | +140 (5910 of 6300) |
| `clamp-top.stl`, 1376 triangles | 68884 | 15471 |
| `clamp-bottom.stl`, 1390 triangles | 69584 | 15687 |
| `bolt.stl`, 148 triangles | 7484 | 1320 |
| one assembly page, all of the above | about 156 kB | about 37 kB |

The models are three quarters of the transfer. They are unindexed binary STL (50 bytes per triangle); indexing the vertices would shrink them (not measured). Whether a host compresses `.stl` files is not measured; a host that serves them as plain binary sends 146 kB raw for this assembly.

Checked in headless Chromium in the dev container (software WebGL, no flags): five new browser tests (mount draws a non-empty canvas and requests each model once, step buttons and list, camera by arrow keys and `Home`, reduced motion, no request of the renderer or a model on a page without a block), no request outside the test server, no console error; the whole core browser suite (177 passed, 6 skipped, run before the fifth test was added), `npm run lint` and `npm test` pass on the prototype branch. Not checked: Firefox and WebKit, touch, forced colours, a lost context, `file:` pages, the MkDocs and Docusaurus wrappers, the schema.

## Own file and own budget

Yes. The prototype is one classic script in `packages/core/src/`, loaded by the same `loadScript` that loads the board renderer, and `window.BuildGuideAssembly` follows `window.BuildGuideBoard`. What changes outside it, all small:

- `size.test.mjs`: the file pattern gets `-assembly` and `BUDGET` a key (a budget alone fails "every shipped file has a budget"), as [ADR 0001](0001-on-demand-modules-and-types.md) describes.
- `biome.jsonc`: the file joins the override that switches `noRedundantUseStrict` off for classic scripts.
- `docs/hooks/reference.py` lists the core files a site copies (line 102); the offline page needs the models as well.
- When ADR 0001 lands, the script adopts its module contract (`window.BuildGuideModules`) instead of a global.

`buildguide.js` grows by 155 bytes (budget 12700, 12157 measured); the call site is the only part of the feature in the always-loaded file.

## Data: do the keys of #47 suffice?

The keys `models`, `parts`, `fasteners`, `steps` and `views` carry AutoLever's two mechanical assemblies. Its control box has an `exploded` mode in `cad/` that lifts the plate and the lid by 60 and 70 units, and its handle clamp has two halves and bolts. That is one `explode` vector per part and instance matrices per fastener, which the prototype's `guide.json` shows. AutoLever has no assembly steps in `data/guide.yaml` today and no mesh export: the CAD files are OpenSCAD sources, so the guide needs an export step that writes STL (`-D part=...`) and the step texts written by hand.

What the keys need beyond #47's list:

- `step` on a part or fastener as a step id (the prototype uses an index), checked against `steps`.
- `explode` as a vector (direction times distance in model units).
- `materials`: colour and opacity per key, because bought parts are drawn as ghosts in AutoLever's CAD (colour with alpha 0.8) and `colour or material key` is ambiguous otherwise.
- Matrices column-major with 16 finite numbers, rigid (no scale or shear): the check should say so. Z up, millimetres, stated once in the format description (STL has no units).
- `views`: `azimuth`, `elevation` and a distance factor of the fitted size.

Wanted by the reference page of the first consumer (`feeder/viewer.html` in OpenReloading/Feeder: instanced fasteners that ride with their host part, tool parts visible in one step only, a section cut, per-kind opacity, a tilt of the body about an axis) but not by AutoLever, so not in the first version: `tool`, `clip`, a `rotate` motion. They are estimates of a few hundred bytes each in an own renderer (unmeasured), and they decide whether the Feeder can move to the component (OpenReloading/Feeder#24 states "same steps, parts, fasteners and animation as today").

Smallest first version: one `assembly` object with one or more models, steps and their texts, parts and fasteners with a step and an explode vector, the default view. The prototype has exactly this, 4187 bytes plus the models.

Format changes follow the rule in `AGENTS.md`: `schema/buildguide.schema.json` (its root has `additionalProperties: false`, so it rejects `assembly` today; `buildguide-check.mjs` does not look at unknown keys), `src/buildguide-check.mjs`, `packages/mkdocs/.../check.py`, `example/guide.json` and the tests change together, with a fixture in `packages/core/tests/fixtures/`.

## Accessibility

Done in the prototype and tested unless marked:

- Keyboard camera: the canvas takes focus, arrow keys turn, `+` and `-` zoom, `Home` resets; Tab leaves it (no trap). Tested for turning and reset.
- Text alternative: every step is text in the DOM (title and text), the current one is `aria-current="step"`, a `role="status"` line announces "Step n of m", and the canvas label repeats the step text and the keys. When #72's text steps exist, the assembly's step text should point at them by id instead of repeating them (a follow-up, not decided here).
- Reduced motion: with `prefers-reduced-motion: reduce` the final position is drawn at once; the setting is read at each draw, so a change applies without a reload. Tested.
- No WebGL: the canvas is replaced by a sentence and the step list stays. Not tested.
- Open: pointer drag on a touch screen with `touch-action: none` captures vertical scrolling over the canvas, so a page can become hard to scroll past it (a rotate toggle or a two-finger gesture is the usual answer, untested); model colours are fixed hex values on a transparent canvas, so contrast against a dark theme is the author's job; forced colours do not change canvas pixels, so the text list is the access path; no axe run on the prototype page.

## Follow-up issues

Drafted, not filed.

1. **Assembly data format**: `assembly` in the schema, both checkers and a fixture. Done when: the schema and both checkers accept the example and reject a missing step reference, a duplicate id, a matrix of the wrong length, a non-finite number and an unknown model key; `docs/data-format.md` describes the keys; `example/guide.json` has an `assembly`.
2. **Assembly component in core**: the renderer as `buildguide-assembly.js` with its budget, the loader call site, the biome override and the file list. Done when: `<div data-buildguide="assembly">` mounts from the example guide, with a "play all" over the steps, ticks use the `storage` key with a new reserved prefix (named in `AGENTS.md`), the hash holds the step (`#<key>=<step>`), a browser test mounts it with no request outside the site, and a page without a block requests neither script nor model. Blocked by 1 and, for the module contract, by ADR 0001.
3. **Assembly in the MkDocs and Docusaurus wrappers**: markup, model files copied next to the data, the offline page lists them. Done when: the docs site and the Docusaurus example host `/example/assembly/` and the browser tests pass for both. Blocked by 2.
4. **Assembly renderer extras**: transparency for ghost parts, tool parts visible in one step, a rotating motion, a section cut, each measured in gzip bytes. Done when: the Feeder's current page can be expressed in the data, or the missing feature is named. Blocked by 2.
5. **Assembly accessibility pass**: touch scrolling, no-WebGL fallback test, forced colours and dark theme, axe, a screen reader pass, step text shared with #72. Blocked by 2.
6. **AutoLever mesh export and assembly steps** (in OpenReloading/AutoLever): an STL export from `cad/` in the build and step texts for the clamp and the control box. Blocked by 1.

## Not decided here

- Whether the Feeder needs a lit, physically based look; if so, the three.js route (142591 bytes gzipped, a generated file in the third-party folder, an owner decision on the convention) is the alternative to follow-up 4.
- A compressed model format (gzip through `DecompressionStream`, indexed vertices, quantized positions): worth measuring when a real model exceeds the numbers above.
- A size limit for models in the check (triangles per file).

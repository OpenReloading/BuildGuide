# Board renderer without third-party code (prototype)

`board-svg.js` draws the boards of a guide with plain SVG and routes the connections with an own orthogonal router, so a board needs no JointJS and no libavoid. It is a prototype for [#1](https://github.com/OpenReloading/BuildGuide/issues/1): it is not shipped, not loaded by the component and not part of any package. The third-party files under `src/` stay as they are until the owner decides.

It has the entry point, the options and the DOM hooks of `src/buildguide-board.js` (`data-connection`, `role`, `tabindex`, the `aria-label` texts, `data-ready`, the `joint-*` hooks and `model-id` attributes the browser tests read, the `✓ ` mark and `; checked`), so the component and the browser tests run against it as they are.

## Compare

```sh
cd packages/core
node prototype/compare.mjs            # screenshots, counts, size and time into prototype/comparison/, then the browser tests against the prototype
SKIP_SPECS=1 node prototype/compare.mjs
```

The script copies the package twice per guide into `test-results/compare/`, puts `board-svg.js` in place of `src/buildguide-board.js` in one copy and empties the third-party script there, serves each copy and reads the drawn geometry the way `tests/board-layout.spec.mjs` does. `dense-guide.json` is the 52-wire wiring board and the tubing board of a published build guide of the same organisation (MIT, notes and bill of materials left out, one part kind renamed). To run only the unchanged browser tests against the prototype, run `npx playwright test` in `test-results/compare/prototype-demo`.

`tests/board-route.test.mjs` covers the router with a few small cases.

## How it routes

1. Every part, caption and prop is a rectangle, padded where it has terminals, with walls for boxes with glands.
2. A grid is built from the edges of the rectangles (grown by a buffer of 14, 8, 4, 0 px, the widest that routes every wire wins), the points where wires leave the terminals and the middle of wide gaps.
3. Wires are routed one after another, shortest first, with A* over (point, heading): length, a penalty per bend, a higher one per crossing of a routed wire, one for running on an edge another wire uses.
4. Parallel legs of different wires are spread over the room between the parts, at least 14 px apart where the room allows; the legs at the terminals stay.

## Known limits

- The router has no global view: crossings and bends are higher than with libavoid on dense boards (see `comparison/results.md`).
- The nudging is one pass and does not look at bends of other groups, so a leg can pass within a few pixels of a part label.
- Two wires of the dense board (18 and 30, from the sensors) take a long detour along the border of the board instead of the short way through the gland; the cause is not found.
- A wire with no way round is drawn as a straight line, which is not orthogonal and shows.

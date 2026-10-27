| dataset | renderer | views | notOrthogonal | throughPart | acrossLabel | tooClose | badgeOverlap | badgeOnPart | badgeOnBend | noRoute | bends | crossings | length |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| demo | shipped | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100 | 17 | 12590 |
| demo | prototype | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 118 | 20 | 13442 |
| dense | shipped | 11 | 0 | 0 | 0 | 122 | 6 | 0 | 13 | 0 | 362 | 130 | 50411 |
| dense | prototype | 11 | 0 | 2 | 2 | 118 | 7 | 1 | 7 | 0 | 480 | 211 | 54807 |

| board, all connections | renderer | wires | bends | crossings | too close | cold load to drawn (ms) | all connections drawn (ms) |
|---|---|---|---|---|---|---|---|
| demo wiring | shipped | 13 | 47 | 11 | 0 | 38 | 42 |
| demo tubing | shipped | 6 | 6 | 0 | 0 | 35 | n/a |
| demo wiring | prototype | 13 | 59 | 17 | 0 | 16 | 11 |
| demo tubing | prototype | 6 | 6 | 0 | 0 | 15 | n/a |
| dense wiring | shipped | 52 | 181 | 96 | 107 | 52 | 507 |
| dense tubing | shipped | 7 | 4 | 0 | 0 | 35 | n/a |
| dense wiring | prototype | 52 | 287 | 176 | 115 | 16 | 58 |
| dense tubing | prototype | 7 | 4 | 0 | 0 | 15 | n/a |

times: median of 5 runs in headless Chromium on the development machine, loopback server
gzipped bytes: shipped 353224 (board script, two third-party scripts, wasm), prototype 11960
browser tests against the prototype: [167/167] [chromium] › tests/guide.spec.mjs:1671:3 › without JavaScript › a component says it needs JavaScript   6 skipped   161 passed (35.3s)

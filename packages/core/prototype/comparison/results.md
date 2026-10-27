| dataset | renderer | views | notOrthogonal | throughPart | acrossLabel | tooClose | badgeOverlap | badgeOnPart | badgeOnBend | noRoute | outside | bends | crossings | length |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| demo | shipped | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100 | 17 | 12590 |
| demo | prototype | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 118 | 20 | 13442 |
| dense | shipped | 11 | 0 | 0 | 0 | 122 | 6 | 0 | 13 | 0 | 0 | 362 | 130 | 50411 |
| dense | prototype | 11 | 0 | 0 | 1 | 109 | 8 | 1 | 9 | 0 | 0 | 478 | 214 | 55180 |

| board, all connections | renderer | wires | bends | crossings | too close | cold load to drawn (ms) | all connections drawn (ms) |
|---|---|---|---|---|---|---|---|
| demo wiring | shipped | 13 | 47 | 11 | 0 | 38 | 42 |
| demo tubing | shipped | 6 | 6 | 0 | 0 | 36 | n/a |
| demo wiring | prototype | 13 | 59 | 17 | 0 | 16 | 11 |
| demo tubing | prototype | 6 | 6 | 0 | 0 | 15 | n/a |
| dense wiring | shipped | 52 | 181 | 96 | 107 | 52 | 506 |
| dense tubing | shipped | 7 | 4 | 0 | 0 | 36 | n/a |
| dense wiring | prototype | 52 | 285 | 179 | 106 | 17 | 56 |
| dense tubing | prototype | 7 | 4 | 0 | 0 | 15 | n/a |

times: median of 5 runs in headless Chromium on the development machine, loopback server
gzipped bytes: shipped 353224 (board script, two third-party scripts, wasm), prototype 12101
browser tests against the prototype: [167/167] [chromium] › tests/guide.spec.mjs:1671:3 › without JavaScript › a component says it needs JavaScript   6 skipped   161 passed (35.6s)

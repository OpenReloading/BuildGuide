<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="site/static/assets/buildguide-dark.svg"><img src="site/static/assets/buildguide-light.svg" width="320" alt="OpenReloading BuildGuide"></picture></p>

# BuildGuide

[![Sponsor](https://img.shields.io/badge/Sponsor-eikelandin-db61a2?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/eikelandin)
[![CI](https://github.com/OpenReloading/BuildGuide/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/OpenReloading/BuildGuide/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/OpenReloading/BuildGuide/badge)](https://scorecard.dev/viewer/?uri=github.com/OpenReloading/BuildGuide)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Release: core](https://img.shields.io/github/v/release/OpenReloading/BuildGuide?filter=core-v*)](https://github.com/OpenReloading/BuildGuide/releases)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/hUCSjDYNaa)

A parts checklist plus wiring and tubing diagrams for your build documentation, from one data file. Readers tick off each part and connection as they build, and the ticks stay in their browser.

For people who document a hardware build on a MkDocs, Docusaurus or plain HTML site.

Try the [live example](https://openreloading.github.io/BuildGuide/example/) (a 12 V control box) or serve it with Node:

```sh
git clone https://github.com/OpenReloading/BuildGuide.git
cd BuildGuide
npm run serve -w packages/core   # http://127.0.0.1:8080/example/
```

Install with [`core`](packages/core/) (plain HTML), [`mkdocs`](packages/mkdocs/) or [`docusaurus`](packages/docusaurus/). The [docs](https://openreloading.github.io/BuildGuide/) cover the data format and theming.

[Releases](https://github.com/OpenReloading/BuildGuide/releases). Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [policy](https://github.com/OpenReloading/.github/blob/main/SECURITY.md).

MIT (`LICENSE`). Core bundles JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later) unmodified, see its [licenses](packages/core/README.md#licenses).

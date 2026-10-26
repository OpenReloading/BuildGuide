<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/buildguide-dark.svg"><img src="docs/assets/buildguide-light.svg" width="320" alt="OpenReloading BuildGuide"></picture></p>

# BuildGuide

A parts checklist plus wiring and tubing diagrams for your build documentation, from one data file. Readers tick off each part and connection as they build, and the ticks stay in their browser.

For people who document a hardware build on a MkDocs, Docusaurus or plain HTML site.

Try the [live example](https://openreloading.github.io/BuildGuide/example/) (a 12 V control box) or serve it with Node:

```sh
git clone https://github.com/OpenReloading/BuildGuide.git
cd BuildGuide
npm run serve -w packages/core   # http://127.0.0.1:8080/example/
```

Install with [`core`](packages/core/) (plain HTML), [`mkdocs`](packages/mkdocs/) or [`docusaurus`](packages/docusaurus/). The [docs](https://openreloading.github.io/BuildGuide/) cover the data format and theming.

[Releases](https://github.com/OpenReloading/BuildGuide/releases). Questions: [Discord](https://discord.gg/KkYJ5fdukR). Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [policy](https://github.com/OpenReloading/.github/blob/main/SECURITY.md).

MIT (`LICENSE`). Core bundles JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later) unmodified, see its [licenses](packages/core/README.md#licenses).

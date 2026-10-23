<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/buildguide-dark.svg"><img src="docs/assets/buildguide-light.svg" width="320" alt="OpenReloading BuildGuide"></picture></p>

# BuildGuide

Interactive build guides from one JSON file: a BOM checklist, and wiring and tubing boards with a tick per connection, for your own documentation pages. Plain JavaScript and CSS, no requests outside the site.

**Docs, install, data format and live examples: https://openreloading.github.io/BuildGuide/**

| Package | For |
|---|---|
| [`core`](packages/core/) | any static site: browser components, schema, check CLI |
| [`mkdocs`](packages/mkdocs/) | MkDocs: components in Markdown, data checked at build time |
| [`docusaurus`](packages/docusaurus/) | Docusaurus: `<BuildGuide />` component |

Releases: [GitHub Releases](https://github.com/OpenReloading/BuildGuide/releases). Questions and ideas: [Discord](https://discord.gg/KkYJ5fdukR). Contributing and dev commands: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [policy](https://github.com/OpenReloading/.github/blob/main/SECURITY.md).

MIT (`LICENSE`). Core vendors JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later) unmodified, see `packages/core/src/vendor/README.txt` and #1.

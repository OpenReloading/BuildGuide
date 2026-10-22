<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/buildguide-dark.svg"><img src="docs/assets/buildguide-light.svg" width="320" alt="OpenReloading BuildGuide"></picture></p>

# BuildGuide

Interactive build guides from one JSON file: introduction, BOM checklist, and wiring and tubing boards with a tick per connection. Plain JavaScript and CSS, no requests outside the site.

| Component | Folder | Release |
|---|---|---|
| core: browser library, schema, check CLI | [`packages/core/`](packages/core/) | `core-v*`: `buildguide-<version>.tar.gz`, `SHA256SUMS` |
| mkdocs: MkDocs plugin | [`packages/mkdocs/`](packages/mkdocs/) | `mkdocs-v*`: wheel and sdist |
| docusaurus: Docusaurus plugin | [`packages/docusaurus/`](packages/docusaurus/) | `docusaurus-v*`: `openreloading-docusaurus-plugin-buildguide-<version>.tgz` |

Docs and the live example guide: https://openreloading.github.io/BuildGuide/. Each component has its own version, changelog and tag. Releases: [GitHub Releases](https://github.com/OpenReloading/BuildGuide/releases).

Questions and ideas: [Discord](https://discord.gg/KkYJ5fdukR).

## Development

Builds and tests run in the dev container (`.devcontainer/`, Playwright image with uv):

```sh
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . npm run lint           # Biome, ruff, no em dash or emoji
devcontainer exec --workspace-folder . npm test               # unit tests of every component
devcontainer exec --workspace-folder . npm run test:browser   # browser tests: core example, docs site, Docusaurus example
devcontainer exec --workspace-folder . npm run docs           # docs site into site/
devcontainer exec --workspace-folder . npm run dist           # release archives
```

Pull requests: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [security policy](https://github.com/OpenReloading/.github/blob/main/SECURITY.md).

## Licenses

MIT (`LICENSE`). Audit exceptions (advisories without a fix): `scripts/audit.mjs`. Core vendors JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later) unmodified, see `packages/core/src/vendor/README.txt` and #1.

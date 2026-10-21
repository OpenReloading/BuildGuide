<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/buildguide-dark.svg"><img src="docs/assets/buildguide-light.svg" width="320" alt="OpenReloading BuildGuide"></picture></p>

# BuildGuide

Interactive build guides from one JSON file: introduction, BOM checklist, and wiring and tubing boards with a tick per connection. Plain JavaScript and CSS, no requests outside the site.

| Component | Folder | Release |
|---|---|---|
| core: browser library, schema, check CLI | [`packages/core/`](packages/core/) | `core-v*`: `buildguide-<version>.tar.gz`, `SHA256SUMS` |

Each component has its own version, changelog and tag. Releases: [GitHub Releases](https://github.com/OpenReloading/BuildGuide/releases).

## Development

Builds and tests run in the dev container (`.devcontainer/`, Playwright image):

```sh
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . npm run lint           # Biome, no em dash or emoji
devcontainer exec --workspace-folder . npm test               # unit tests of every component
devcontainer exec --workspace-folder . npm run test:browser   # browser tests
devcontainer exec --workspace-folder . npm run dist           # release archives
```

Pull requests: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).

## Licenses

MIT (`LICENSE`). Core vendors JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later) unmodified, see `packages/core/src/vendor/README.txt` and #1.

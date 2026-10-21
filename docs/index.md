# BuildGuide

Interactive build guides from one data file: introduction, BOM checklist, and wiring and tubing boards with a tick per connection. Plain JavaScript and CSS, no requests outside the site. Source and releases: [OpenReloading/BuildGuide](https://github.com/OpenReloading/BuildGuide).

| Component | Use | Release |
|---|---|---|
| [Core](core.md) | browser library, JSON Schema and check CLI for any static site | `core-v*`: `buildguide-<version>.tar.gz` |
| [MkDocs plugin](mkdocs.md) | guide pages from front matter, data checked at build time | `mkdocs-v*`: wheel and sdist |
| [Docusaurus plugin](docusaurus.md) | `<BuildGuide page="..."/>` component, data checked at build time | `docusaurus-v*`: npm .tgz |

The [data format](data-format.md) is the same for every component. The [example guide](example/index.md) on this site is built with the MkDocs plugin from `packages/core/example/guide.json`.

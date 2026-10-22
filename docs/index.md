# BuildGuide

Interactive build guide components from one data file: a BOM checklist, and wiring and tubing boards with a tick per connection, to place in your own documentation pages. Plain JavaScript and CSS, no requests outside the site. Source and releases: [OpenReloading/BuildGuide](https://github.com/OpenReloading/BuildGuide).

| Component | Use | Release |
|---|---|---|
| [Core](core.md) | browser components, JSON Schema and check CLI for any static site | `core-v*`: `buildguide-<version>.tar.gz` |
| [MkDocs plugin](mkdocs.md) | `<div data-buildguide="...">` in Markdown, data checked at build time | `mkdocs-v*`: wheel and sdist |
| [Docusaurus plugin](docusaurus.md) | `<BuildGuide view="..."/>` component, data checked at build time | `docusaurus-v*`: npm .tgz |

The [data format](data-format.md) is the same for every component. The [example pages](example/index.md) on this site embed the components with the MkDocs plugin from `packages/core/example/guide.json`; [All components](example/all.md) shows three on one page.

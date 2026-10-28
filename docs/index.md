# BuildGuide

Interactive build guide components from one data file: a BOM checklist, a list of text steps, and wiring and tubing boards with a tick per connection, to place in your own documentation pages. Plain JavaScript and CSS, no requests outside the site. Source and releases: [OpenReloading/BuildGuide](https://github.com/OpenReloading/BuildGuide).

## Getting started

| Your site | Use | Release |
|---|---|---|
| [Plain HTML](core.md) | browser components, JSON Schema and check CLI for any static site | `core-v*`: `buildguide-<version>.tar.gz` (earlier versions also on GitHub Packages) |
| [MkDocs](mkdocs.md) | `<div data-buildguide="...">` in Markdown, data checked at build time | `mkdocs-v*`: wheel and sdist |
| [Docusaurus](docusaurus.md) | `<BuildGuide view="..."/>` component, data checked at build time | `docusaurus-v*`: `.tgz` (earlier versions also on GitHub Packages) |

## Then

- [Examples](examples.md): one small guide per component and one for the tabbed combination, with the files for plain HTML, MkDocs and Docusaurus.
- [Data format](data-format.md): every key of the guide data, with the example.
- [Theming and dark mode](theming.md): colour tokens, the dark theme, print, browser support.
- [Reference](reference.md): the markup, hash, storage and script surface a site can rely on, the check CLI and the plugin options.
- [Example guide](example/index.md): the components on pages of this site, from `packages/core/example/guide.json`. [All components](example/all.md) shows three on one page, [Combined](example/guide.md) the BOM, the steps and both boards behind tabs.

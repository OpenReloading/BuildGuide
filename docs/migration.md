# Migration

## From the page shell to components only

The first release of each package (core 0.2.0, mkdocs 0.1.0, docusaurus 1.0.0) dropped the page shell: BuildGuide no longer draws a title, navigation, notices or a footer. Your page owns those, and a component draws only a BOM checklist or one board.

Removed:

- `#assembly-guide`, the `data-page` and `data-site` attributes
- the shell classes `ag-top`, `ag-nav`, `ag-main`, `ag-footer`, `ag-notice*`, `ag-intro*` and `ag-diagram-page`

Renamed or changed:

- `ag-page-heading` is now `ag-head`
- the hash was `#<step>/<no>` and is now `#<board key>=<step>/<no>`, one pair per board, so several boards share a page. Old links land on the first step of the board.

Not changed: the tick keys (`<prefix>-<no>:<a>:<b>`, `bom-<id>:<part>`) and the storage key. Ticks that people saved stay.

To move a site over:

1. Put the title, notices and text into your own pages (in MkDocs, normal Markdown with admonitions; in Docusaurus, MDX with `:::` blocks).
2. Replace the old page embed with `<div data-buildguide="bom"></div>` and `<div data-buildguide="board" data-board="wiring"></div>` (MkDocs, core), or `<BuildGuide view="bom"/>` and `<BuildGuide view="board" board="wiring"/>` (Docusaurus). Use each board once per page.
3. Delete styles and scripts that targeted the removed classes and attributes.
4. Run `buildguide-check` on the guide data; the plugins do it at build time.

The [changelogs](https://github.com/OpenReloading/BuildGuide/releases) list every release.

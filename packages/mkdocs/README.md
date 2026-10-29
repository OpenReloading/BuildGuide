# BuildGuide for MkDocs

<!-- --8<-- [start:about] -->
MkDocs plugin: put a BuildGuide component (a BOM checklist, text steps or a wiring or tubing board) anywhere in a Markdown page. The plugin checks the data at build time and bundles the core browser files. Your pages, notices and navigation stay your own.
<!-- --8<-- [end:about] -->

<!-- --8<-- [start:docs] -->
## Use

<!-- --8<-- [start:release] -->
1. Download the wheel from an `mkdocs-v*` [release](https://github.com/OpenReloading/BuildGuide/releases) and install it next to MkDocs 1.6:

   ```sh
   pip install mkdocs_buildguide-<version>-py3-none-any.whl
   ```
   <!-- --8<-- [end:release] -->

<!-- --8<-- [start:snippet] -->
2. Configure the plugin in `mkdocs.yml`. Paths are relative to `mkdocs.yml`:

   ```yaml
   plugins:
     - search
     - buildguide:
         data: guide.yaml
         assets: assets/
   ```
   <!-- --8<-- [end:snippet] -->

   | Option | Meaning | Default |
   |---|---|---|
   | `data` | guide data, YAML or JSON, in the core data format | required |
   | `guides` | more guides on the same site, `id: path` (letters, digits, `-` and `_`), each in the core data format | none |
   | `assets` | folder of BOM images, relative to the site root | `assets/` |

3. Place a component where it belongs in a page's Markdown, as many as you need, also several on one page. Write the title and notices as normal Markdown (for Material, admonitions):

   ```markdown
   # Wiring

   !!! warning "Safety"

       Work with the supply unplugged.

   <div data-buildguide="board" data-board="wiring"></div>
   ```

   | Component | Markup |
   |---|---|
   | BOM checklist | `<div data-buildguide="bom"></div>` |
   | Text steps | `<div data-buildguide="steps"></div>` |
   | A board | `<div data-buildguide="board" data-board="KEY"></div>`, `KEY` is a key in `boards` |
   | BOM, steps and all boards behind tabs | `<div data-buildguide="guide"></div>`; `data-board="wiring tubing"` picks tabs (`bom` is the BOM, `steps` the steps) |

   A component shows the guide of `data`. To show another guide, add `data-guide="ID"` with an id from `guides`: `<div data-buildguide="board" data-board="wiring" data-guide="second"></div>`. A page can use several guides.

   Attribute values may use double or single quotes; a board key may hold spaces. The view must be exactly `bom`, `steps`, `board` or `guide`. An empty element gets a no-JavaScript note after the search index is built. Elements in code blocks and inline code are text, not components.

The build fails on a schema error, on a problem the core check finds (`buildguide-check.mjs`), and on NaN or Infinity in the data of any guide, and when two guides have the same `storage` key: `localStorage` is per origin, so guides with the same key tick each other's connections. A component with an unknown view or board key, an unknown `data-guide`, or a `data-buildguide` without value, or a BOM component without `bom` data, or a `guide` with a key in `data-board` that does not exist, is a warning (an error with `--strict`).

Pages with a component also get the core, so Material's `navigation.instant` works. A page holds the data of the `data` guide only when it has a component of that guide. The other guides are written to `assets/buildguide/guides/<id>.json` (without whitespace); a component with `data-guide` gets `data-src` and `data-assets` for it, so a page with several components of one guide makes one request, and a page without one makes none. A `data-src` or `data-assets` written on the component stays as it is. The theme follows Material's colour scheme ([Theming](https://openreloading.github.io/BuildGuide/theming/)). The data and the core files reach the browser from the site only: set the theme's system fonts (Material: `theme.font: false`) to keep pages free of outside requests.

<!-- --8<-- [end:docs] -->

## Development

From the repository root, in the dev container: `npm run lint` (ruff), `npm test` (pytest), `npm run docs` (the docs site with this plugin) and `npm run test:browser` (the core browser tests, also against the built docs site). `uv build packages/mkdocs` builds the wheel and sdist into `packages/mkdocs/dist/`. The build copies `packages/core/src` and the schema into `src/mkdocs_buildguide/core/` (git-ignored); the editable install rebuilds when core changes.

## Licenses

MIT (`LICENSE`). The package bundles core with its vendored JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later), see `core/vendor/README.txt` in the package.

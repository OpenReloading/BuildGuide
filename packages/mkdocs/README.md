# BuildGuide for MkDocs

MkDocs plugin: put a BuildGuide component (a BOM checklist or a wiring or tubing board) anywhere in a Markdown page. The plugin checks the data at build time and bundles the core browser files. Your pages, notices and navigation stay your own.

## Use

1. Download the wheel from an `mkdocs-v*` [release](https://github.com/OpenReloading/BuildGuide/releases) and install it next to MkDocs 1.6:

   ```sh
   pip install mkdocs_buildguide-<version>-py3-none-any.whl
   ```

2. Configure the plugin in `mkdocs.yml`. Paths are relative to `mkdocs.yml`:

   ```yaml
   plugins:
     - search
     - buildguide:
         data: guide.yaml
         assets: assets/
   ```

   | Option | Meaning | Default |
   |---|---|---|
   | `data` | guide data, YAML or JSON, in the core data format | required |
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
   | A board | `<div data-buildguide="board" data-board="KEY"></div>`, `KEY` is a key in `boards` |

   Attribute values may use double or single quotes; a board key may hold spaces. The view must be exactly `bom` or `board`. An empty element gets a no-JavaScript note after the search index is built. Elements in code blocks and inline code are text, not components.

The build fails on a schema error, on a problem the core check finds (`buildguide-check.mjs`), and on NaN or Infinity in the data. A component with an unknown view or board key, or a `data-buildguide` without value, or a BOM component without `bom` data, is a warning (an error with `--strict`).

On pages with a component the plugin sets `data-assets` on the inline data, inlines the data once, and loads core from `assets/buildguide/` in the built site. Other pages get nothing. `buildguide-mkdocs.css` only keeps component tables out of Material's table wrapper: the Material header, tabs, sidebars and footer stay. Leave Material's `navigation.instant` off (not tested with components).

The data and the core files reach the browser from the site only. Use the theme's system fonts (Material: `theme.font: false`) to keep pages free of outside requests.

## Development

From the repository root, in the dev container: `npm run lint` (ruff), `npm test` (pytest), `npm run docs` (the docs site with this plugin) and `npm run test:browser` (the core browser tests, also against the built docs site). `uv build packages/mkdocs` builds the wheel and sdist into `packages/mkdocs/dist/`. The build copies `packages/core/src` and the schema into `src/mkdocs_buildguide/core/` (git-ignored); the editable install rebuilds when core changes.

## Licenses

MIT (`LICENSE`). The package bundles core with its vendored JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later), see `core/vendor/README.txt` in the package.

# BuildGuide for MkDocs

MkDocs plugin: each page with the front matter `buildguide: <page id>` shows that page of a BuildGuide guide. The plugin checks the data at build time and bundles the core browser files.

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
   | `assets` | folder of brand mark, BOM images and intro media, relative to the site root | `assets/` |

3. Write one Markdown page per guide page, with the page `id` in the front matter. The page body is shown above the guide:

   ```markdown
   ---
   buildguide: wiring
   ---
   ```

The build fails on a schema error, on a problem the core check finds (`buildguide-check.mjs`), on front matter that names no guide page, and on a guide page claimed by two Markdown pages. A guide page without a Markdown page is a warning (an error with `--strict`).

On each guide page the plugin writes `<div id="assembly-guide">` with `data-page`, `data-site` and `data-assets`, inlines the data with every page's `path` set from its MkDocs URL, and loads core from `assets/buildguide/` in the built site. With the Material theme, `buildguide-mkdocs.css` hides the site header, tabs, sidebars and footer on guide pages. Leave Material's `navigation.instant` off: guide pages need a full page load.

The data and the core files reach the browser from the site only. Use the theme's system fonts (Material: `theme.font: false`) to keep pages free of outside requests.

## Development

From the repository root, in the dev container: `npm run lint` (ruff), `npm test` (pytest), `npm run docs` (the docs site with this plugin) and `npm run test:browser` (the core browser tests, also against the built docs site). `uv build packages/mkdocs` builds the wheel and sdist into `packages/mkdocs/dist/`. The build copies `packages/core/src` and the schema into `src/mkdocs_buildguide/core/` (git-ignored); the editable install rebuilds when core changes.

## Licenses

MIT (`LICENSE`). The package bundles core with its vendored JointJS (MPL-2.0) and libavoid-js (LGPL-2.1-or-later), see `core/vendor/README.txt` in the package.

# Examples

One small, complete guide per component, and the files that show it on a plain HTML page, in MkDocs and in Docusaurus. Save the JSON as `guide.json`. The [example guide](example/index.md) uses every key of the [data format](data-format.md).

Plain HTML needs a web server (the script fetches `guide.json`), for example `python3 -m http.server`, and the core files unpacked into `assets/` ([Plain HTML](core.md)). Replace `<version>` with the core version.

## BOM checklist

Items with a group, a name, a specification and a quantity. The component adds search, a tick per item, the CSV export and a print button. Live with the full example data: [BOM](example/bom.md).

```json title="guide.json"
--8<-- "packages/core/example/minimal/bom.json"
```

=== "Plain HTML"

    ```html title="bom.html"
    <!doctype html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>BOM</title>
    <link rel="stylesheet" href="assets/buildguide-<version>/buildguide.css">
    </head>
    <body>
    <h1>BOM</h1>
    <div data-buildguide="bom" data-src="guide.json"><noscript>This guide needs JavaScript.</noscript></div>
    <script src="assets/buildguide-<version>/buildguide.js" defer></script>
    </body>
    </html>
    ```

=== "MkDocs"

    ```yaml title="mkdocs.yml"
    plugins:
      - search
      - buildguide:
          data: guide.json
    ```

    ```markdown title="docs/bom.md"
    # BOM

    <div data-buildguide="bom"></div>
    ```

=== "Docusaurus"

    ```js title="docusaurus.config.js"
    plugins: [['@openreloading/docusaurus-plugin-buildguide', { data: 'guide.json' }]],
    ```

    ```mdx title="docs/bom.mdx"
    # BOM

    import BuildGuide from '@theme/BuildGuide';

    <BuildGuide view="bom" />
    ```

## Wiring board

Parts with terminals on their sides, placed by `at` and `size`, and numbered connections from `PART:terminal` to `PART:terminal` in steps. The colour code names the wire; the routes are computed. Live with the full example data: [Wiring](example/wiring.md).

```json title="guide.json"
--8<-- "packages/core/example/minimal/wiring.json"
```

=== "Plain HTML"

    ```html title="wiring.html"
    <!doctype html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Wiring</title>
    <link rel="stylesheet" href="assets/buildguide-<version>/buildguide.css">
    </head>
    <body>
    <h1>Wiring</h1>
    <div data-buildguide="board" data-board="wiring" data-src="guide.json"><noscript>This guide needs JavaScript.</noscript></div>
    <script src="assets/buildguide-<version>/buildguide.js" defer></script>
    </body>
    </html>
    ```

=== "MkDocs"

    ```yaml title="mkdocs.yml"
    plugins:
      - search
      - buildguide:
          data: guide.json
    ```

    ```markdown title="docs/wiring.md"
    # Wiring

    <div data-buildguide="board" data-board="wiring"></div>
    ```

=== "Docusaurus"

    ```js title="docusaurus.config.js"
    plugins: [['@openreloading/docusaurus-plugin-buildguide', { data: 'guide.json' }]],
    ```

    ```mdx title="docs/wiring.mdx"
    # Wiring

    import BuildGuide from '@theme/BuildGuide';

    <BuildGuide view="board" board="wiring" />
    ```

## Tubing board

The same structure with one colour for the tube. `scope: "all"` shows every tube at first, `listAll` lists them all whichever step is selected. Live with the full example data: [Tubing](example/tubing.md).

```json title="guide.json"
--8<-- "packages/core/example/minimal/tubing.json"
```

=== "Plain HTML"

    ```html title="tubing.html"
    <!doctype html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Tubing</title>
    <link rel="stylesheet" href="assets/buildguide-<version>/buildguide.css">
    </head>
    <body>
    <h1>Tubing</h1>
    <div data-buildguide="board" data-board="tubing" data-src="guide.json"><noscript>This guide needs JavaScript.</noscript></div>
    <script src="assets/buildguide-<version>/buildguide.js" defer></script>
    </body>
    </html>
    ```

=== "MkDocs"

    ```yaml title="mkdocs.yml"
    plugins:
      - search
      - buildguide:
          data: guide.json
    ```

    ```markdown title="docs/tubing.md"
    # Tubing

    <div data-buildguide="board" data-board="tubing"></div>
    ```

=== "Docusaurus"

    ```js title="docusaurus.config.js"
    plugins: [['@openreloading/docusaurus-plugin-buildguide', { data: 'guide.json' }]],
    ```

    ```mdx title="docs/tubing.mdx"
    # Tubing

    import BuildGuide from '@theme/BuildGuide';

    <BuildGuide view="board" board="tubing" />
    ```

## BOM and boards behind tabs

One component with a tab for the BOM and one for each board, in the order of the data. Only the shown tab is mounted, so a board is drawn when you open its tab. `data-board="wiring tubing"` (Docusaurus: `board="wiring tubing"`) picks tabs and their order; `bom` names the BOM. The tab is kept in the hash (`#guide=wiring`) next to the boards' own positions. Live with the full example data: [Combined](example/guide.md).

```json title="guide.json"
--8<-- "packages/core/example/minimal/all.json"
```

=== "Plain HTML"

    ```html title="guide.html"
    <!doctype html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Guide</title>
    <link rel="stylesheet" href="assets/buildguide-<version>/buildguide.css">
    </head>
    <body>
    <h1>Guide</h1>
    <div data-buildguide="guide" data-src="guide.json"><noscript>This guide needs JavaScript.</noscript></div>
    <script src="assets/buildguide-<version>/buildguide.js" defer></script>
    </body>
    </html>
    ```

=== "MkDocs"

    ```yaml title="mkdocs.yml"
    plugins:
      - search
      - buildguide:
          data: guide.json
    ```

    ```markdown title="docs/guide.md"
    # Guide

    <div data-buildguide="guide"></div>
    ```

=== "Docusaurus"

    ```js title="docusaurus.config.js"
    plugins: [['@openreloading/docusaurus-plugin-buildguide', { data: 'guide.json' }]],
    ```

    ```mdx title="docs/guide.mdx"
    # Guide

    import BuildGuide from '@theme/BuildGuide';

    <BuildGuide view="guide" />
    ```

## Several components on one page

Place them one after the other, each board once per page. The [All components](example/all.md) page shows the BOM, wiring and tubing together; its guide data holds `bom` and both boards. A board is either standalone or in a tab, not both on one page.

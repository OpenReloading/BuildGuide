<section class="bg-intro">
<p class="bg-label">OpenReloading BuildGuide</p>
<h1>BuildGuide</h1>
<p class="bg-lead">A parts checklist plus wiring and tubing diagrams for your build documentation, from one data file. Readers tick off each part and connection as they build, and the ticks stay in their browser.</p>
<p class="bg-actions"><a class="md-button md-button--primary" href="example/">Open the live example</a> <a class="md-button" href="#getting-started">Read the docs</a></p>
<p>For people who document a hardware build on a MkDocs, Docusaurus or plain HTML site.</p>
<ul class="bg-facts">
<li>MIT license</li>
<li>Plain JavaScript and CSS</li>
<li>No requests outside the site</li>
</ul>
</section>
<section class="bg-components" aria-labelledby="components">
<h2 id="components">Components</h2>
<div class="bg-grid">
<div>
<h3><a href="example/bom/">BOM checklist</a></h3>
<p>The items with groups (each header shows how many of its items are ticked), a search box, an <code>All / Missing / Done</code> filter and the CSV export.</p>
</div>
<div>
<h3><a href="example/steps/">Text steps</a></h3>
<p>The steps in order with a tick each, the names of their parts, a progress bar and a <code>Print</code> button.</p>
</div>
<div>
<h3><a href="example/wiring/">Wiring board</a></h3>
<p>Parts with terminals on their sides and a tick per connection, from <code>PART:terminal</code> to <code>PART:terminal</code> with a colour code. Routes are computed, not drawn.</p>
</div>
<div>
<h3><a href="example/tubing/">Tubing board</a></h3>
<p>A board with a tick per connection, step by step, the same as the wiring board.</p>
</div>
</div>
</section>
<section class="bg-live" aria-label="Live example">
<div>
<div class="bg-card">
<h2 class="bg-card-title" id="wiring-board">Wiring board</h2>
<div data-buildguide="board" data-board="wiring" data-guide="home"></div>
</div>
<p class="bg-source">The <a href="examples/#wiring-board">wiring board example</a>, <code>packages/core/example/minimal/wiring.json</code></p>
</div>
<div>
<h2 id="progress">Progress stays in the browser</h2>
<p>Ticks are saved in <code>localStorage</code> under the <code>storage</code> key of the guide. A tick belongs to one exact connection (number and both ends): changing an end clears it. Export downloads <code>&lt;storage&gt;.json</code>, Import replaces the saved progress from such a file and Reset removes it. Import and reset act at once: the status line of the component says what happened and offers <code>Undo</code>.</p>
</div>
</section>

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

<section class="bg-data" markdown>

## One JSON or YAML object

--8<-- "docs/data-format.md:intro"

```json
--8<-- "packages/core/example/guide.json:1:9"
```

[Data format reference](data-format.md)

</section>

<section class="bg-install" markdown>

## Install for your site

=== "Plain HTML"

    --8<-- "packages/core/README.md:about"

    --8<-- "packages/core/README.md:release"

    --8<-- "packages/core/README.md:snippet"

=== "MkDocs"

    --8<-- "packages/mkdocs/README.md:about"

    --8<-- "packages/mkdocs/README.md:release"

    --8<-- "packages/mkdocs/README.md:snippet"

=== "Docusaurus"

    --8<-- "packages/docusaurus/README.md:about"

    --8<-- "packages/docusaurus/README.md:release"

    --8<-- "packages/docusaurus/README.md:snippet"

</section>

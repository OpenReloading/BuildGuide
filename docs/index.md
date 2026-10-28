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

# BuildGuide

Monorepo of BuildGuide components, the BOM and board views for a host's own pages (core in `packages/core/`, MkDocs plugin in `packages/mkdocs/`, Docusaurus plugin in `packages/docusaurus/`), each released on its own. Docs site: `mkdocs.yml` and `docs/`, deployed to GitHub Pages by `.github/workflows/pages.yml`. License MIT (`LICENSE`).

## Branches

Pull requests target `develop` (default branch) and are squash-merged with the Conventional Commit title. `main` only gets `develop` through a promotion pull request titled `chore: promote develop to main`, merged with a merge commit; release-please, release, publish and Scorecard run on `main`; Pages runs on both branches and publishes `develop` as a preview (Commands).

CI (`ci.yml`) runs on pull requests and on pushes to `develop`, not on `main`. The promotion pull request skips its jobs (the push to develop already ran them on the same commit), so `main` requires only checks that also run on that push.

## Commands

- Agents run on the host; file edits and Git stay there. Start the container with `devcontainer up --docker-path podman --workspace-folder .` (runs `npm ci` and `uv sync`); run project commands with the prefix `devcontainer exec --docker-path podman --workspace-folder .`.
- Lint (Biome, ruff, no em dash or emoji): `npm run lint`
- Unit tests (node, pytest): `npm test`. Both print a coverage summary and fail below a floor: core in the `test` script of `packages/core/package.json` (`--test-coverage-*`), MkDocs in `[tool.coverage.report]` of `packages/mkdocs/pyproject.toml`. Raise a floor when coverage rises, keep it a little below the measured value. Not measured: the browser code (`buildguide.js`, `buildguide-board.js`, covered by the browser tests), the bundled third-party code in `packages/core/src` and the Docusaurus package.
- Browser tests (core example pages, the built docs site, the Docusaurus example build; each hosts /example/{bom,wiring,tubing,all}/): `npm run test:browser`
- Docusaurus example site: `npm run build -w packages/docusaurus` (`packages/docusaurus/example/build/`), dev server `npm run start -w packages/docusaurus` (port 8080)
- Dependency audit (CI): `node scripts/audit.mjs`. An advisory without a fix goes into its `ALLOWED` list and into `allow-ghsas` in `ci.yml`, with the user's approval.
- Docs site into `site/`: `npm run docs`. Serve: `uv run --project packages/mkdocs mkdocs serve -a 0.0.0.0:8080`
- Pages (`pages.yml`): one deployment holds `main` at the root (https://openreloading.github.io/BuildGuide/) and `develop` as a preview under `/develop/`; it runs on pushes to both and on manual dispatch. Each ref is built from its own checkout with `mkdocs build --strict`; the preview build sets `BUILDGUIDE_PREVIEW=true` (`noindex` meta tag and banner from `overrides/main.html`) and `SITE_URL=<root>/develop/`. The preview keeps its own `sitemap.xml` because Material's instant navigation needs it; the root sitemap never lists it. A failing preview build only drops `/develop/` with a warning, a failing `main` build fails the run. Test a combined output with `BUILDGUIDE_SITE=<folder> BUILDGUIDE_PREFIX=/develop npm run test:browser -w packages/core`.
- Release archives (core tarball, MkDocs wheel and sdist): `npm run dist`
- Serve the core example: `npm run serve -w packages/core` (http://127.0.0.1:8080/example/)
- Workflow changes: `podman run --rm -v "$PWD:/repo:Z" -w /repo docker.io/rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667` and `podman run --rm -v "$PWD:/repo:Z" -w /repo ghcr.io/zizmorcore/zizmor:1.31.1 --offline .github/workflows` (CI runs both).

## Conventions

- `packages/core/src/` is plain browser JavaScript and CSS: no framework, no build step, no coupling to a site generator, no Node imports (Biome enforces it). Third-party code only in `src/vendor/`, unmodified, with its license and an entry in `src/vendor/README.txt`.
- No requests outside the site. The browser tests fail on external requests, page errors and missing files.
- A data format change updates `packages/core/schema/buildguide.schema.json`, `src/buildguide-check.mjs`, `example/guide.json` and the tests together.
- `packages/mkdocs/` is Python, managed with uv (`uv.lock` committed). Its build copies `packages/core/src` and the schema into `src/mkdocs_buildguide/core/` (git-ignored). `check.py` is a port of `buildguide-check.mjs`: a check change updates both, with a case in `packages/core/tests/fixtures/` (both test suites run them).
- `packages/docusaurus/` copies `packages/core/src` into `core/` (git-ignored) before its tests, builds and `npm pack` (`scripts/copy-core.mjs`); it has no npm dependency on core until #7.
- Stable for sites that style or test against it: the `ag-*` component classes (the root is `.ag-guide`), the attributes `data-buildguide`, `data-board`, `data-guide` (MkDocs plugin markup), `data-src`, `data-assets`, `data-step`, `data-wire`, `data-conn`, `data-connection`, `data-role` and the `data-action` values, `data-complete` (set on the root while everything is ticked), `data-level` (on `.ag-step-note`: `note`, `caution`, `warning` or empty for a plain note, with the level word as its first `<strong>`), the tokens `--ag-caution-bg`, `--ag-caution-line`, `--ag-warning-bg`, `--ag-warning-line`, the `✓ ` prefix of a ticked connection's number in the drawing and the `; checked` end of its accessible name, `data-ag-scheme` (values `light`, `dark`, `auto`), `--ag-font`, `--ag-text-small` (the smallest text, 11px by default), `--ag-board-filter`, `--ag-board-ratio` (set by the component), `--ag-done-opacity`, `--ag-done-decoration`, the hash pairs `#<board key>=<step>/<no>`, the tick keys `<prefix>-<no>:<a>:<b>` and `bom-<id>:<part>`, and the single `storage` key. A change to a tick key or the storage key drops saved ticks. The components-only release removed `#assembly-guide`, `data-page`, `data-site`, the shell classes (`ag-top`, `ag-nav`, `ag-main`, `ag-footer`, `ag-notice*`, `ag-intro*`, `ag-diagram-page`), renamed `ag-page-heading` to `ag-head`, and changed the hash from `#<step>/<no>` to `#<board key>=<step>/<no>`. Tick keys and the storage key did not change.
- Browser test expectations come from `example/guide.json`, not from literals.
- Versions and changelogs come from release-please (`release-please-config.json`): never edit a component's `version` or `CHANGELOG.md` by hand. PR titles are Conventional Commits with the component as scope (CONTRIBUTING.md).
- Actions pinned by commit SHA with the version as comment, images by digest.

## Agent skills

### Issue tracker

Issues live in GitHub Issues of `OpenReloading/BuildGuide` (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

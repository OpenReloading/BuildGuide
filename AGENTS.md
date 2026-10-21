# BuildGuide

Monorepo of BuildGuide components (core in `packages/core/`, MkDocs plugin in `packages/mkdocs/`), each released on its own. Docs site: `mkdocs.yml` and `docs/`, deployed to GitHub Pages by `.github/workflows/pages.yml`. License MIT (`LICENSE`).

## Commands

- Agents run on the host; file edits and Git stay there. Start the container with `devcontainer up --docker-path podman --workspace-folder .` (runs `npm ci` and `uv sync`); run project commands with the prefix `devcontainer exec --docker-path podman --workspace-folder .`.
- Lint (Biome, ruff, no em dash or emoji): `npm run lint`
- Unit tests (node, pytest): `npm test`
- Browser tests (core example, then the built docs site): `npm run test:browser`
- Docs site into `site/`: `npm run docs`. Serve: `uv run --project packages/mkdocs mkdocs serve -a 0.0.0.0:8080`
- Release archives (core tarball, MkDocs wheel and sdist): `npm run dist`
- Serve the core example: `npm run serve -w packages/core` (http://127.0.0.1:8080/example/)
- Workflow changes: `podman run --rm -v "$PWD:/repo:Z" -w /repo docker.io/rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667` and `podman run --rm -v "$PWD:/repo:Z" -w /repo ghcr.io/zizmorcore/zizmor:1.31.1 --offline .github/workflows` (CI runs both).

## Conventions

- `packages/core/src/` is plain browser JavaScript and CSS: no framework, no build step, no coupling to a site generator, no Node imports (Biome enforces it). Third-party code only in `src/vendor/`, unmodified, with its license and an entry in `src/vendor/README.txt`.
- No requests outside the site. The browser tests fail on external requests, page errors and missing files.
- A data format change updates `packages/core/schema/buildguide.schema.json`, `src/buildguide-check.mjs`, `example/guide.json` and the tests together.
- `packages/mkdocs/` is Python, managed with uv (`uv.lock` committed). Its build copies `packages/core/src` and the schema into `src/mkdocs_buildguide/core/` (git-ignored). `check.py` is a port of `buildguide-check.mjs`: a check change updates both, with a case in `packages/core/tests/fixtures/` (both test suites run them).
- Stable for sites that style or test against it: `#assembly-guide`, `ag-*` classes, `data-step`, `data-wire`, `data-connection`, `data-action` values. Tick keys `<prefix>-<no>:<a>:<b>` and `bom-<id>:<part>` stay as they are, a change drops saved ticks.
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

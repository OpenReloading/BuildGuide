# BuildGuide

Browser library for build guides (intro, BOM, wiring and tubing boards) from one JSON file. License MIT (`LICENSE`).

## Commands

- Agents run on the host; file edits and Git stay there. Start the container with `devcontainer up --docker-path podman --workspace-folder .` (runs `npm ci`); run project commands with the prefix `devcontainer exec --docker-path podman --workspace-folder .`.
- Unit tests (checker, schema): `npm test`
- Browser tests of the example: `npx playwright test`
- Serve the example: `npm run serve` (http://127.0.0.1:8080/example/)
- Release archive: `npm run dist`
- Workflow changes: `actionlint` (`podman run --rm -v "$PWD:/repo:Z" -w /repo docker.io/rhysd/actionlint:1.7.12@sha256:9d36088643581e728c969f35141f88139fec77280b2be23c1f66f8e40e1025e7`).

## Conventions

- `src/` is plain browser JavaScript and CSS: no framework, no build step, no coupling to a site generator. Third-party code only in `src/vendor/`, unmodified, with its license and an entry in `src/vendor/README.txt`.
- No requests outside the site. The browser tests fail on external requests, page errors and missing files.
- A data format change updates `schema/buildguide.schema.json`, `src/buildguide-check.mjs`, `example/guide.json` and the tests together.
- Stable for sites that style or test against it: `#assembly-guide`, `ag-*` classes, `data-step`, `data-wire`, `data-connection`, `data-action` values. Tick keys `<prefix>-<no>:<a>:<b>` and `bom-<id>:<part>` stay as they are, a change drops saved ticks.
- Browser test expectations come from `example/guide.json`, not from literals.
- Actions pinned by commit SHA with the version as comment.

## Agent skills

### Issue tracker

Issues live in GitHub Issues of `OpenReloading/BuildGuide` (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

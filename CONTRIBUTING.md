# Contributing

1. Branch `<type>/<issue>-<slug>` from `main`.
2. Before the pull request, in the dev container (`.devcontainer/`, Playwright image with uv):

   ```sh
   devcontainer up --docker-path podman --workspace-folder .
   devcontainer exec --docker-path podman --workspace-folder . npm run lint           # Biome, ruff, no em dash or emoji
   devcontainer exec --docker-path podman --workspace-folder . npm test               # unit tests of every component, with coverage floors (core: packages/core/package.json, MkDocs: packages/mkdocs/pyproject.toml)
   devcontainer exec --docker-path podman --workspace-folder . npm run test:browser   # browser tests: core example, docs site, Docusaurus example
   devcontainer exec --docker-path podman --workspace-folder . npm run docs           # docs site into site/
   devcontainer exec --docker-path podman --workspace-folder . npm run dist           # release archives
   ```

   Run at least `npm run lint`, `npm test` and `npm run test:browser`. Audit exceptions (advisories without a fix) are in `scripts/audit.mjs`.
3. Pull request title in [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) form, with the component as scope: `feat(core): ...`, `fix(mkdocs): ...`, `feat(docusaurus): ...`. Pull requests target `main` and are squash-merged with that title, and release-please builds each component's version and changelog from it. `feat` raises the minor version, `fix` the patch version, `!` after the type marks a breaking change.
4. `Closes #<issue>` in the description.

## Branches

- `main` is the only long-lived branch and the default branch: pull requests target it and are squash-merged, so history stays linear.
- release-please opens and updates one release pull request on every push to `main`.
- Pull requests are squash-merged. A merge queue can be enabled only after every required check reports on `merge_group`; the SonarCloud check does not, so it comes off the required list first.

## Releases and Pages

Every merge to `main` deploys the `next` edition. A release happens when the release pull request is merged: every Monday 05:00 UTC `release-weekly.yml` merges it (auto-merge, squash) once its checks pass. The owner can run that workflow by hand (Actions, Run workflow) for another day, merge the pull request earlier, or put the label `hold` on it to skip a week.

- **Release pull request:** `release.yml` runs release-please on every push to `main` with the org's release GitHub App token, so its pull request starts the required checks without anyone approving the runs. `release-weekly.yml` enables auto-merge on it on Mondays.
- **Release:** merging the release pull request tags each changed component (`<component>-vX.Y.Z`) and creates its GitHub Release. The archives, wheel, sdist and packages are built and published from those tags by `release.yml`, never from a push to `main`. `npm run dist` in `ci.yml` builds without publishing.
- **Pages:** `pages.yml` builds one site and deploys it in one deployment, on a push to `main`, when a release is published and on manual dispatch. The root of https://openreloading.github.io/BuildGuide/ is the latest release of the repository, built from its tag. `/next/` is `main`. Without a release, or with a latest release from before `docs/hooks/edition.py`, the root redirects to `/next/`.
- **Browser storage:** both editions are on one origin and share `localStorage`. The build of `/next/` runs with `BUILDGUIDE_EDITION=next`, which `docs/hooks/edition.py` turns into the suffix `-next` on every guide's `storage` key. The root keeps the keys of the guide data, so saved ticks stay. The docs site has no service worker and no other browser data. A service worker for `/next/` would need the scope `/next/` and a cache name with the same suffix.

Optional: a pre-push hook runs `npm run lint` in the dev container (start it first) before each push. Enable it with `git config core.hooksPath .githooks`. CI stays the gate.

A data format change updates the schema, the check, the example and the tests in one pull request.

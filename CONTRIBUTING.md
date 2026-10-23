# Contributing

1. Branch `<type>/<issue>-<slug>` from `main`.
2. Before the pull request, in the dev container (`.devcontainer/`, Playwright image with uv):

   ```sh
   devcontainer up --docker-path podman --workspace-folder .
   devcontainer exec --docker-path podman --workspace-folder . npm run lint           # Biome, ruff, no em dash or emoji
   devcontainer exec --docker-path podman --workspace-folder . npm test               # unit tests of every component
   devcontainer exec --docker-path podman --workspace-folder . npm run test:browser   # browser tests: core example, docs site, Docusaurus example
   devcontainer exec --docker-path podman --workspace-folder . npm run docs           # docs site into site/
   devcontainer exec --docker-path podman --workspace-folder . npm run dist           # release archives
   ```

   Run at least `npm run lint`, `npm test` and `npm run test:browser`. Audit exceptions (advisories without a fix) are in `scripts/audit.mjs`.
3. Pull request title in [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) form, with the component as scope: `feat(core): ...`, `fix(mkdocs): ...`, `feat(docusaurus): ...`. Pull requests are squash-merged with that title, and release-please builds each component's version and changelog from it. `feat` raises the minor version, `fix` the patch version, `!` after the type marks a breaking change.
4. `Closes #<issue>` in the description.

Optional: a pre-push hook runs `npm run lint` in the dev container (start it first) before each push. Enable it with `git config core.hooksPath .githooks`. CI stays the gate.

A data format change updates the schema, the check, the example and the tests in one pull request.

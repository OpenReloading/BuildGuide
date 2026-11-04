"""Copies core (packages/core/lib, built by npm run build -w packages/core, and the schema) into the package. An sdist already carries the copy."""

import shutil
from pathlib import Path

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class CoreHook(BuildHookInterface):
    def initialize(self, version, build_data):
        core, target = Path(self.root).parent / "core", Path(self.root, "src/mkdocs_buildguide/core")
        if not core.is_dir():
            if not target.is_dir():
                raise FileNotFoundError(f"neither {core} nor the copy in {target}")
            return
        if not (core / "lib").is_dir():
            # uv sync before npm: the editable install is rebuilt once lib/ exists (cache-keys in pyproject.toml)
            if version == "editable":
                return
            raise FileNotFoundError(f"{core / 'lib'} is missing: build core first (npm run build -w packages/core)")
        shutil.rmtree(target, ignore_errors=True)
        shutil.copytree(core / "lib", target, ignore=shutil.ignore_patterns("*.d.ts", "*.d.mts", "*.map"))
        shutil.copy(core / "schema/buildguide.schema.json", target)

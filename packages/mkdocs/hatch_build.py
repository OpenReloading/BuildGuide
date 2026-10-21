"""Copies core (packages/core/src and the schema) into the package. An sdist already carries the copy."""

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
        shutil.rmtree(target, ignore_errors=True)
        shutil.copytree(core / "src", target)
        shutil.copy(core / "schema/buildguide.schema.json", target)

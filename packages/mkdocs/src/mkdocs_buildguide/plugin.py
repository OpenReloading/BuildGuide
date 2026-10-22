"""MkDocs plugin: `<div data-buildguide="bom"></div>` and `<div data-buildguide="board" data-board="KEY"></div>` in a page become guide components."""

import html
import json
import math
import re
import shutil
from pathlib import Path

import yaml
from mkdocs.config import config_options as c
from mkdocs.exceptions import PluginError
from mkdocs.plugins import BasePlugin, get_plugin_logger
from mkdocs.utils import get_relative_url

from .check import problems

HERE = Path(__file__).parent
log = get_plugin_logger(__name__)
# a div's opening tag; quoted attribute values may hold a >
TAG = re.compile(r"""<div\b(?:[^>"']|"[^"]*"|'[^']*')*>""")


def attribute(tag, name):
    """The value of an attribute as the browser reads it ('' when bare or empty), None when the tag has none."""
    match = re.search(rf"""(?<![\w-]){name}(?![\w-])(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?""", tag)
    if match is None:
        return None
    return html.unescape(next((g for g in match.groups() if g is not None), ""))


def finite(value):
    """False when a float anywhere in the data is NaN or infinite: json.dumps would write it as non-standard JSON."""
    if isinstance(value, float):
        return math.isfinite(value)
    if isinstance(value, dict):
        return all(finite(item) for item in value.values())
    if isinstance(value, list):
        return all(finite(item) for item in value)
    return True


class BuildGuidePlugin(BasePlugin):
    # a typed Config cannot have an option named data (it is the UserDict's own attribute)
    config_scheme = (("data", c.File(exists=True, required=True)), ("assets", c.Type(str, default="assets/")))

    def on_config(self, config):
        data = self.config["data"]
        text = Path(data).read_text(encoding="utf-8")
        try:
            self.guide = json.loads(text)  # YAML does not read JSON that is indented with tabs
        except ValueError:
            try:
                self.guide = yaml.safe_load(text)
            except yaml.YAMLError as error:
                raise PluginError(f"{data}: not valid JSON or YAML: {error}") from error
        if not isinstance(self.guide, dict):
            raise PluginError(f"{data}: not a guide object")
        if not finite(self.guide):
            raise PluginError(f"{data}: NaN or Infinity is not valid in a guide")
        if found := problems(self.guide):
            raise PluginError(f"{data}:\n" + "\n".join(found))
        config.watch.append(data)

    def on_pre_build(self, config):
        self.pages = set()

    # components are found in the rendered page; an unknown view or board key is a warning, an error with --strict
    def on_page_content(self, output, page, config, files):
        for tag in TAG.findall(output):
            view = attribute(tag, "data-buildguide")
            if view is None:
                continue
            key = attribute(tag, "data-board")
            if view == "":
                log.warning(f"{page.file.src_uri}: data-buildguide has no value")
            elif not (
                (view == "bom" and "bom" in self.guide) or (view == "board" and key in (self.guide.get("boards") or {}))
            ):
                log.warning(f"{page.file.src_uri}: no guide component {view}{' ' + key if key else ''}")
            self.pages.add(page.file.src_uri)
        return output

    # the note for visitors without JavaScript goes in here, after the search index took the content
    def add_note(self, output):
        def note(match):
            tag = match.group(0)
            empty = match.string.startswith("</div>", match.end())
            return tag + ("<noscript>This guide needs JavaScript.</noscript>" if empty and attribute(tag, "data-buildguide") is not None else "")

        return TAG.sub(note, output)

    # the data goes in after the content, so the search index leaves it out; only pages with a component get it
    def on_post_page(self, output, page, config):
        if page.file.src_uri not in self.pages:
            return output
        core = get_relative_url("assets/buildguide/", page.url).rstrip("/") + "/"
        assets = get_relative_url(self.config["assets"], page.url).rstrip("/") + "/"
        styles = f'<link rel="stylesheet" href="{core}buildguide.css"><link rel="stylesheet" href="{core}buildguide-mkdocs.css">'
        data = json.dumps(self.guide).replace("<", "\\u003c")
        scripts = (
            f'<script type="application/json" id="guide-data" data-assets="{html.escape(assets)}">{data}</script>'
            f'<script src="{core}buildguide.js" defer></script>'
        )
        output = self.add_note(output).replace("</head>", styles + "</head>", 1)
        at = output.rfind("</body>")
        return output[:at] + scripts + output[at:]

    def on_post_build(self, config):
        target = Path(config.site_dir, "assets/buildguide")
        shutil.copytree(HERE / "core", target, dirs_exist_ok=True)
        shutil.copy(HERE / "buildguide-mkdocs.css", target)

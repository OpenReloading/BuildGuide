"""MkDocs plugin: a page with the front matter `buildguide: <page id>` shows that page of the guide."""

import html
import json
import math
import shutil
from pathlib import Path

import yaml
from mkdocs.config import config_options as c
from mkdocs.exceptions import PluginError
from mkdocs.plugins import BasePlugin, get_plugin_logger
from mkdocs.utils import get_relative_url
from mkdocs.utils.meta import get_data

from .check import problems

HERE = Path(__file__).parent
log = get_plugin_logger(__name__)


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

    # every guide page's URL is known before the first page renders: read the front matter of all pages here
    def on_files(self, files, config):
        ids, urls = [p["id"] for p in self.guide["pages"]], {}
        for file in files.documentation_pages():
            page_id = get_data(file.content_string)[1].get("buildguide")
            if page_id is None:
                continue
            if page_id not in ids:
                raise PluginError(f"{file.src_uri}: no guide page {page_id}")
            if page_id in urls:
                raise PluginError(f"{file.src_uri}: guide page {page_id} is already on {urls[page_id].src_uri}")
            urls[page_id] = file
        for p in self.guide["pages"]:
            if p["id"] in urls:
                p["path"] = urls[p["id"]].url
            else:
                log.warning(f"guide page {p['id']} has no MkDocs page with the front matter 'buildguide: {p['id']}'")

    def on_page_content(self, output, page, config, files):
        page_id = page.meta.get("buildguide")
        if page_id is None:
            return output
        site = get_relative_url(".", page.url).rstrip("/") + "/"
        return (
            f'{output}<div id="assembly-guide" data-page="{html.escape(str(page_id))}" data-site="{site}" '
            f'data-assets="{html.escape(self.config["assets"])}"><noscript>This guide needs JavaScript.</noscript></div>'
        )

    # the data goes in after the content, so the search index leaves it out
    def on_post_page(self, output, page, config):
        if page.meta.get("buildguide") is None:
            return output
        core = get_relative_url("assets/buildguide/", page.url).rstrip("/") + "/"
        styles = f'<link rel="stylesheet" href="{core}buildguide.css"><link rel="stylesheet" href="{core}buildguide-mkdocs.css">'
        data = json.dumps(self.guide).replace("<", "\\u003c")
        scripts = f'<script type="application/json" id="guide-data">{data}</script><script src="{core}buildguide.js" defer></script>'
        output = output.replace("</head>", styles + "</head>", 1)
        at = output.rfind("</body>")
        return output[:at] + scripts + output[at:]

    def on_post_build(self, config):
        target = Path(config.site_dir, "assets/buildguide")
        shutil.copytree(HERE / "core", target, dirs_exist_ok=True)
        shutil.copy(HERE / "buildguide-mkdocs.css", target)

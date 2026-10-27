"""MkDocs plugin: `<div data-buildguide="bom"></div>`, `<div data-buildguide="steps"></div>`, `<div data-buildguide="board" data-board="KEY"></div>` and `<div data-buildguide="guide"></div>` in a page become guide components."""

import html
import json
import math
import re
import shutil
from html.parser import HTMLParser
from pathlib import Path

import yaml
from mkdocs.config import config_options as c
from mkdocs.exceptions import PluginError
from mkdocs.plugins import BasePlugin, get_plugin_logger
from mkdocs.utils import get_relative_url, normalize_url

from .check import problems

HERE = Path(__file__).parent
log = get_plugin_logger(__name__)
CLOSED = re.compile(r"\s*</div>")  # nothing but whitespace before the closing tag
GUIDE_ID = re.compile(r"[A-Za-z0-9_-]+")  # the id is a file name and a URL segment
GUIDES = "assets/buildguide/guides/"  # next to the core files, in a folder of its own


class Divs(HTMLParser):
    """The opening tags of the divs in a page as the browser reads them: (start, end, attributes). Comments and scripts are skipped."""

    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.lines = [0] + [m.end() for m in re.finditer("\n", text)]
        self.found = []
        self.feed(text)
        self.close()

    def handle_starttag(self, tag, attrs):
        if tag == "div":
            line, column = self.getpos()
            start = self.lines[line - 1] + column
            values = {}
            for name, value in attrs:  # the first of a repeated attribute wins, a bare one is ''
                values.setdefault(name, "" if value is None else value)
            self.found.append((start, start + len(self.get_starttag_text()), values))


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
    config_scheme = (
        ("data", c.File(exists=True, required=True)),
        ("guides", c.DictOfItems(c.File(exists=True), default={})),
        ("assets", c.Type(str, default="assets/")),
    )

    def load(self, data):
        text = Path(data).read_text(encoding="utf-8")
        try:
            guide = json.loads(text)  # YAML does not read JSON that is indented with tabs
        except ValueError:
            try:
                guide = yaml.safe_load(text)
            except yaml.YAMLError as error:
                raise PluginError(f"{data}: not valid JSON or YAML: {error}") from error
        if not isinstance(guide, dict):
            raise PluginError(f"{data}: not a guide object")
        if not finite(guide):
            raise PluginError(f"{data}: NaN or Infinity is not valid in a guide")
        if found := problems(guide):
            raise PluginError(f"{data}:\n" + "\n".join(found))
        return guide

    def on_config(self, config):
        self.guide = self.load(self.config["data"])
        self.guides = {}
        for name, path in self.config["guides"].items():
            if not GUIDE_ID.fullmatch(name):
                raise PluginError(f"guides: the id {name!r} may only hold letters, digits, - and _")
            self.guides[name] = self.load(path)
        # localStorage is per origin: guides with the same key tick each other's connections
        owners = {}
        for name, guide in {"data": self.guide, **{f"guides.{n}": g for n, g in self.guides.items()}}.items():
            if (other := owners.setdefault(guide["storage"], name)) != name:
                raise PluginError(f"{other} and {name} have the same storage key {guide['storage']!r}: each guide on a site needs its own")
        config.watch.extend([self.config["data"], *self.config["guides"].values()])

    def on_pre_build(self, config):
        self.pages = {}  # src_uri of a page with a component: the data-guide values it uses, None for the guide of `data`

    def known(self, guide, view, key):
        boards = guide.get("boards") or {}
        if view == "guide":  # data-board is a space separated list of 'bom', 'steps' and board keys, empty for all of them
            keys = (key or "").split() or [*(k for k in ("bom", "steps") if k in guide), *boards]
            return bool(keys) and all(k in guide if k == "bom" else k in boards or (k == "steps" and "steps" in guide) for k in keys)
        return view in guide if view in ("bom", "steps") else (view == "board" and key in boards)

    def assets(self, page):
        return get_relative_url(self.config["assets"], page.url).rstrip("/") + "/"

    # components are found in the rendered page; an unknown view, guide or board key is a warning, an error with --strict
    # a component of a named guide gets that guide's file as its data-src: the page holds no data of it, the core fetches the file
    def on_page_content(self, output, page, config, files):
        inserts = []
        for start, _, attributes in Divs(output).found:
            view = attributes.get("data-buildguide")
            if view is None:
                continue
            key, name = attributes.get("data-board"), attributes.get("data-guide")
            guide = self.guide if name is None else self.guides.get(name)
            if view == "":
                log.warning(f"{page.file.src_uri}: data-buildguide has no value")
            elif guide is None:
                log.warning(f"{page.file.src_uri}: no guide {name!r}")
            elif not self.known(guide, view, key):
                log.warning(f"{page.file.src_uri}: no guide component {view}{' ' + key if key else ''}")
            self.pages.setdefault(page.file.src_uri, set()).add(name)
            if guide is not None and name is not None and "data-src" not in attributes:
                src = html.escape(get_relative_url(f"{GUIDES}{name}.json", page.url))
                assets = "" if "data-assets" in attributes else f' data-assets="{html.escape(self.assets(page))}"'
                inserts.append((start + len("<div"), f' data-src="{src}"{assets}'))
        for at, text in reversed(inserts):
            output = output[:at] + text + output[at:]
        return output

    # the note for visitors without JavaScript goes in here, after the search index took the content
    def add_note(self, output):
        for _, end, attributes in reversed(Divs(output).found):
            if "data-buildguide" in attributes and CLOSED.match(output, end):
                output = output[:end] + "<noscript>This guide needs JavaScript.</noscript>" + output[end:]
        return output

    # the data goes in after the content, so the search index leaves it out; only pages with a component get it
    def on_post_page(self, output, page, config):
        if page.file.src_uri not in self.pages:
            return output
        core = get_relative_url("assets/buildguide/", page.url).rstrip("/") + "/"
        styles = f'<link rel="stylesheet" href="{core}buildguide.css"><link rel="stylesheet" href="{core}buildguide-mkdocs.css">'
        # a hidden element, not <script type="application/json">: Material's instant navigation runs the page's scripts again and drops the type
        data = html.escape(json.dumps(self.guide), quote=False)
        # only a page with a component of the guide of `data` holds it
        inline = f'<div id="guide-data" data-assets="{html.escape(self.assets(page))}" hidden>{data}</div>' if None in self.pages[page.file.src_uri] else ""
        scripts = inline + f'<script src="{core}buildguide.js" defer></script>'
        output = self.add_note(output)
        # before the site's extra_css links, so a plain `.ag-guide{...}` rule of the site wins at equal specificity; without any, at the end of the head
        # a custom theme may write the tag and attribute in upper case, with spaces around the = and with either quote or none; the URL is case-sensitive
        hrefs = (re.escape(html.escape(normalize_url(path, page))) for path in config.extra_css)
        links = (re.search(rf"(?i:<link\b[^>]*\shref\s*=\s*)(?:\"{h}\"|'{h}'|{h}(?=[\s>]))", output) for h in hrefs)
        at = min((m.start() for m in links if m), default=None)
        output = output[:at] + styles + output[at:] if at is not None else output.replace("</head>", styles + "</head>", 1)
        # inside the page's article with Material: Material's instant navigation swaps the article and runs its scripts, but drops the rest of the body
        at = output.rfind("</article>") if config.theme.name == "material" else -1
        if at < 0:
            at = output.rfind("</body>")
        return output[:at] + scripts + output[at:]

    def on_post_build(self, config):
        target = Path(config.site_dir, "assets/buildguide")
        shutil.copytree(HERE / "core", target, dirs_exist_ok=True)
        shutil.copy(HERE / "buildguide-mkdocs.css", target)
        Path(config.site_dir, GUIDES).mkdir(parents=True, exist_ok=True)
        for name, guide in self.guides.items():
            Path(config.site_dir, GUIDES, f"{name}.json").write_text(json.dumps(guide, separators=(",", ":")), encoding="utf-8")

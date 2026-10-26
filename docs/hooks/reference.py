"""MkDocs hook: replaces <!-- generated: schema NAME -->, <!-- generated: tokens -->, <!-- generated: files --> and <!-- generated: precache --> in the docs with
tables walked from the data schema, from the --ag-* declarations of the stylesheet and from the shipped files of core, so the docs
follow the files they describe."""

import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).parents[2]
SCHEMA = ROOT / "packages/core/schema/buildguide.schema.json"
SRC = ROOT / "packages/core/src"
CSS = SRC / "buildguide.css"
MARKER = re.compile(r"<!-- generated: (schema|tokens|files|precache)(?: (\S+))? -->")
TOKEN = re.compile(r"--ag-([\w-]+):light-dark\((#[0-9a-fA-F]+), (#[0-9a-fA-F]+)\)")
DECLARED = re.compile(r"--ag-[\w-]+:\s*light-dark\(")


def resolve(schema, node):
    """The node with its $ref filled in; keys next to the $ref win."""
    if "$ref" not in node:
        return node
    name = node["$ref"].removeprefix("#/$defs/")
    return {**schema["$defs"][name], **{key: value for key, value in node.items() if key != "$ref"}}


def describe(schema, node, path):
    node = resolve(schema, node)
    if "enum" in node:
        return "one of " + ", ".join(f"`{json.dumps(value)}`" for value in node["enum"])
    if "oneOf" in node:
        return " or ".join(describe(schema, alternative, path) for alternative in node["oneOf"])
    kind = node.get("type")
    if kind is None:
        raise ValueError(f"schema node {path} has no type or $ref")
    if isinstance(kind, list):
        return " or ".join(kind)
    if kind == "array":
        if "prefixItems" in node:
            return "array of [" + ", ".join(describe(schema, item, path) for item in node["prefixItems"]) + "]"
        return f"array of {describe(schema, node['items'], path)}"
    return kind


def walk(schema, node, path, required):
    """Rows (path, type, required, meaning) of a node and everything below it."""
    node = resolve(schema, node)
    meaning = node.get("description", "")
    if "propertyNames" in node:
        meaning = f"{meaning} Keys: {', '.join(node['propertyNames']['enum'])}.".strip()
    rows = [(path, describe(schema, node, path), "yes" if required else "", meaning)]
    for key, child in node.get("properties", {}).items():
        rows += walk(schema, child, f"{path}.{key}", key in node.get("required", []))
    if isinstance(node.get("additionalProperties"), dict):
        rows += walk(schema, node["additionalProperties"], f"{path}.<key>", False)
    item = resolve(schema, node["items"]) if isinstance(node.get("items"), dict) else {}
    if "properties" in item:  # the element's own row would repeat the list's row
        for key, child in item["properties"].items():
            rows += walk(schema, child, f"{path}[].{key}", key in item.get("required", []))
    elif "oneOf" in item:
        rows += walk(schema, item, f"{path}[]", False)
    for alternative in node.get("oneOf", []):
        if "properties" in alternative:
            for key, child in alternative["properties"].items():
                rows += walk(schema, child, f"{path}.{key}", key in alternative.get("required", []))
    return rows


def table(header, rows):
    cell = lambda text: str(text).replace("|", "\\|")
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    return "\n".join(lines + ["| " + " | ".join(cell(item) for item in row) + " |" for row in rows])


def schema_table(name):
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    if name == "root":
        rows = [
            (key, describe(schema, child, key), "yes" if key in schema["required"] else "", resolve(schema, child).get("description", ""))
            for key, child in schema["properties"].items()
        ]
    elif name == "bom":
        rows = walk(schema, schema["properties"]["bom"], "bom", False)
    elif name == "board":
        rows = walk(schema, schema["$defs"]["board"], "boards.<key>", False)
    else:
        raise ValueError(f"no schema table named {name}")
    return table(["Key", "Type", "Required", "Meaning"], [(f"`{path}`", f"`{kind}`" if "`" not in kind else kind, need, meaning) for path, kind, need, meaning in rows])


def token_table(css):
    found = TOKEN.findall(css)
    if not found or len(found) != len(DECLARED.findall(css)):
        raise ValueError("an --ag-* colour of the stylesheet is not written as light-dark(#hex, #hex)")
    return table(["Token", "Light", "Dark"], [(f"`--ag-{name}`", f"`{light}`", f"`{dark}`") for name, light, dark in found])


def fetched(src):
    """The files a page fetches, own files first (size.test.mjs lists the same set)."""
    return ["buildguide.css", "buildguide.js", "buildguide-board.js"] + sorted(
        path.relative_to(src).as_posix() for path in src.rglob("*") if path.is_file() and path.parent != src and path.name not in ("LICENSE", "README.txt")
    )


def precache_lines(src):
    """The core files as the quoted URLs of the service worker example in docs/offline.md."""
    return "\n".join(f"  '/assets/buildguide-<version>/{name}'," for name in fetched(src))


def files_table(src):
    """Size and gzip size in bytes of the fetched files."""
    names = fetched(src)
    sizes = [(name, (src / name).read_bytes()) for name in names]
    # level 6 is zlib's default, as in the size budgets
    rows = [(f"`{name}`", f"{len(data):,}", f"{len(gzip.compress(data, 6, mtime=0)):,}") for name, data in sizes]
    return table(["File", "Bytes", "Gzipped, about"], rows)


def on_page_markdown(markdown, page, config, files):
    def fill(match):
        kind, name = match.groups()
        if kind == "files":
            return files_table(SRC)
        if kind == "precache":
            return precache_lines(SRC)
        return token_table(CSS.read_text(encoding="utf-8")) if kind == "tokens" else schema_table(name)

    return MARKER.sub(fill, markdown)

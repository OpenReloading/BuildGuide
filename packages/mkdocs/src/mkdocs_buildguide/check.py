"""Guide data checks: the bundled JSON Schema, then a port of core's buildguide-check.mjs.

check() gives the same problem lines as the JavaScript check for data that passes the schema
(packages/core/tests/fixtures/ run in both test suites).
"""

import json
from pathlib import Path

from jsonschema import Draft202012Validator

VIEWS = ("intro", "bom", "board")
SCHEMA = json.loads((Path(__file__).parent / "core" / "buildguide.schema.json").read_text(encoding="utf-8"))


def repeated(values):
    seen, found = set(), []
    for v in values:
        if v in seen and v not in found:
            found.append(v)
        seen.add(v)
    return found


def check_board(key, board, page_ids):
    found = []
    parts, colors = board.get("parts") or {}, board.get("colors") or {}
    steps = board.get("steps") or []
    connections = [c for s in steps for c in s.get("connections") or []]
    found += [f"{key}: step {i} used twice" for i in repeated([s.get("id") for s in steps])]
    found += [f"{key}: connection {no} used twice" for no in repeated([c.get("no") for c in connections])]
    terminals = {pid: [pin for side in (part.get("ports") or {}).values() for pin in side] for pid, part in parts.items()}
    for pid, pins in terminals.items():
        found += [f"{key}: part {pid} repeats terminal {pin}" for pin in repeated(pins)]
    # the board draws connection n as cell 'c' + n, next to the parts' own ids
    found += [f"{key}: part c{c['no']} clashes with connection {c['no']}" for c in connections if f"c{c['no']}" in parts]
    ends = {}
    exempt = (board.get("rules") or {}).get("exempt") or {}
    for c in connections:
        for end in (c.get("a"), c.get("b")):
            at = str(end).find(":")
            if at < 1:
                found.append(f"{key} {c['no']}: end {end} is not PART:terminal")
                continue
            pid, pin = end[:at], end[at + 1 :]
            if pid not in parts:
                found.append(f"{key} {c['no']}: no part {pid}")
                continue
            if pin not in terminals[pid]:
                found.append(f"{key} {c['no']}: {pid} has no terminal {pin}")
                continue
            if parts[pid].get("kind") not in (exempt.get("kinds") or []) and c.get("color") not in (exempt.get("colors") or []):
                ends.setdefault(end, []).append(c["no"])
        if c.get("color") not in colors:
            found.append(f"{key} {c['no']}: unknown colour {c.get('color')}")
        elif colors[c["color"]].get("diode") and str(c.get("a")).split(":")[0] != str(c.get("b")).split(":")[0]:
            found.append(f"{key} {c['no']}: diode ends on two parts")
    limit = (board.get("rules") or {}).get("perTerminal")
    if limit:
        for end, nos in ends.items():
            if len(nos) > limit:
                found.append(f"{key}: {len(nos)} connections on {end} ({', '.join(map(str, nos))}), at most {limit}")
    if board.get("next") and board["next"] not in page_ids:
        found.append(f"{key}: next page {board['next']} does not exist")
    return found


def check(data):
    found = []
    if not data.get("storage"):
        found.append("storage: missing")
    pages = data.get("pages") or []
    if not pages:
        found.append("pages: none")
    ids = [p.get("id") for p in pages]
    found += [f"pages: id {i} used twice" for i in repeated(ids)]
    for p in pages:
        view = p.get("view")
        if view not in VIEWS:
            found.append(f"pages.{p.get('id')}: unknown view {view}")
        elif view == "board" and (data.get("boards") or {}).get(p.get("board")) is None:
            found.append(f"pages.{p.get('id')}: no board {p.get('board')}")
        elif view != "board" and data.get(view) is None:
            found.append(f"pages.{p.get('id')}: {view} missing")
    items = (data.get("bom") or {}).get("items") or []
    found += [f"bom: id {item_id} used twice" for item_id in repeated([item.get("id") for item in items])]
    for item in items:
        if not item.get("part"):
            found.append(f"bom.{item.get('id')}: part missing")
        if item.get("qty", "") == "":
            found.append(f"bom.{item.get('id')}: qty missing")
    for key, board in (data.get("boards") or {}).items():
        found += check_board(key, board, ids)
    return found


def problems(data):
    """Schema errors, or when there are none, the check's problem lines."""
    errors = sorted(Draft202012Validator(SCHEMA).iter_errors(data), key=lambda e: e.json_path)
    return [f"{e.json_path}: {e.message}" for e in errors] or check(data)

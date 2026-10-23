import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[3]
spec = importlib.util.spec_from_file_location("reference", ROOT / "docs/hooks/reference.py")
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)


def table_rows(table):
    return [[cell.strip(" `") for cell in line.strip("|").split(" | ")] for line in table.splitlines()[2:]]


def test_board_table_walks_maps_arrays_and_refs():
    rows = {row[0]: row for row in table_rows(reference.schema_table("board"))}
    assert rows["boards.<key>.title"][1:3] == ["string", "yes"]
    assert rows["boards.<key>.size"][1] == "array of number"  # $ref to point, with the board's own description
    assert "drawing width" in rows["boards.<key>.size"][3]
    assert rows["boards.<key>.steps[].connections[].no"][1] == "string"
    assert rows["boards.<key>.legend[].text"][2] == "yes"  # object alternative of a oneOf item
    assert rows["boards.<key>.scope"][1].startswith("one of")
    assert "boards.<key>.steps[]" not in rows and "boards.<key>.steps" in rows  # no second row for the list's elements
    assert rows["boards.<key>.areas.<key>.glands"][1] == "array of array of [number, string]"


def test_root_and_bom_tables():
    assert [row[0] for row in table_rows(reference.schema_table("root"))] == ["$schema", "storage", "bom", "boards"]
    bom = {row[0]: row for row in table_rows(reference.schema_table("bom"))}
    assert bom["bom.items[].qty"][1] == "integer or string"
    assert bom["bom.items[].id"][2] == "yes"


def test_a_node_without_type_or_ref_fails():
    schema = {"type": "object", "properties": {"x": {"description": "anything"}}}
    with pytest.raises(ValueError, match="x"):
        reference.walk(schema, schema, "root", True)


def test_token_table_lists_every_colour_with_both_schemes():
    css = ":root{--ag-ink:light-dark(#111, #eee);\n --ag-page:light-dark(#fff, #000);}"
    assert table_rows(reference.token_table(css)) == [["--ag-ink", "#111", "#eee"], ["--ag-page", "#fff", "#000"]]
    assert len(table_rows(reference.token_table((ROOT / "packages/core/src/buildguide.css").read_text(encoding="utf-8")))) > 20
    with pytest.raises(ValueError):
        reference.token_table("a{}")
    with pytest.raises(ValueError, match="light-dark"):  # a token the pattern cannot read must not drop out silently
        reference.token_table(":root{--ag-ink:light-dark(#111, #eee); --ag-x:light-dark(rgb(0,0,0), #000);}")


def test_markers_are_replaced_and_unknown_ones_fail():
    page = "before\n<!-- generated: tokens -->\nafter"
    text = reference.on_page_markdown(page, None, None, None)
    assert "<!--" not in text and "| `--ag-ink` |" in text
    with pytest.raises(ValueError, match="nothing"):
        reference.on_page_markdown("<!-- generated: schema nothing -->", None, None, None)

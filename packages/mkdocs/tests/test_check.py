import json
from pathlib import Path

import pytest

from mkdocs_buildguide.check import check, problems

CORE = Path(__file__).parents[2] / "core"
FIXTURES = sorted((CORE / "tests/fixtures").glob("*.json"))


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize("path", FIXTURES, ids=[p.name for p in FIXTURES])
def test_fixture_gives_the_same_lines_as_core(path):
    fixture = read(path)
    assert check(fixture["guide"]) == fixture["problems"]


def test_the_example_guide_has_no_problems():
    assert problems(read(CORE / "example/guide.json")) == []


def test_schema_errors_come_first_with_their_path():
    guide = read(CORE / "example/guide.json")
    guide["pages"][0]["view"] = "video"
    guide["bom"]["items"][0]["quantity"] = 1
    found = problems(guide)
    assert [line.split(":")[0] for line in found] == ["$.bom.items[0]", "$.pages[0].view"]

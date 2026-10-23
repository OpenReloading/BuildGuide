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
    del guide["boards"]["tubing"]["title"]
    guide["bom"]["items"][0]["quantity"] = 1
    found = problems(guide)
    assert [line.split(":")[0] for line in found] == ["$.boards.tubing", "$.bom.items[0]"]


def test_a_step_note_must_be_text():
    guide = read(CORE / "example/guide.json")
    guide["boards"]["wiring"]["steps"][0]["note"] = 1
    assert [line.split(":")[0] for line in problems(guide)] == ["$.boards.wiring.steps[0].note"]


MINIMAL = sorted((CORE / "example/minimal").glob("*.json"))


@pytest.mark.parametrize("path", MINIMAL, ids=[p.name for p in MINIMAL])
def test_the_minimal_examples_have_no_problems(path):
    assert problems(read(path)) == []

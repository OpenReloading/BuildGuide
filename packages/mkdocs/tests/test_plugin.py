import json
import re
from pathlib import Path

import pytest
from mkdocs.commands.build import build
from mkdocs.config import load_config
from mkdocs.exceptions import Abort

EXAMPLE = Path(__file__).parents[2] / "core/example/guide.json"
BOM = '<div data-buildguide="bom"></div>'
WIRING = '<div data-buildguide="board" data-board="wiring"></div>'
TUBING = '<div data-buildguide="board" data-board="tubing"></div>'
PAGES = {"a/tubing.md": f"# Tubing\n\n{TUBING}\n", "all.md": f"# All\n\n{BOM}\n\n{WIRING}\n\ntext\n\n{TUBING}\n", "index.md": "# Home\n"}


def site(tmp_path, pages=PAGES, guide=None, strict=False, indent=None):
    guide = guide or json.loads(EXAMPLE.read_text(encoding="utf-8"))
    (tmp_path / "guide.json").write_text(json.dumps(guide, indent=indent), encoding="utf-8")
    for src, text in pages.items():
        (tmp_path / "docs" / src).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / "docs" / src).write_text(text, encoding="utf-8")
    (tmp_path / "mkdocs.yml").write_text(
        "site_name: Test\nplugins:\n  - search\n  - buildguide:\n      data: guide.json\n      assets: media/\n", encoding="utf-8"
    )
    build(load_config(str(tmp_path / "mkdocs.yml"), strict=strict))
    return tmp_path / "site"


def guide_data(page):
    return json.loads(re.search(r'<script type="application/json" id="guide-data"[^>]*>(.*?)</script>', page).group(1))


def test_pages_with_components_get_inline_data_and_core_once(tmp_path):
    out = site(tmp_path)
    page = (out / "all/index.html").read_text(encoding="utf-8")
    assert page.count('data-buildguide="') == 3
    assert page.count("<noscript>This guide needs JavaScript.</noscript></div>") == 3
    assert page.count('id="guide-data"') == 1
    assert 'id="guide-data" data-assets="../media/"' in page
    assert page.count('<link rel="stylesheet" href="../assets/buildguide/buildguide.css">') == 1
    assert page.count('<script src="../assets/buildguide/buildguide.js" defer></script>') == 1
    assert guide_data(page) == json.loads(EXAMPLE.read_text(encoding="utf-8"))
    nested = (out / "a/tubing/index.html").read_text(encoding="utf-8")
    assert 'data-assets="../../media/"' in nested
    assert '<script src="../../assets/buildguide/buildguide.js" defer></script>' in nested
    for name in ("buildguide.js", "buildguide-board.js", "buildguide-mkdocs.css", "vendor/joint/joint.min.js", "vendor/libavoid/LICENSE"):
        assert (out / "assets/buildguide" / name).is_file()


def test_pages_without_a_component_get_nothing(tmp_path):
    index = (site(tmp_path) / "index.html").read_text(encoding="utf-8")
    for text in ("guide-data", "buildguide", "data-buildguide"):
        assert text not in index


def test_code_samples_are_not_components(tmp_path):
    pages = {"index.md": f"```html\n{BOM}\n```\n\nInline `{WIRING}`.\n"}
    index = (site(tmp_path, pages=pages) / "index.html").read_text(encoding="utf-8")
    assert "guide-data" not in index


def test_inline_data_cannot_end_its_script(tmp_path):
    guide = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    guide["boards"]["wiring"]["title"] = "Kit </script><script>alert(1)</script>"
    page = (site(tmp_path, guide=guide) / "all/index.html").read_text(encoding="utf-8")
    assert "</script><script>alert(1)" not in page
    assert guide_data(page)["boards"]["wiring"]["title"] == guide["boards"]["wiring"]["title"]


def test_json_data_indented_with_tabs_is_read(tmp_path):
    page = (site(tmp_path, indent="\t") / "all/index.html").read_text(encoding="utf-8")
    assert guide_data(page)["storage"]


def test_problems_in_the_data_stop_the_build(tmp_path, caplog):
    guide = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    guide["boards"]["wiring"]["steps"][1]["connections"][0]["no"] = "1"
    with pytest.raises(Abort):
        site(tmp_path, guide=guide)
    assert "wiring: connection 1 used twice" in caplog.text


@pytest.mark.parametrize(
    ("tag", "message"),
    [
        ('<div data-buildguide="video"></div>', "no guide component video"),
        ('<div data-buildguide="board" data-board="nowhere"></div>', "no guide component board nowhere"),
        ('<div data-buildguide="board"></div>', "no guide component board"),
        ('<div data-buildguide="bom-x"></div>', "no guide component bom-x"),
        ('<div data-buildguide="boards" data-board="wiring"></div>', "no guide component boards wiring"),
        ('<div data-buildguide></div>', "data-buildguide has no value"),
        ('<div data-buildguide=""></div>', "data-buildguide has no value"),
    ],
)
def test_an_unknown_component_fails_a_strict_build(tmp_path, caplog, tag, message):
    with pytest.raises(Abort):
        site(tmp_path, pages={"index.md": f"{tag}\n"}, strict=True)
    assert f"index.md: {message}" in caplog.text


def test_an_unknown_component_is_a_warning_without_strict(tmp_path, caplog):
    site(tmp_path, pages={"index.md": '<div data-buildguide="video"></div>\n'})
    assert "no guide component video" in caplog.text


def test_a_component_without_bom_data_is_unknown(tmp_path, caplog):
    guide = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    del guide["bom"]
    with pytest.raises(Abort):
        site(tmp_path, guide=guide, pages={"index.md": f"{BOM}\n"}, strict=True)
    assert "no guide component bom" in caplog.text


@pytest.mark.parametrize("number", ["NaN", "Infinity", "-Infinity"])
def test_non_finite_numbers_stop_the_build(tmp_path, caplog, number):
    guide = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    guide["boards"]["wiring"]["size"][0] = "@@"
    (tmp_path / "docs").mkdir()
    (tmp_path / "guide.json").write_text(json.dumps(guide).replace('"@@"', number), encoding="utf-8")
    (tmp_path / "mkdocs.yml").write_text("site_name: Test\nplugins:\n  - buildguide:\n      data: guide.json\n", encoding="utf-8")
    with pytest.raises(Abort):
        build(load_config(str(tmp_path / "mkdocs.yml")))
    assert "NaN or Infinity" in caplog.text


def test_non_finite_numbers_in_yaml_stop_the_build(tmp_path, caplog):
    (tmp_path / "docs").mkdir()
    (tmp_path / "guide.yml").write_text("storage: s\nx:\n  - .nan\n", encoding="utf-8")
    (tmp_path / "mkdocs.yml").write_text("site_name: Test\nplugins:\n  - buildguide:\n      data: guide.yml\n", encoding="utf-8")
    with pytest.raises(Abort):
        build(load_config(str(tmp_path / "mkdocs.yml")))
    assert "NaN or Infinity" in caplog.text


@pytest.mark.parametrize("attribute", ['data-board="wiring box"', "data-board='wiring box'", 'class="x" data-board="wiring box" id="y"'])
def test_a_board_key_may_hold_spaces_and_any_quote(tmp_path, attribute):
    guide = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    guide["boards"]["wiring box"] = guide["boards"].pop("wiring")
    out = site(tmp_path, guide=guide, pages={"index.md": f'<div data-buildguide="board" {attribute}></div>\n'}, strict=True)
    assert "guide-data" in (out / "index.html").read_text(encoding="utf-8")


def test_the_no_javascript_note_is_on_the_page_but_not_in_the_search_index(tmp_path):
    out = site(tmp_path)
    assert "needs JavaScript" in (out / "all/index.html").read_text(encoding="utf-8")
    assert "needs JavaScript" not in (out / "search/search_index.json").read_text(encoding="utf-8")


def test_a_component_with_content_keeps_it(tmp_path):
    pages = {"index.md": '<div data-buildguide="bom">Plain text</div>\n'}
    index = (site(tmp_path, pages=pages) / "index.html").read_text(encoding="utf-8")
    assert '<div data-buildguide="bom">Plain text</div>' in index


@pytest.mark.parametrize(
    "text",
    [
        '<!-- <div data-buildguide="video"></div> -->',
        '<div title="data-buildguide=video"></div>',
        '<div class="x" title=\'a data-board="nowhere"\'></div>',
    ],
)
def test_only_real_component_divs_count(tmp_path, text):
    index = (site(tmp_path, pages={"index.md": f"{text}\n"}, strict=True) / "index.html").read_text(encoding="utf-8")
    assert "guide-data" not in index


def test_a_data_board_inside_another_value_is_not_the_board_key(tmp_path, caplog):
    page = '<div data-buildguide="board" title="data-board=wiring"></div>\n'
    with pytest.raises(Abort):
        site(tmp_path, pages={"index.md": page}, strict=True)
    assert "no guide component board" in caplog.text


@pytest.mark.parametrize("inside", ["\n", " ", "\n  \n"])
def test_a_whitespace_only_component_gets_the_note(tmp_path, inside):
    index = (site(tmp_path, pages={"index.md": f'<div data-buildguide="bom">{inside}</div>\n'}) / "index.html").read_text(encoding="utf-8")
    assert "<noscript>This guide needs JavaScript.</noscript>" in index

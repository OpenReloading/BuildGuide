import html
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


def site(tmp_path, pages=PAGES, guide=None, strict=False, indent=None, theme=None, extra_css=(), guides=None):
    guide = guide or json.loads(EXAMPLE.read_text(encoding="utf-8"))
    (tmp_path / "guide.json").write_text(json.dumps(guide, indent=indent), encoding="utf-8")
    for i, other in enumerate((guides or {}).values()):  # the ids are not file names here: a test may give an unsafe one
        (tmp_path / f"guide-{i}.json").write_text(json.dumps(other), encoding="utf-8")
    for src, text in pages.items():
        (tmp_path / "docs" / src).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / "docs" / src).write_text(text, encoding="utf-8")
    (tmp_path / "mkdocs.yml").write_text(
        "site_name: Test\n" + (f"theme:\n  name: {theme}\n" if theme else "") + "".join(f"extra_css:\n  - {path}\n" if i == 0 else f"  - {path}\n" for i, path in enumerate(extra_css))
        + "plugins:\n  - search\n  - buildguide:\n      data: guide.json\n      assets: media/\n"
        + ("      guides:\n" + "".join(f"        '{name}': guide-{i}.json\n" for i, name in enumerate(guides)) if guides else ""),
        encoding="utf-8",
    )
    build(load_config(str(tmp_path / "mkdocs.yml"), strict=strict))
    return tmp_path / "site"


def guide_data(page):
    return json.loads(html.unescape(re.search(r'<div id="guide-data"[^>]*>(.*?)</div>', page, re.DOTALL).group(1)))


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


@pytest.mark.parametrize("theme", [None, "material"])
def test_stylesheets_come_before_extra_css(tmp_path, theme):
    # a plain `.ag-guide{...}` rule of the site wins at equal specificity only when it comes later
    (tmp_path / "docs/css").mkdir(parents=True)
    (tmp_path / "docs/css/site.css").write_text(".ag-guide{--ag-font:serif}", encoding="utf-8")
    out = site(tmp_path, theme=theme, extra_css=["css/site.css", "https://example.org/host.css"])
    for src, depth in (("all", "../"), ("a/tubing", "../../")):
        page = (out / src / "index.html").read_text(encoding="utf-8")
        order = [page.index(f'href="{depth}assets/buildguide/buildguide{name}.css"') for name in ("", "-mkdocs")]
        assert order == sorted(order)
        assert order[-1] < page.index(f'href="{depth}css/site.css"') < page.index('href="https://example.org/host.css"')


@pytest.mark.parametrize("link", ["<link href='{}' rel='stylesheet'>", "<LINK HREF = \"{}\" rel=stylesheet>", "<link rel=stylesheet href={}>", "<link rel=stylesheet href={} />"])
def test_stylesheets_come_before_a_differently_written_extra_css_link(tmp_path, link):
    # a custom theme may quote the href any way it likes, or not at all
    (tmp_path / "theme").mkdir()
    (tmp_path / "theme/main.html").write_text("<html><head>" + link.format("{{ 'css/site.css'|url }}") + "</head><body>{{ page.content }}</body></html>", encoding="utf-8")
    (tmp_path / "docs/css").mkdir(parents=True)
    (tmp_path / "docs/css/site.css").write_text(".ag-guide{--ag-font:serif}", encoding="utf-8")
    page = (site(tmp_path, theme="null\n  custom_dir: theme", extra_css=["css/site.css"]) / "all/index.html").read_text(encoding="utf-8")
    assert page.index("buildguide-mkdocs.css") < page.lower().index("css/site.css")


def test_extra_css_link_is_matched_case_sensitively(tmp_path):
    # an earlier link that differs from the extra_css entry only in case is another file
    (tmp_path / "theme").mkdir()
    (tmp_path / "theme/main.html").write_text(
        "<html><head><link href='{{ \"css/Site.css\"|url }}' rel='stylesheet'><link href='{{ \"css/site.css\"|url }}' rel='stylesheet'></head><body>{{ page.content }}</body></html>",
        encoding="utf-8",
    )
    (tmp_path / "docs/css").mkdir(parents=True)
    (tmp_path / "docs/css/site.css").write_text(".ag-guide{--ag-font:serif}", encoding="utf-8")
    page = (site(tmp_path, theme="null\n  custom_dir: theme", extra_css=["css/site.css"]) / "all/index.html").read_text(encoding="utf-8")
    assert page.index("css/Site.css") < page.index("buildguide-mkdocs.css") < page.index("css/site.css")


def test_stylesheets_go_to_the_end_of_the_head_without_extra_css(tmp_path):
    page = (site(tmp_path) / "all/index.html").read_text(encoding="utf-8")
    assert 'buildguide-mkdocs.css"></head>' in page


def test_material_gets_data_and_core_inside_the_article(tmp_path):
    # instant navigation swaps the article and runs its scripts again, and drops what follows it in the body
    page = (site(tmp_path, theme="material") / "all/index.html").read_text(encoding="utf-8")
    article = page[page.index("<article") : page.rindex("</article>")]
    assert 'id="guide-data"' in article
    assert '<script src="../assets/buildguide/buildguide.js" defer></script>' in article
    assert guide_data(page) == json.loads(EXAMPLE.read_text(encoding="utf-8"))


def test_pages_without_a_component_get_nothing(tmp_path):
    index = (site(tmp_path) / "index.html").read_text(encoding="utf-8")
    for text in ("guide-data", "buildguide", "data-buildguide"):
        assert text not in index


def test_code_samples_are_not_components(tmp_path):
    pages = {"index.md": f"```html\n{BOM}\n```\n\nInline `{WIRING}`.\n"}
    index = (site(tmp_path, pages=pages) / "index.html").read_text(encoding="utf-8")
    assert "guide-data" not in index


def test_inline_data_cannot_end_its_element(tmp_path):
    guide = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    guide["boards"]["wiring"]["title"] = "Kit </div><script>alert(1)</script> &amp; "
    page = (site(tmp_path, guide=guide) / "all/index.html").read_text(encoding="utf-8")
    assert "<script>alert(1)" not in page
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
        ('<div data-buildguide="guide" data-board="wiring nowhere"></div>', "no guide component guide wiring nowhere"),
        ('<div data-buildguide="guide" data-board="bom nowhere"></div>', "no guide component guide bom nowhere"),
    ],
)
def test_an_unknown_component_fails_a_strict_build(tmp_path, caplog, tag, message):
    with pytest.raises(Abort):
        site(tmp_path, pages={"index.md": f"{tag}\n"}, strict=True)
    assert f"index.md: {message}" in caplog.text


@pytest.mark.parametrize("attributes", ["", ' data-board="wiring"', ' data-board="tubing   bom wiring"', " data-board='bom'"])
def test_the_guide_view_takes_the_bom_and_every_board_or_a_list_of_them(tmp_path, attributes):
    out = site(tmp_path, pages={"index.md": f'<div data-buildguide="guide"{attributes}></div>\n'}, strict=True)
    page = (out / "index.html").read_text(encoding="utf-8")
    assert f'<div data-buildguide="guide"{attributes}><noscript>This guide needs JavaScript.</noscript></div>' in page
    assert guide_data(page) == json.loads(EXAMPLE.read_text(encoding="utf-8"))


def test_the_guide_view_without_bom_data_takes_the_boards_only(tmp_path, caplog):
    guide = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    del guide["bom"]
    site(tmp_path, guide=guide, pages={"index.md": '<div data-buildguide="guide"></div>\n'}, strict=True)
    with pytest.raises(Abort):
        site(tmp_path, guide=guide, pages={"index.md": '<div data-buildguide="guide" data-board="bom"></div>\n'}, strict=True)
    assert "no guide component guide bom" in caplog.text


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


@pytest.mark.parametrize(("text", "message"), [("a: [unclosed\n", "not valid JSON or YAML"), ("- 1\n- 2\n", "not a guide object")])
def test_data_that_is_not_a_guide_stops_the_build(tmp_path, caplog, text, message):
    (tmp_path / "docs").mkdir()
    (tmp_path / "guide.yml").write_text(text, encoding="utf-8")
    (tmp_path / "mkdocs.yml").write_text("site_name: Test\nplugins:\n  - buildguide:\n      data: guide.yml\n", encoding="utf-8")
    with pytest.raises(Abort):
        build(load_config(str(tmp_path / "mkdocs.yml")))
    assert message in caplog.text


def second():
    """A second guide: another storage key, no tubing board."""
    guide = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    guide.update(storage="second-demo")
    del guide["boards"]["tubing"]
    guide["boards"]["wiring"]["title"] = "Second wiring"
    return guide


SECOND_BOM = '<div data-buildguide="bom" data-guide="second"></div>'
SECOND_WIRING = '<div data-buildguide="board" data-board="wiring" data-guide="second"></div>'


def test_two_guides_on_two_pages_each_page_gets_only_its_own(tmp_path):
    pages = {"a/first.md": f"# A\n\n{BOM}\n", "b/second.md": f"# B\n\n{SECOND_BOM}\n{SECOND_WIRING}\n"}
    out = site(tmp_path, pages=pages, guides={"second": second()}, strict=True)
    first = (out / "a/first/index.html").read_text(encoding="utf-8")
    assert guide_data(first) == json.loads(EXAMPLE.read_text(encoding="utf-8"))
    assert "data-src" not in first and "guides/second.json" not in first and "second-demo" not in first
    other = (out / "b/second/index.html").read_text(encoding="utf-8")
    assert "guide-data" not in other and "buildguide-demo" not in other and "second-demo" not in other
    assert other.count('<div data-src="../../assets/buildguide/guides/second.json" data-assets="../../media/" data-buildguide=') == 2
    assert other.count('<script src="../../assets/buildguide/buildguide.js" defer></script>') == 1
    assert other.count("<noscript>This guide needs JavaScript.</noscript></div>") == 2
    assert (out / "assets/buildguide/guides/second.json").read_text(encoding="utf-8") == json.dumps(second(), separators=(",", ":"))


def test_a_page_may_use_both_the_guide_of_data_and_a_named_one(tmp_path):
    out = site(tmp_path, pages={"index.md": f"{BOM}\n\n{SECOND_BOM}\n"}, guides={"second": second()})
    page = (out / "index.html").read_text(encoding="utf-8")
    assert guide_data(page)["storage"] == "buildguide-demo"
    assert page.count('data-src="assets/buildguide/guides/second.json" data-assets="media/"') == 1
    assert page.count('<script src="assets/buildguide/buildguide.js" defer></script>') == 1


def test_a_named_guide_with_a_data_src_or_data_assets_of_its_own_keeps_them(tmp_path):
    tag = '<div data-buildguide="bom" data-guide="second" data-src="mine.json" data-assets="pics/"></div>'
    page = (site(tmp_path, pages={"index.md": f"{tag}\n"}, guides={"second": second()}) / "index.html").read_text(encoding="utf-8")
    assert tag.replace("></div>", "><noscript>This guide needs JavaScript.</noscript></div>") in page
    assert "guides/second.json" not in page
    tag = '<div data-buildguide="bom" data-guide="second" data-assets="pics/"></div>'
    page = (site(tmp_path, pages={"index.md": f"{tag}\n"}, guides={"second": second()}) / "index.html").read_text(encoding="utf-8")
    assert '<div data-src="assets/buildguide/guides/second.json" data-buildguide="bom" data-guide="second" data-assets="pics/">' in page


def test_the_component_must_exist_in_the_guide_it_names(tmp_path, caplog):
    with pytest.raises(Abort):
        site(tmp_path, pages={"index.md": '<div data-buildguide="board" data-board="tubing" data-guide="second"></div>\n'}, guides={"second": second()}, strict=True)
    assert "index.md: no guide component board tubing" in caplog.text


@pytest.mark.parametrize("tag", ['<div data-buildguide="bom" data-guide="nowhere"></div>', '<div data-buildguide="bom" data-guide=""></div>'])
def test_an_unknown_guide_is_a_warning_and_fails_a_strict_build(tmp_path, caplog, tag):
    site(tmp_path, pages={"index.md": f"{tag}\n"}, guides={"second": second()})
    assert "index.md: no guide '" in caplog.text
    with pytest.raises(Abort):
        site(tmp_path, pages={"index.md": f"{tag}\n"}, guides={"second": second()}, strict=True)


def test_guides_may_not_share_a_storage_key(tmp_path, caplog):
    other = second()
    other["storage"] = json.loads(EXAMPLE.read_text(encoding="utf-8"))["storage"]
    with pytest.raises(Abort):
        site(tmp_path, guides={"second": other})
    assert "data and guides.second have the same storage key 'buildguide-demo'" in caplog.text
    caplog.clear()
    with pytest.raises(Abort):
        site(tmp_path, guides={"second": second(), "third": second()})
    assert "guides.second and guides.third have the same storage key 'second-demo'" in caplog.text


@pytest.mark.parametrize("name", ["../x", "a b", "a.b", "a/b"])
def test_a_guide_id_that_is_not_a_plain_name_is_refused(tmp_path, caplog, name):
    with pytest.raises(Abort):
        site(tmp_path, guides={name: second()})
    assert "may only hold letters, digits, - and _" in caplog.text
    assert not (tmp_path / "x.json").exists()


def test_a_problem_in_a_named_guide_stops_the_build(tmp_path, caplog):
    other = second()
    other["boards"]["wiring"]["steps"][1]["connections"][0]["no"] = "1"
    with pytest.raises(Abort):
        site(tmp_path, guides={"second": other})
    assert "guide-0.json" in caplog.text and "wiring: connection 1 used twice" in caplog.text


def test_a_site_without_guides_writes_no_guide_files(tmp_path):
    assert list((site(tmp_path) / "assets/buildguide/guides").iterdir()) == []

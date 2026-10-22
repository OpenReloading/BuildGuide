import json
import re
from pathlib import Path

import pytest
from mkdocs.commands.build import build
from mkdocs.config import load_config
from mkdocs.exceptions import Abort

EXAMPLE = Path(__file__).parents[2] / "core/example/guide.json"
# guide page id -> MkDocs page; tubing comes first in the build, the introduction is the site root
PAGES = {"tubing": "a/tubing.md", "bom": "bom.md", "wiring": "wiring.md", "intro": "index.md"}


def site(tmp_path, pages=PAGES, guide=None, strict=False, indent=None):
    guide = guide or json.loads(EXAMPLE.read_text(encoding="utf-8"))
    (tmp_path / "guide.json").write_text(json.dumps(guide, indent=indent), encoding="utf-8")
    for page_id, src in pages.items():
        (tmp_path / "docs" / src).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / "docs" / src).write_text(f"---\nbuildguide: {page_id}\n---\n", encoding="utf-8")
    (tmp_path / "docs/other.md").write_text("# Other\n", encoding="utf-8")
    (tmp_path / "mkdocs.yml").write_text(
        "site_name: Test\nplugins:\n  - buildguide:\n      data: guide.json\n      assets: media/\n", encoding="utf-8"
    )
    build(load_config(str(tmp_path / "mkdocs.yml"), strict=strict))
    return tmp_path / "site"


def guide_data(page):
    return json.loads(re.search(r'<script type="application/json" id="guide-data">(.*?)</script>', page).group(1))


def test_guide_pages_get_the_root_div_inline_data_and_core(tmp_path):
    out = site(tmp_path)
    page = (out / "a/tubing/index.html").read_text(encoding="utf-8")
    assert '<div id="assembly-guide" data-page="tubing" data-site="../../" data-assets="media/">' in page
    assert '<link rel="stylesheet" href="../../assets/buildguide/buildguide.css">' in page
    assert '<script src="../../assets/buildguide/buildguide.js" defer></script>' in page
    assert {p["id"]: p["path"] for p in guide_data(page)["pages"]} == {
        "intro": "./",
        "bom": "bom/",
        "wiring": "wiring/",
        "tubing": "a/tubing/",
    }
    assert 'data-site="./"' in (out / "index.html").read_text(encoding="utf-8")
    assert "assembly-guide" not in (out / "other/index.html").read_text(encoding="utf-8")
    for name in ("buildguide.js", "buildguide-board.js", "buildguide-mkdocs.css", "vendor/joint/joint.min.js", "vendor/libavoid/LICENSE"):
        assert (out / "assets/buildguide" / name).is_file()


def test_inline_data_cannot_end_its_script(tmp_path):
    guide = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    guide["intro"]["title"] = "Kit </script><script>alert(1)</script>"
    page = (site(tmp_path, guide=guide) / "index.html").read_text(encoding="utf-8")
    assert "</script><script>alert(1)" not in page
    assert guide_data(page)["intro"]["title"] == guide["intro"]["title"]


def test_json_data_indented_with_tabs_is_read(tmp_path):
    page = (site(tmp_path, indent="\t") / "index.html").read_text(encoding="utf-8")
    assert guide_data(page)["storage"]


def test_problems_in_the_data_stop_the_build(tmp_path, caplog):
    guide = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    guide["boards"]["wiring"]["next"] = "nowhere"
    with pytest.raises(Abort):
        site(tmp_path, guide=guide)
    assert "wiring: next page nowhere does not exist" in caplog.text


def test_front_matter_must_name_a_guide_page(tmp_path, caplog):
    with pytest.raises(Abort):
        site(tmp_path, pages={**PAGES, "video": "video.md"})
    assert "video.md: no guide page video" in caplog.text


def test_a_guide_page_without_a_mkdocs_page_fails_a_strict_build(tmp_path, caplog):
    with pytest.raises(Abort):
        site(tmp_path, pages={k: v for k, v in PAGES.items() if k != "tubing"}, strict=True)
    assert "guide page tubing has no MkDocs page" in caplog.text

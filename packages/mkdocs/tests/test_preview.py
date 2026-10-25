from pathlib import Path

from mkdocs.commands.build import build
from mkdocs.config import load_config

ROOT = Path(__file__).parents[3]
NOINDEX = '<meta name="robots" content="noindex, nofollow">'


def build_docs(tmp_path):
    # repo_url off: the repo_facts hook would call the GitHub API
    build(load_config(str(ROOT / "mkdocs.yml"), site_dir=str(tmp_path), repo_url=None))
    return list(tmp_path.rglob("*.html"))


def test_preview_pages_carry_noindex_and_banner(tmp_path, monkeypatch):
    monkeypatch.setenv("BUILDGUIDE_PREVIEW", "true")
    pages = build_docs(tmp_path)
    assert tmp_path / "index.html" in pages and tmp_path / "404.html" in pages
    for page in pages:
        text = page.read_text(encoding="utf-8")
        assert NOINDEX in text and 'class="md-banner"' in text and "not the released site" in text, page


def test_released_site_has_neither(tmp_path, monkeypatch):
    monkeypatch.delenv("BUILDGUIDE_PREVIEW", raising=False)
    for page in build_docs(tmp_path):
        text = page.read_text(encoding="utf-8")
        assert 'name="robots" content="noindex' not in text and 'class="md-banner"' not in text, page

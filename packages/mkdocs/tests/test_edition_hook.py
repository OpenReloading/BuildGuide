import importlib.util
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).parents[3]
spec = importlib.util.spec_from_file_location("edition", ROOT / "docs/hooks/edition.py")
edition = importlib.util.module_from_spec(spec)
spec.loader.exec_module(edition)


def config():
    plugin = SimpleNamespace(guide={"storage": "demo"}, guides={"second": {"storage": "second-demo"}})
    return SimpleNamespace(plugins={"buildguide": plugin}), plugin


def test_the_next_edition_suffixes_every_storage_key(monkeypatch):
    monkeypatch.setenv("BUILDGUIDE_EDITION", "next")
    cfg, plugin = config()
    edition.on_pre_build(cfg)
    assert plugin.guide["storage"] == "demo-next" and plugin.guides["second"]["storage"] == "second-demo-next"


def test_any_other_edition_keeps_the_keys(monkeypatch):
    for value in (None, "stable", ""):
        monkeypatch.delenv("BUILDGUIDE_EDITION", raising=False) if value is None else monkeypatch.setenv("BUILDGUIDE_EDITION", value)
        cfg, plugin = config()
        edition.on_pre_build(cfg)
        assert plugin.guide["storage"] == "demo" and plugin.guides["second"]["storage"] == "second-demo"

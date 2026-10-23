"""Repository facts (latest release tag, stars, forks) for the header, fetched once per build.

Material's own widget calls the GitHub API in every visitor's browser. This hook calls it at
build time instead and passes the values to overrides/partials/source.html through
config.extra["repo_facts"]. Any failure leaves the facts out; the build never fails because of it.
"""

import json
import logging
import os
import re
import urllib.request

log = logging.getLogger("mkdocs.hooks.repo_facts")
API = "https://api.github.com/repos/"
_cache = {}
ERRORS = (OSError, ValueError, LookupError, TypeError)  # network, JSON, missing field


def _get(path):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "mkdocs-repo-facts"}
    if os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
    with urllib.request.urlopen(urllib.request.Request(API + path, headers=headers), timeout=5) as r:
        return json.load(r)


def _count(n):
    # same rounding as Material's script (1234 -> 1.2k)
    return f"{(n + 1e-6) / 1e3:.{int((n - 950) % 1000 > 99)}f}k" if n > 999 else str(n)


def _facts(repo):
    info = _get(repo)
    facts = {}
    try:
        tag = _get(repo + "/releases/latest")["tag_name"]
    except ERRORS:
        try:
            tag = _get(repo + "/tags")[0]["name"]
        except ERRORS:
            tag = None
    if tag:
        facts["version"] = tag
    facts["stars"] = _count(info["stargazers_count"])
    facts["forks"] = _count(info["forks_count"])
    return facts


def on_config(config):
    match = re.fullmatch(r"https://github\.com/([\w.-]+/[\w.-]+)/?", config.get("repo_url") or "")
    if match:
        repo = match.group(1)
        if repo not in _cache:
            try:
                _cache[repo] = _facts(repo)
            except ERRORS as error:  # offline, rate limit, API change: the header just has no facts
                log.info("No repository facts for %s: %s", repo, error)
                _cache[repo] = {}
        config.extra["repo_facts"] = _cache[repo]
    return config

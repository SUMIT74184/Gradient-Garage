"""Fetch items from Hugging Face, GitHub, PyPI and npm, and map them to admin field values.

Mapping functions are pure (dict in, dict out) so they're easy to test. All HTTP goes
through `get_json`, which tests replace.
"""

import re
from datetime import datetime
from typing import Any
from urllib.parse import quote, urlencode

import httpx

from app.config import get_settings
from app.models import ContentType

HF = "https://huggingface.co"
USER_AGENT = "gradient-garage-sync"


class SourceError(Exception):
    """A remote API failed; the sync records it and carries on with the rest."""


def get_json(url: str, headers: dict[str, str] | None = None) -> Any:
    """GET a JSON document. Returns None on 404; raises SourceError on any other failure."""
    try:
        r = httpx.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json", **(headers or {})},
            timeout=get_settings().sync_timeout_seconds,
            follow_redirects=True,
        )
    except httpx.HTTPError as e:
        raise SourceError(f"{_host(url)}: {type(e).__name__}") from e
    if r.status_code == 404:
        return None
    if r.status_code >= 400:
        raise SourceError(f"{_host(url)} returned {r.status_code}")
    try:
        return r.json()
    except ValueError as e:
        raise SourceError(f"{_host(url)} returned invalid JSON") from e


def _host(url: str) -> str:
    return url.split("/")[2] if "//" in url else url


def _hf_headers() -> dict[str, str]:
    token = get_settings().hf_token
    return {"Authorization": f"Bearer {token}"} if token else {}


# ---------- small helpers (same rules the website used) ----------


def as_list(v: Any) -> list[str]:
    if not v:
        return []
    return [str(x) for x in v] if isinstance(v, list) else [str(v)]


def pretty_name(slug: str) -> str:
    return re.sub(r"\b\w", lambda m: m.group(0).upper(), re.sub(r"[-_]+", " ", slug))


def format_params(n: int | None) -> str | None:
    if not n:
        return None
    if n >= 1e9:
        return f"{round(n / 1e9, 1):g}B"
    if n >= 1e6:
        return f"{round(n / 1e6)}M"
    return f"{round(n / 1e3)}K"


def _date(iso: str | None) -> str | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def _tag_values(tags: list[str], prefix: str) -> list[str]:
    return [t[len(prefix):] for t in tags if t.startswith(prefix)]


# Tags the Hub adds automatically; not useful to show
NOISE_TAG = re.compile(
    r"^(base_model:|license:|dataset:|arxiv:|region:|endpoints_compatible|deploy:|autotrain_compatible"
    r"|text-generation-inference|safetensors|eval-results)"
)

# Fields the remote side owns on every item and the sync always refreshes.
# Everything else it maps is "metadata": refreshed only on Hugging Face items, and
# never once an admin has edited it (`edited_fields`).
STAT_FIELDS: dict[ContentType, set[str]] = {
    ContentType.model: {"downloads", "likes", "content_date"},
    ContentType.dataset: {"downloads", "likes", "content_date"},
    ContentType.demo: {"likes", "content_date"},
    ContentType.library: {"stars", "package_version", "content_date"},
}


# ---------- Hugging Face ----------

MODEL_EXPAND = ["downloads", "likes", "pipeline_tag", "library_name", "lastModified", "tags", "safetensors", "cardData"]
DATASET_EXPAND = ["downloads", "likes", "lastModified", "tags", "cardData", "description"]
SPACE_EXPAND = ["likes", "sdk", "lastModified", "tags", "models", "subdomain", "cardData"]


def _list_url(kind: str, author: str, expand: list[str], sort: str) -> str:
    params = [("author", author), ("limit", "1000"), ("sort", sort)] + [("expand[]", f) for f in expand]
    return f"{HF}/api/{kind}?{urlencode(params)}"


def fetch_hf(kind: str, author: str) -> list[dict]:
    """kind: models | datasets | spaces."""
    expand, sort = {
        "models": (MODEL_EXPAND, "downloads"),
        "datasets": (DATASET_EXPAND, "downloads"),
        "spaces": (SPACE_EXPAND, "likes"),
    }[kind]
    data = get_json(_list_url(kind, author, expand, sort), _hf_headers())
    if data is None:
        return []
    if not isinstance(data, list):
        raise SourceError(f"huggingface.co returned an unexpected {kind} list")
    return [d for d in data if isinstance(d, dict) and isinstance(d.get("id"), str)]


def map_hf_model(m: dict) -> dict[str, Any]:
    author, _, slug = m["id"].partition("/")
    slug = slug or m["id"]
    tags: list[str] = m.get("tags") or []
    card = m.get("cardData") or {}
    base = next(iter(as_list(card.get("base_model"))), None)
    if base is None:
        found = next((t for t in tags if t.startswith("base_model:")), None)
        if found:
            base = re.sub(r"^base_model:(finetune:|adapter:|quantized:|merge:)?", "", found)
    datasets = as_list(card.get("datasets")) or _tag_values(tags, "dataset:")
    task = m.get("pipeline_tag") or "other"
    library = m.get("library_name")
    license_ = next(iter(as_list(card.get("license"))), None) or next(iter(_tag_values(tags, "license:")), None)
    return {
        "slug": m["id"],
        "name": pretty_name(slug),
        "author": author,
        "description": f"{pretty_name(task)} model{f' fine-tuned from {base}' if base else ''}.",
        "task": task,
        "kind": "fine-tuned" if base else "base",
        "base_model": base,
        "datasets": datasets,
        "params": format_params((m.get("safetensors") or {}).get("total")),
        "license": license_ or "unknown",
        "library": library,
        "tags": [t for t in tags if not NOISE_TAG.match(t) and t not in (task, library) and ":" not in t][:6],
        "downloads": int(m.get("downloads") or 0),
        "likes": int(m.get("likes") or 0),
        "content_date": _date(m.get("lastModified")),
        "links": {"huggingface": f"{HF}/{m['id']}"},
    }


MODALITIES = {"image", "video", "text", "audio", "tabular"}


def _size_category(c: str) -> str:
    """"1K<n<10K" -> "1K–10K", "n<1K" -> "< 1K", "n>1T" -> "> 1T"."""
    m = re.fullmatch(r"(\w+)<n<(\w+)", c)
    if m:
        return f"{m.group(1)}–{m.group(2)}"
    return re.sub(r"^n([<>])", r"\1 ", c)


def map_hf_dataset(d: dict) -> dict[str, Any]:
    author, _, slug = d["id"].partition("/")
    slug = slug or d["id"]
    tags: list[str] = d.get("tags") or []
    card = d.get("cardData") or {}
    modalities = [m for m in _tag_values(tags, "modality:") if m in MODALITIES]
    task = next(iter(_tag_values(tags, "task_categories:")), None)
    size = next(iter(_tag_values(tags, "size_categories:")), None)
    first_line = (d.get("description") or "").strip().split("\n")[0].strip()
    return {
        "slug": d["id"],
        "name": (card.get("pretty_name") or pretty_name(slug))[:200],
        "author": author,
        "description": first_line[:1000] or f"{pretty_name(task or 'ML')} dataset.",
        "modality": "multimodal" if len(modalities) > 1 else (modalities[0] if modalities else "other"),
        "task": task,
        "size": f"{_size_category(size)} rows" if size else None,
        "license": next(iter(as_list(card.get("license"))), None) or next(iter(_tag_values(tags, "license:")), None) or "unknown",
        "tags": [t for t in tags if ":" not in t][:6],
        "downloads": int(d.get("downloads") or 0),
        "likes": int(d.get("likes") or 0),
        "content_date": _date(d.get("lastModified")),
        "links": {"huggingface": f"{HF}/datasets/{d['id']}"},
    }


SDKS = {"gradio", "streamlit", "docker", "static"}


def map_hf_space(s: dict) -> dict[str, Any]:
    _, _, slug = s["id"].partition("/")
    slug = slug or s["id"]
    card = s.get("cardData") or {}
    sdk = s.get("sdk") if s.get("sdk") in SDKS else "web"
    emoji = card.get("emoji")
    return {
        "slug": s["id"],
        "name": (card.get("title") or pretty_name(slug))[:200],
        "description": card.get("short_description") or "Interactive app on Hugging Face.",
        "sdk": sdk,
        "url": f"{HF}/spaces/{s['id']}",
        "embed_url": f"https://{s['subdomain']}.hf.space" if s.get("subdomain") else None,
        "models": as_list(s.get("models")),
        "emoji": emoji if isinstance(emoji, str) and len(emoji) <= 16 else None,
        "tags": [t for t in (s.get("tags") or []) if ":" not in t and t != sdk][:5],
        "likes": int(s.get("likes") or 0),
        "content_date": _date(s.get("lastModified")),
    }


HF_KINDS: dict[ContentType, tuple[str, Any]] = {
    ContentType.model: ("models", map_hf_model),
    ContentType.dataset: ("datasets", map_hf_dataset),
    ContentType.demo: ("spaces", map_hf_space),
}


# ---------- GitHub / PyPI / npm (Toolkit) ----------


def fetch_library_stats(repo: str | None, pypi: str | None, npm: str | None) -> tuple[dict[str, Any], list[str]]:
    """Live stats for one library: stars, last push, license, latest release. Returns (values, errors)."""
    out: dict[str, Any] = {}
    errors: list[str] = []
    if repo:
        headers = {"Accept": "application/vnd.github+json"}
        if get_settings().github_token:
            headers["Authorization"] = f"Bearer {get_settings().github_token}"
        try:
            r = get_json(f"https://api.github.com/repos/{quote(repo, safe='/')}", headers)
            if r is None:
                errors.append(f"GitHub repo {repo} not found")
            else:
                out["stars"] = int(r.get("stargazers_count") or 0)
                if r.get("pushed_at"):
                    out["content_date"] = _date(r["pushed_at"])
                spdx = (r.get("license") or {}).get("spdx_id")
                if spdx and spdx != "NOASSERTION":
                    out["license"] = spdx.lower()
        except SourceError as e:
            errors.append(str(e))
    try:
        if pypi:
            r = get_json(f"https://pypi.org/pypi/{quote(pypi, safe='')}/json")
            if r is None:
                errors.append(f"PyPI package {pypi} not found")
            elif (r.get("info") or {}).get("version"):
                out["package_version"] = str(r["info"]["version"])[:40]
        elif npm:
            r = get_json(f"https://registry.npmjs.org/{quote(npm, safe='@')}/latest")
            if r is None:
                errors.append(f"npm package {npm} not found")
            elif r.get("version"):
                out["package_version"] = str(r["version"])[:40]
    except SourceError as e:
        errors.append(str(e))
    return out, errors

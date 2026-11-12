"""Turn ORM items into admin JSON, revision snapshots and the public `Hub` shape."""

import enum
import uuid
from datetime import date, datetime
from typing import Any

from pydantic.alias_generators import to_camel

from app.models import ContentItem, ContentType, Model
from app.schemas.content import FIELDS_BY_TYPE
from app.storage import get_storage

# Fields that aren't plain columns on the item
SPECIAL = {"type", "tags", "label_ids", "benchmarks"}


def _json(v: Any) -> Any:
    if isinstance(v, enum.Enum):
        return v.value
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, list):
        return [_json(x) for x in v]
    if isinstance(v, dict):
        return {k: _json(x) for k, x in v.items()}
    return v


def field_names(t: ContentType) -> list[str]:
    return [n for n in FIELDS_BY_TYPE[t].model_fields if n != "type"]


def snapshot(item: ContentItem) -> dict[str, Any]:
    """Every editable field (camelCase, JSON-safe). Stored as a revision and used for diffs."""
    out: dict[str, Any] = {}
    for name in field_names(item.type):
        if name == "tags":
            value = [t.name for t in item.tags]
        elif name == "label_ids":
            value = sorted(str(lb.id) for lb in item.labels)
        elif name == "benchmarks":
            value = [
                {"name": b.name, "score": b.score, "unit": b.unit, "lowerIsBetter": b.lower_is_better}
                for b in item.benchmarks  # type: ignore[attr-defined]
            ]
        else:
            value = getattr(item, name)
        out[to_camel(name)] = _json(value)
    return out


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, list[Any]]:
    return {k: [before.get(k), after.get(k)] for k in after.keys() | before.keys() if before.get(k) != after.get(k)}


def _cover(item: ContentItem) -> dict[str, Any] | None:
    m = item.cover
    if m is None:
        return None
    return {"url": get_storage().url(m.storage_key), "alt": m.alt, "width": m.width, "height": m.height}


def admin_out(item: ContentItem) -> dict[str, Any]:
    return {
        **snapshot(item),
        "cover": _cover(item),
        "id": str(item.id),
        "type": item.type.value,
        "status": item.status.value,
        "version": item.version,
        "source": item.source.value,
        "labels": [
            {"id": str(lb.id), "name": lb.name, "color": lb.color, "description": lb.description}
            for lb in sorted(item.labels, key=lambda lb: lb.name.lower())
        ],
        "editedFields": item.edited_fields or [],
        "hfSyncedAt": _json(item.hf_synced_at),
        "publishedAt": _json(item.published_at),
        "archivedAt": _json(item.archived_at),
        "createdAt": _json(item.created_at),
        "updatedAt": _json(item.updated_at),
    }


# ---------- public ----------


def _clean(d: dict[str, Any]) -> dict[str, Any]:
    """Drop None so optional fields arrive as `undefined`, which is what the web types expect."""
    return {k: v for k, v in d.items() if v is not None}


def _date(item: ContentItem) -> str:
    d = item.content_date or item.updated_at.date()
    return d.isoformat()


def _common(item: ContentItem) -> dict[str, Any]:
    return {
        "id": item.slug,
        "name": item.name,
        "description": item.description,
        "tags": [t.name for t in item.tags],
        "updatedAt": _date(item),
        "badges": list(item.badges or []),
        "featured": item.featured,
        "sortOrder": item.sort_order,
        "cover": _cover(item),
    }


def public_out(item: ContentItem) -> dict[str, Any]:
    t = item.type
    if t is ContentType.model:
        m: Model = item  # type: ignore[assignment]
        body = {
            "author": m.author,
            "task": m.task,
            "kind": m.kind.value,
            "baseModel": m.base_model,
            "datasets": m.datasets or None,
            "params": m.params,
            "license": m.license,
            "library": m.library,
            "downloads": m.downloads,
            "likes": m.likes,
            "benchmarks": [
                _clean({"name": b.name, "score": b.score, "unit": b.unit, "lowerIsBetter": b.lower_is_better or None})
                for b in m.benchmarks
            ]
            or None,
            "capabilities": m.capabilities or None,
            "usage": m.usage,
            "links": m.links or {},
            "source": m.source.value,
        }
    elif t is ContentType.dataset:
        body = {
            "author": item.author,
            "modality": item.modality.value,
            "task": item.task,
            "size": item.size,
            "labels": item.class_labels or None,
            "license": item.license,
            "downloads": item.downloads,
            "likes": item.likes,
            "notes": item.notes,
            "links": item.links or {},
            "source": item.source.value,
        }
    elif t is ContentType.demo:
        body = {
            "sdk": item.sdk.value,
            "url": item.url,
            "embedUrl": item.embed_url,
            "models": item.models or [],
            "emoji": item.emoji,
            "likes": item.likes,
            "source": item.source.value,
        }
    else:
        body = {
            "language": item.language,
            "install": item.install,
            "repo": item.repo,
            "pypi": item.pypi,
            "npm": item.npm,
            "version": item.package_version,
            "stars": item.stars,
            "license": item.license,
            "features": item.features or None,
            "usage": item.usage,
            "usedBy": item.used_by or None,
            "links": item.links or {},
        }
    return _clean({**_common(item), **body})

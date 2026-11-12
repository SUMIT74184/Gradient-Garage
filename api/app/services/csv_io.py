"""CSV export and import, one content type per file.

Format
- One row per item, matched on `slug` (the public id). Unknown slugs create drafts.
- Lists (tags, datasets, features…) are joined with " | ".
- Links get one column each: `links.huggingface`, `links.github`…
- Internal labels are listed by name in `labels`; benchmarks are JSON in `benchmarks`.
- `status`, `source` and `updatedAt` are exported for reference and ignored on import.
- Only the columns present in the file are changed, so a file with just `slug` and
  `description` edits descriptions and nothing else. An empty cell clears that field.

Text cells that start with = + - @ are prefixed with ' on export so spreadsheet apps
don't run them as formulas; the prefix is removed again on import.
"""

import csv
import io
import json
import uuid
from types import UnionType
from typing import Annotated, Any, Union, get_args, get_origin

from pydantic import ValidationError
from pydantic.alias_generators import to_camel, to_snake
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import AppError, Invalid
from app.models import TYPE_CLASS, ContentType, Label, User
from app.schemas.content import FIELDS_BY_TYPE
from app.services import content as svc
from app.services.history import audit
from app.services.serialize import field_names, snapshot
from app.services.taxonomy import slugify

SEP = " | "
MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 2000
READ_ONLY = ["status", "source", "updatedAt"]
SKIP = {"labelIds", "coverMediaId", "sortOrder"}

LINK_KEYS: dict[ContentType, list[str]] = {
    ContentType.model: ["huggingface", "github", "paper", "demo"],
    ContentType.dataset: ["huggingface", "github", "paper"],
    ContentType.demo: [],
    ContentType.library: ["github", "docs", "pypi", "npm"],
}

FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _base_type(ann: Any) -> Any:
    """Strip Optional[...] and Annotated[...] down to the underlying type."""
    while True:
        origin = get_origin(ann)
        if origin is Annotated:
            ann = get_args(ann)[0]
        elif origin in (Union, UnionType):
            args = [a for a in get_args(ann) if a is not type(None)]
            if len(args) != 1:
                return ann
            ann = args[0]
        else:
            return ann


def _kind(t: ContentType, field: str) -> str:
    """How a camelCase field is written in a cell: list | bool | int | json | text."""
    if field == "benchmarks":
        return "json"
    ann = _base_type(FIELDS_BY_TYPE[t].model_fields[to_snake(field)].annotation)
    if get_origin(ann) is list:
        return "list"
    if ann is bool:
        return "bool"
    if ann is int:
        return "int"
    return "text"


def columns(t: ContentType) -> list[str]:
    fields = [to_camel(n) for n in field_names(t)]
    cols = ["slug"] + [f for f in fields if f not in SKIP and f not in ("slug", "links")]
    cols.insert(cols.index("tags") + 1, "labels")
    return cols + [f"links.{k}" for k in LINK_KEYS[t]] + READ_ONLY


def _safe(text: str) -> str:
    return "'" + text if text.startswith(FORMULA_START) else text


def _unsafe(text: str) -> str:
    return text[1:] if text.startswith("'") and text[1:2] in FORMULA_START and text[1:2] else text


# ---------- export ----------


def export_csv(db: Session, t: ContentType) -> str:
    cols = columns(t)
    labels = {str(lb.id): lb.name for lb in db.scalars(select(Label))}
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(cols)
    items, _ = svc.list_items(db, type=t, sort="name", page_size=100_000)
    for item in items:
        snap = snapshot(item)
        row = []
        for col in cols:
            if col.startswith("links."):
                value: Any = (snap.get("links") or {}).get(col[6:], "")
            elif col == "labels":
                value = SEP.join(labels[i] for i in snap["labelIds"] if i in labels)
            elif col == "status":
                value = item.status.value
            elif col == "source":
                value = item.source.value
            elif col == "updatedAt":
                value = item.updated_at.isoformat()
            else:
                value = snap.get(col)
                kind = _kind(t, col)
                if kind == "list":
                    value = SEP.join(value or [])
                elif kind == "json":
                    value = json.dumps(value or [], ensure_ascii=False)
                elif kind == "bool":
                    value = "true" if value else "false"
            text = "" if value is None else str(value)
            row.append(_safe(text) if isinstance(value, str) else text)
        writer.writerow(row)
    # BOM so Excel opens it as UTF-8
    return "﻿" + buf.getvalue()


# ---------- import ----------


TRUE = {"true", "yes", "y", "1"}
FALSE = {"false", "no", "n", "0", ""}


def _parse_cell(t: ContentType, col: str, raw: str, label_ids: dict[str, str]) -> Any:
    text = _unsafe(raw.strip())
    if col == "labels":
        names = [n.strip() for n in text.split("|") if n.strip()]
        unknown = [n for n in names if n.lower() not in label_ids]
        if unknown:
            raise ValueError(f"unknown label(s): {', '.join(unknown)}")
        return [label_ids[n.lower()] for n in names]
    kind = _kind(t, col)
    if kind == "list":
        return [p.strip() for p in text.split("|") if p.strip()]
    if kind == "json":
        if not text:
            return []
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise ValueError("must be JSON, e.g. [{\"name\": \"MMLU\", \"score\": 41.7, \"unit\": \"%\"}]") from e
    if kind == "bool":
        if text.lower() in TRUE:
            return True
        if text.lower() in FALSE:
            return False
        raise ValueError("must be true or false")
    if kind == "int":
        if not text:
            return 0
        try:
            return int(text.replace(",", "").replace("_", ""))
        except ValueError as e:
            raise ValueError("must be a whole number") from e
    info = FIELDS_BY_TYPE[t].model_fields[to_snake(col)]
    optional = not info.is_required() and info.default is None
    return None if (text == "" and optional) else text


def _norm(field: str, value: Any) -> Any:
    """Comparable form, so re-importing an unchanged export reports no changes."""
    if field == "tags":
        return sorted(slugify(v) for v in value or [])
    if field == "labelIds":
        return sorted(value or [])
    if field == "links":
        return {k: v for k, v in (value or {}).items() if v}
    return value


def _decode(data: bytes) -> list[dict[str, str]]:
    if len(data) > MAX_BYTES:
        raise Invalid(f"file is too large (max {MAX_BYTES // 1024 // 1024} MB)")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise Invalid("file must be UTF-8 encoded CSV") from e
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or "slug" not in reader.fieldnames:
        raise Invalid("the first row must be column names and include `slug`")
    rows = list(reader)
    if len(rows) > MAX_ROWS:
        raise Invalid(f"at most {MAX_ROWS} rows per file")
    return rows


def plan_import(db: Session, t: ContentType, data: bytes) -> dict[str, Any]:
    """Parse and validate every row. Nothing is written."""
    rows = _decode(data)
    header = list(rows[0].keys()) if rows else []
    known = set(columns(t))
    unknown = [c for c in header if c and c not in known]
    if unknown:
        raise Invalid(f"unknown column(s) for this section: {', '.join(unknown)}", allowed=columns(t))
    editable = [c for c in header if c and c not in READ_ONLY]

    label_ids = {lb.name.lower(): str(lb.id) for lb in db.scalars(select(Label))}
    existing = {i.slug.lower(): i for i in db.scalars(select(TYPE_CLASS[t]))}
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for n, row in enumerate(rows, start=2):  # row 1 is the header
        entry: dict[str, Any] = {"row": n, "slug": (row.get("slug") or "").strip(), "action": "", "changes": [], "errors": []}
        out.append(entry)
        if not entry["slug"]:
            if not any((v or "").strip() for v in row.values()):
                entry["action"] = "skip"  # blank line
                continue
            entry["errors"].append({"field": "slug", "msg": "required"})
            entry["action"] = "error"
            continue
        key = entry["slug"].lower()
        if key in seen:
            entry["errors"].append({"field": "slug", "msg": "appears more than once in this file"})
        seen.add(key)

        values: dict[str, Any] = {}
        links: dict[str, str] = {}
        for col in editable:
            raw = row.get(col) or ""
            try:
                if col.startswith("links."):
                    links[col[6:]] = _unsafe(raw.strip())
                else:
                    field = "labelIds" if col == "labels" else col
                    values[field] = _parse_cell(t, col, raw, label_ids)
            except ValueError as e:
                entry["errors"].append({"field": col, "msg": str(e)})

        item = existing.get(key)
        current = snapshot(item) if item else {}
        if any(c.startswith("links.") for c in editable):
            # Link columns in the file replace those keys; other link keys are kept
            values["links"] = {**(current.get("links") or {}), **links}
        try:
            merged = FIELDS_BY_TYPE[t].model_validate({**current, **values, "type": t.value})
        except ValidationError as e:
            for err in e.errors(include_url=False, include_context=False):
                loc = [str(p) for p in err.get("loc", [])]
                entry["errors"].append({"field": loc[0] if loc else "", "msg": err.get("msg", "invalid").replace("Value error, ", "")})
            merged = None

        if merged is not None:
            clean = merged.model_dump(mode="json", by_alias=True, exclude={"type"})
            entry["values"] = {k: clean[k] for k in values if k in clean}
            if item is None:
                entry["changes"] = sorted(values)
            else:
                entry["id"] = str(item.id)
                entry["changes"] = sorted(k for k in values if _norm(k, clean.get(k)) != _norm(k, current.get(k)))
        if entry["errors"]:
            entry["action"] = "error"
            entry.pop("values", None)
        elif item is None:
            entry["action"] = "create"
        else:
            entry["action"] = "update" if entry["changes"] else "unchanged"

    summary = {a: sum(1 for e in out if e["action"] == a) for a in ("create", "update", "unchanged", "error", "skip")}
    return {"type": t.value, "columns": editable, "rows": out, "summary": summary}


def commit_import(db: Session, t: ContentType, data: bytes, actor: User, filename: str = "") -> dict[str, Any]:
    plan = plan_import(db, t, data)
    if plan["summary"]["error"]:
        raise Invalid("fix the rows with errors first; nothing was imported", plan=plan)
    for entry in plan["rows"]:
        try:
            if entry["action"] == "create":
                payload = FIELDS_BY_TYPE[t].model_validate({**entry["values"], "type": t.value})
                item = svc.create_item(db, payload, actor, note="Imported from CSV", action="import.create")
                entry["id"] = str(item.id)
            elif entry["action"] == "update":
                item = svc.get_item(db, uuid.UUID(entry["id"]), lock=True)
                patch = {k: entry["values"][k] for k in entry["changes"]}
                svc._update(db, item, patch, actor, note="Imported from CSV", action="import.update")
        except (AppError, ValidationError) as e:
            db.rollback()
            msg = e.message if isinstance(e, AppError) else str(e.errors()[0].get("msg"))
            raise Invalid(f"row {entry['row']} ({entry['slug']}): {msg}; nothing was imported") from e
        entry.pop("values", None)
    s = plan["summary"]
    audit(
        db, actor=actor, action="import.csv", entity_type=t.value,
        entity_label=f"{filename or 'CSV'}: {s['create']} created, {s['update']} updated",
        changes={"created": s["create"], "updated": s["update"], "unchanged": s["unchanged"]},
    )
    for e in plan["rows"]:
        e.pop("values", None)
    return plan


def count_items(db: Session, t: ContentType) -> int:
    return db.scalar(select(func.count()).select_from(TYPE_CLASS[t])) or 0

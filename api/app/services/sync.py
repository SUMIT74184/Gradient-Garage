"""Hugging Face import + override sync, Toolkit stats refresh, and daily stat snapshots.

Rules
- New Hugging Face items are imported as **drafts** (source = huggingface).
- On Hugging Face items, metadata (name, description, task, license…) follows Hugging Face
  until an admin edits a field; edited fields (`edited_fields`) are never overwritten.
- Live stats (downloads, likes, stars, release version, last-updated date) always refresh,
  on local items too. They're written silently: no new version, revision or "edited" time,
  so open editors don't get stale-version conflicts and the activity log stays readable.
- Items that disappeared from Hugging Face are reported as missing, never deleted.
"""

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from pydantic import ValidationError
from pydantic.alias_generators import to_camel
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, with_polymorphic

from app.config import get_settings
from app.errors import AppError, Conflict
from app.models import TYPE_CLASS, ContentItem, ContentType, Library, SiteContent, Source, StatSnapshot, SyncRun, User
from app.schemas.content import FIELDS_BY_TYPE
from app.schemas.site import SyncSettings
from app.services import content as content_svc
from app.services import sources
from app.services.history import audit
from app.services.serialize import diff, snapshot

log = logging.getLogger(__name__)

# pg_advisory_xact_lock key so two sync runs never start at once
LOCK_KEY = 0x6767_5359
# A "running" row older than this is treated as a crashed run
STALE_AFTER = timedelta(minutes=15)

TYPE_ENABLED = {
    ContentType.model: "import_models",
    ContentType.dataset: "import_datasets",
    ContentType.demo: "import_demos",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def get_settings_doc(db: Session) -> tuple[SyncSettings, bool]:
    """Saved sync settings, or defaults (HF_USERNAME from the environment). Second value: saved?"""
    row = db.get(SiteContent, "sync")
    if row is not None:
        return SyncSettings.model_validate(row.value), True
    authors = [a.strip() for a in get_settings().hf_username.split(",") if a.strip()]
    return SyncSettings(hf_authors=authors), False


def latest_runs(db: Session, limit: int = 10) -> list[SyncRun]:
    return list(db.scalars(select(SyncRun).order_by(SyncRun.started_at.desc()).limit(limit)))


def _start(db: Session, actor: User, trigger: str) -> SyncRun:
    db.execute(select(func.pg_advisory_xact_lock(LOCK_KEY)))
    for running in db.scalars(select(SyncRun).where(SyncRun.status == "running")):
        if running.started_at > _now() - STALE_AFTER:
            raise Conflict("a sync is already running; wait for it to finish", runId=str(running.id))
        running.status, running.error, running.finished_at = "failed", "Interrupted (no result after 15 minutes)", _now()
    run = SyncRun(status="running", trigger=trigger, actor_id=actor.id, actor_email=actor.email, report={})
    db.add(run)
    db.commit()
    return run


def run_sync(db: Session, actor: User, *, trigger: str = "manual") -> SyncRun:
    """Run the whole sync. Raises Conflict if one is already running; otherwise always returns the run row."""
    run = _start(db, actor, trigger)
    run_id = run.id
    try:
        cfg, _ = get_settings_doc(db)
        report = _sync(db, actor, cfg)
        run = db.get(SyncRun, run_id)
        run.status, run.report = "succeeded", report
        audit(
            db, actor=actor, action="sync.run", entity_type="sync", entity_id=str(run_id),
            entity_label=f"{len(report['created'])} imported, {len(report['updated'])} updated, {report['refreshed']} refreshed",
            changes={k: report[k] if isinstance(report[k], int) else len(report[k]) for k in ("created", "updated", "refreshed", "missing", "errors")},
        )
    except Exception as e:  # recorded on the run row; the admin sees it in the sync screen
        log.exception("sync failed")
        db.rollback()
        run = db.get(SyncRun, run_id)
        run.status, run.error = "failed", (str(e) or type(e).__name__)[:1000]
    run.finished_at = _now()
    db.commit()
    return run


# ---------- the job ----------


def _ref(item: ContentItem) -> dict[str, str]:
    return {"id": str(item.id), "type": item.type.value, "slug": item.slug, "name": item.name}


def _sync(db: Session, actor: User, cfg: SyncSettings) -> dict[str, Any]:
    report: dict[str, Any] = {
        "authors": cfg.hf_authors,
        "created": [],
        "updated": [],
        "refreshed": 0,
        "unchanged": 0,
        "missing": [],
        "errors": [],
        "libraries": 0,
    }

    # 1. Fetch everything first, so the database transaction stays short
    fetched: dict[ContentType, dict[str, dict[str, Any]]] = {}
    complete: set[ContentType] = set()  # every author fetched without error → safe to report "missing"
    for t, (kind, mapper) in sources.HF_KINDS.items():
        if not getattr(cfg, TYPE_ENABLED[t]) or not cfg.hf_authors:
            continue
        fetched[t] = {}
        ok = True
        for author in cfg.hf_authors:
            try:
                rows = sources.fetch_hf(kind, author)
            except sources.SourceError as e:
                report["errors"].append(f"Hugging Face {kind} for {author}: {e}")
                ok = False
                continue
            for raw in rows:
                try:
                    values = mapper(raw)
                except Exception:  # one odd item shouldn't stop the run
                    report["errors"].append(f"Couldn't read {kind[:-1]} {raw.get('id')}")
                    continue
                fetched[t][values["slug"].lower()] = values
        if ok:
            complete.add(t)

    lib_stats: dict[uuid.UUID, dict[str, Any]] = {}
    if cfg.refresh_libraries:
        for lib in db.scalars(select(Library).where((Library.repo.is_not(None)) | (Library.pypi.is_not(None)) | (Library.npm.is_not(None)))):
            values, errors = sources.fetch_library_stats(lib.repo, lib.pypi, lib.npm)
            report["errors"] += [f"{lib.name}: {msg}" for msg in errors]
            if values:
                lib_stats[lib.id] = values

    # 2. Apply
    authors = {a.lower() for a in cfg.hf_authors}
    for t, remote in fetched.items():
        existing = {i.slug.lower(): i for i in db.scalars(select(TYPE_CLASS[t]))}
        for key, values in remote.items():
            item = existing.get(key)
            try:
                with db.begin_nested():
                    if item is None:
                        report["created"].append(_ref(_import(db, t, values, actor)))
                    else:
                        outcome = _refresh(db, item, values, actor)
                        if outcome is True:
                            report["refreshed"] += 1
                        elif outcome:
                            report["updated"].append({**_ref(item), "fields": outcome})
                        else:
                            report["unchanged"] += 1
            except (AppError, SQLAlchemyError, ValidationError, ValueError) as e:
                report["errors"].append(f"{values['slug']}: {_reason(e)}")
        if t in complete:
            for key, item in existing.items():
                if item.source is Source.huggingface and key not in remote and key.split("/")[0] in authors:
                    report["missing"].append(_ref(item))

    for lib_id, values in lib_stats.items():
        lib = db.get(Library, lib_id)
        if lib is None:
            continue
        # GitHub's license only fills an empty one; an admin-set license always wins
        license_ = values.pop("license", None)
        if license_ and lib.license in ("", "unknown"):
            values["license_fill"] = license_
        if _write_stats(db, lib, values):
            report["libraries"] += 1

    # 3. Today's numbers for the overview chart
    record_snapshots(db)
    return report


def _reason(e: Exception) -> str:
    if isinstance(e, AppError):
        errs = e.extra.get("errors")
        if isinstance(errs, list) and errs:
            first = errs[0]
            return f"{e.message}: {'.'.join(str(p) for p in first.get('loc', []))} {first.get('msg', '')}".strip()
        return e.message
    if isinstance(e, ValidationError):
        return str(e.errors()[0].get("msg", "invalid value"))
    return type(e).__name__


def _import(db: Session, t: ContentType, values: dict[str, Any], actor: User) -> ContentItem:
    payload = FIELDS_BY_TYPE[t].model_validate({**{to_camel(k): v for k, v in values.items()}, "type": t.value})
    item = content_svc.create_item(
        db, payload, actor, source=Source.huggingface, note="Imported from Hugging Face", action="sync.import"
    )
    item.hf_synced_at = _now()
    return item


def _refresh(db: Session, item: ContentItem, values: dict[str, Any], actor: User) -> list[str] | bool:
    """Returns the metadata fields changed (list), True if only stats changed, False if nothing changed."""
    stats = sources.STAT_FIELDS[item.type]
    edited = set(item.edited_fields or [])
    changed_fields: list[str] = []

    if item.source is Source.huggingface:
        patch = {to_camel(k): v for k, v in values.items() if k not in stats and k != "slug" and k not in edited}
        if patch:
            before = snapshot(item)
            content_svc._update(
                db, item, patch, actor, note="Hugging Face sync", action="sync.update", mark_edited=False
            )
            changed_fields = sorted(diff(before, snapshot(item)))

    stat_values = {k: v for k, v in values.items() if k in stats and k not in edited}
    stats_changed = _write_stats(db, item, stat_values)
    if changed_fields:
        return changed_fields
    return stats_changed


def _write_stats(db: Session, item: ContentItem, values: dict[str, Any]) -> bool:
    """Silent write: no version bump, no revision, and `updated_at` stays put."""
    db.flush()  # pending ORM changes (e.g. a metadata update just before) must land before we expire
    base_cols: dict[str, Any] = {}
    child_cols: dict[str, Any] = {}
    child = TYPE_CLASS[item.type].__table__
    for key, value in values.items():
        if value is None:
            continue
        if key == "content_date":
            value = date.fromisoformat(value) if isinstance(value, str) else value
            if item.content_date != value:
                base_cols["content_date"] = value
        elif key == "license_fill":
            child_cols["license"] = value
        elif key in child.c and getattr(item, key) != value:
            child_cols[key] = value
    changed = bool(base_cols or child_cols)

    base = ContentItem.__table__
    # Always stamp the sync time; pinning updated_at to itself stops the onupdate trigger
    db.execute(
        update(base).where(base.c.id == item.id).values(**base_cols, hf_synced_at=_now(), updated_at=base.c.updated_at)
    )
    if child_cols:
        db.execute(update(child).where(child.c.id == item.id).values(**child_cols))
    db.expire(item)
    return changed


def record_snapshots(db: Session, day: date | None = None) -> int:
    """Upsert today's downloads / likes / stars for every item."""
    day = day or _now().date()
    poly = with_polymorphic(ContentItem, "*")
    rows = []
    for item in db.scalars(select(poly)):
        rows.append(
            {
                "content_id": item.id,
                "day": day,
                "downloads": int(getattr(item, "downloads", 0) or 0),
                "likes": int(getattr(item, "likes", 0) or 0),
                "stars": int(getattr(item, "stars", 0) or 0),
            }
        )
    if not rows:
        return 0
    stmt = insert(StatSnapshot).values(rows)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_stat_snapshots_content_day",
        set_={"downloads": stmt.excluded.downloads, "likes": stmt.excluded.likes, "stars": stmt.excluded.stars},
    )
    db.execute(stmt)
    return len(rows)

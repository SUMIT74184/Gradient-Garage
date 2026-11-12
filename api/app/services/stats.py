"""Numbers for the admin overview: totals, a downloads-over-time series, top movers and to-dos."""

from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, with_polymorphic

from app.models import ContentItem, ContentType, Source, StatSnapshot, Status, SyncRun


def _today() -> date:
    return datetime.now(timezone.utc).date()


def overview(db: Session, days: int = 30) -> dict[str, Any]:
    days = max(7, min(days, 365))
    end = _today()
    start = end - timedelta(days=days - 1)

    poly = with_polymorphic(ContentItem, "*")
    items = list(db.scalars(select(poly)))
    published = [i for i in items if i.status is Status.published]

    totals = {
        t.value: {
            "published": sum(1 for i in published if i.type is t),
            "downloads": sum(int(getattr(i, "downloads", 0) or 0) for i in published if i.type is t),
            "likes": sum(int(getattr(i, "likes", 0) or 0) for i in published if i.type is t),
            "stars": sum(int(getattr(i, "stars", 0) or 0) for i in published if i.type is t),
        }
        for t in ContentType
    }

    # Daily totals for published items. Each item carries its last known value forward
    # over days without a snapshot (sync didn't run, or it was added later).
    ids = [i.id for i in published]
    snaps_by_item: dict[Any, list[StatSnapshot]] = {}
    if ids:
        # The last snapshot before the window seeds the carry-forward
        before = (
            select(StatSnapshot.content_id, func.max(StatSnapshot.day).label("day"))
            .where(StatSnapshot.content_id.in_(ids), StatSnapshot.day < start)
            .group_by(StatSnapshot.content_id)
            .subquery()
        )
        seed = db.scalars(
            select(StatSnapshot).join(before, (before.c.content_id == StatSnapshot.content_id) & (before.c.day == StatSnapshot.day))
        )
        window = db.scalars(
            select(StatSnapshot).where(StatSnapshot.content_id.in_(ids), StatSnapshot.day >= start, StatSnapshot.day <= end)
        )
        for s in [*seed, *window]:
            snaps_by_item.setdefault(s.content_id, []).append(s)
    for snaps in snaps_by_item.values():
        snaps.sort(key=lambda s: s.day)

    have_data = bool(snaps_by_item)
    series = []
    for n in range(days):
        day = start + timedelta(days=n)
        row = {"downloads": 0, "likes": 0, "stars": 0}
        for snaps in snaps_by_item.values():
            last = None
            for s in snaps:
                if s.day <= day:
                    last = s
                else:
                    break
            if last is not None:
                row["downloads"] += last.downloads
                row["likes"] += last.likes
                row["stars"] += last.stars
        series.append({"date": day.isoformat(), **row})

    # Biggest download gains over the window (models + datasets)
    def first_in_window(item_id) -> int | None:
        snaps = snaps_by_item.get(item_id) or []
        valid = [s for s in snaps if s.day <= start] or snaps[:1]
        return valid[-1].downloads if valid else None

    movers = []
    for i in published:
        if i.type not in (ContentType.model, ContentType.dataset):
            continue
        now = int(getattr(i, "downloads", 0) or 0)
        first = first_in_window(i.id)
        movers.append(
            {
                "id": str(i.id),
                "type": i.type.value,
                "name": i.name,
                "slug": i.slug,
                "downloads": now,
                "gain": (now - first) if first is not None else None,
            }
        )
    top = sorted(movers, key=lambda m: m["downloads"], reverse=True)[:5]
    rising = sorted((m for m in movers if m["gain"]), key=lambda m: m["gain"], reverse=True)[:5]

    drafts = sorted((i for i in items if i.status is Status.draft), key=lambda i: i.updated_at, reverse=True)
    attention = {
        "drafts": len(drafts),
        "hfImports": sum(1 for i in drafts if i.source is Source.huggingface and i.version == 1),
        "noDescription": sum(1 for i in published if not (i.description or "").strip()),
        "recentDrafts": [
            {"id": str(i.id), "type": i.type.value, "name": i.name, "source": i.source.value, "updatedAt": i.updated_at.isoformat()}
            for i in drafts[:6]
        ],
    }

    last = db.scalar(select(SyncRun).order_by(SyncRun.started_at.desc()).limit(1))
    return {
        "days": days,
        "totals": totals,
        "series": series,
        "hasHistory": have_data,
        "top": top,
        "rising": rising,
        "attention": attention,
        "lastSync": None
        if last is None
        else {
            "status": last.status,
            "startedAt": last.started_at.isoformat(),
            "finishedAt": last.finished_at.isoformat() if last.finished_at else None,
        },
    }

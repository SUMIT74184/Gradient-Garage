import uuid
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select

from app.deps import Db, Editor
from app.models import AuditLog
from app.schemas.taxonomy import (
    AuditList,
    LabelIn,
    LabelOutWithCount,
    LabelPatch,
    TagIn,
    TagMergeIn,
    TagOut,
)
from app.services import taxonomy as svc

router = APIRouter(tags=["admin: tags, labels, activity"])


@router.get("/tags", response_model=list[TagOut])
def list_tags(db: Db):
    return svc.list_tags(db)


@router.post("/tags", response_model=TagOut, status_code=status.HTTP_201_CREATED)
def create_tag(db: Db, actor: Editor, payload: TagIn):
    tag = svc.create_tag(db, payload.name, actor)
    db.commit()
    return {"id": tag.id, "name": tag.name, "slug": tag.slug}


@router.patch("/tags/{tag_id}", response_model=TagOut)
def rename_tag(db: Db, actor: Editor, tag_id: uuid.UUID, payload: TagIn):
    tag = svc.rename_tag(db, tag_id, payload.name, actor)
    db.commit()
    return {"id": tag.id, "name": tag.name, "slug": tag.slug}


@router.post("/tags/{tag_id}/merge", response_model=TagOut)
def merge_tag(db: Db, actor: Editor, tag_id: uuid.UUID, payload: TagMergeIn):
    tag = svc.merge_tag(db, tag_id, payload.into_id, actor)
    db.commit()
    return {"id": tag.id, "name": tag.name, "slug": tag.slug}


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(db: Db, actor: Editor, tag_id: uuid.UUID) -> None:
    svc.delete_tag(db, tag_id, actor)
    db.commit()


@router.get("/labels", response_model=list[LabelOutWithCount])
def list_labels(db: Db):
    return svc.list_labels(db)


@router.post("/labels", response_model=LabelOutWithCount, status_code=status.HTTP_201_CREATED)
def create_label(db: Db, actor: Editor, payload: LabelIn):
    lb = svc.create_label(db, payload.model_dump(), actor)
    db.commit()
    return lb


@router.patch("/labels/{label_id}", response_model=LabelOutWithCount)
def update_label(db: Db, actor: Editor, label_id: uuid.UUID, payload: LabelPatch):
    lb = svc.update_label(db, label_id, payload.model_dump(exclude_unset=True, exclude_none=True), actor)
    db.commit()
    return lb


@router.delete("/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_label(db: Db, actor: Editor, label_id: uuid.UUID) -> None:
    svc.delete_label(db, label_id, actor)
    db.commit()


@router.get("/audit/facets")
def audit_facets(db: Db) -> dict[str, list[str]]:
    """Distinct actions, entity types and people in the log, for the activity filters."""
    def distinct(col):
        return [v for v in db.scalars(select(col).distinct().order_by(col)) if v]

    return {
        "actions": distinct(AuditLog.action),
        "entityTypes": distinct(AuditLog.entity_type),
        "actors": distinct(AuditLog.actor_email),
    }


@router.get("/audit", response_model=AuditList)
def list_audit(
    db: Db,
    entity_type: str | None = None,
    entity_id: str | None = None,
    action: str | None = None,
    actor: str | None = Query(None, description="actor email"),
    q: str | None = Query(None, description="search the item name"),
    since: date | None = Query(None, description="on or after this day (UTC)"),
    until: date | None = Query(None, description="on or before this day (UTC)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    stmt = select(AuditLog)
    if q:
        stmt = stmt.where(AuditLog.entity_label.ilike(f"%{q.strip()}%"))
    if since:
        stmt = stmt.where(AuditLog.created_at >= datetime.combine(since, time.min, tzinfo=timezone.utc))
    if until:
        stmt = stmt.where(AuditLog.created_at < datetime.combine(until + timedelta(days=1), time.min, tzinfo=timezone.utc))
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if actor:
        stmt = stmt.where(AuditLog.actor_email == actor.lower())
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(AuditLog.id.desc()).limit(page_size).offset((page - 1) * page_size))
    return {"items": list(rows), "total": total, "page": page, "pageSize": page_size}

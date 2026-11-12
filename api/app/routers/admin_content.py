import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Body, Query, status
from pydantic import ValidationError
from pydantic.alias_generators import to_camel
from sqlalchemy import func, select

from app.deps import Db, Editor, Owner
from app.errors import Invalid
from app.models import ContentItem, ContentType, Source, Status
from app.schemas.content import (
    PATCH_BY_TYPE,
    ContentCreate,
    ItemList,
    OrderIn,
    RevisionOut,
    TransitionIn,
)
from app.services import content as svc
from app.services.serialize import admin_out

router = APIRouter(prefix="/content", tags=["admin: content"])


@router.get("", response_model=ItemList)
def list_content(
    db: Db,
    type: ContentType | None = None,
    status: Annotated[list[Status] | None, Query()] = None,
    q: str | None = None,
    tag: str | None = Query(None, description="tag slug"),
    label: uuid.UUID | None = None,
    badge: str | None = None,
    featured: bool | None = None,
    source: Source | None = None,
    sort: str = Query("-updated", description="updated | created | name | date (prefix - for desc) | order"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    items, total = svc.list_items(
        db, type=type, status=status, q=q, tag=tag, label=label, badge=badge,
        featured=featured, source=source, sort=sort, page=page, page_size=page_size,
    )
    return {"items": [admin_out(i) for i in items], "total": total, "page": page, "pageSize": page_size}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_content(db: Db, actor: Editor, payload: Annotated[ContentCreate, Body()]) -> dict[str, Any]:
    item = svc.create_item(db, payload, actor)
    db.commit()
    return admin_out(item)


@router.get("/summary")
def summary(db: Db) -> dict[str, Any]:
    """Item counts per type and status, for the admin overview."""
    rows = db.execute(
        select(ContentItem.type, ContentItem.status, func.count()).group_by(ContentItem.type, ContentItem.status)
    )
    counts: dict[str, dict[str, int]] = {t.value: {s.value: 0 for s in Status} for t in ContentType}
    for t, s, n in rows:
        counts[t.value][s.value] = n
    return {"counts": counts}


@router.put("/order", status_code=status.HTTP_204_NO_CONTENT)
def set_order(db: Db, actor: Editor, payload: OrderIn) -> None:
    svc.set_order(db, payload.type, payload.ids, actor)
    db.commit()


@router.get("/{item_id}")
def get_content(db: Db, item_id: uuid.UUID) -> dict[str, Any]:
    return admin_out(svc.get_item(db, item_id))


@router.patch("/{item_id}")
def update_content(db: Db, actor: Editor, item_id: uuid.UUID, body: Annotated[dict[str, Any], Body()]) -> dict[str, Any]:
    """Send only the fields you change, plus the `version` you loaded (409 if it's stale).

    The accepted fields depend on the item's type; see the `*Patch` schemas.
    """
    item = svc.get_item(db, item_id)
    try:
        patch = PATCH_BY_TYPE[item.type].model_validate(body)
    except ValidationError as e:
        raise Invalid("validation failed", errors=e.errors(include_url=False, include_context=False)) from e
    changes = {to_camel(k): v for k, v in patch.model_dump(mode="json", exclude_unset=True).items()}
    changes.pop("version", None)
    note = changes.pop("note", None) or ""
    item = svc.update_item(db, item_id, changes, patch.version, actor, note)
    db.commit()
    return admin_out(item)


class OverridesResetIn(TransitionIn):
    fields: list[str]


@router.post("/{item_id}/overrides/reset")
def reset_overrides(db: Db, actor: Editor, item_id: uuid.UUID, payload: OverridesResetIn) -> dict[str, Any]:
    """Hand edited fields back to the Hugging Face sync (they take the remote value on the next run)."""
    item = svc.reset_overrides(db, item_id, payload.fields, payload.version, actor)
    db.commit()
    return admin_out(item)


@router.post("/{item_id}/{action}")
def transition_content(
    db: Db,
    actor: Editor,
    item_id: uuid.UUID,
    action: Literal["publish", "unpublish", "archive", "restore"],
    payload: TransitionIn,
) -> dict[str, Any]:
    item = svc.transition(db, item_id, action, payload.version, actor)
    db.commit()
    return admin_out(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_content(db: Db, actor: Owner, item_id: uuid.UUID) -> None:
    svc.delete_item(db, item_id, actor)
    db.commit()


@router.get("/{item_id}/revisions", response_model=list[RevisionOut])
def list_revisions(db: Db, item_id: uuid.UUID):
    return [
        {"id": r.id, "version": r.version, "note": r.note, "createdAt": r.created_at, "createdBy": email}
        for r, email in svc.list_revisions(db, item_id)
    ]


@router.get("/{item_id}/revisions/{rev_version}", response_model=RevisionOut)
def get_revision(db: Db, item_id: uuid.UUID, rev_version: int):
    r = svc.get_revision(db, item_id, rev_version)
    return {"id": r.id, "version": r.version, "note": r.note, "createdAt": r.created_at, "createdBy": None, "snapshot": r.snapshot}


@router.post("/{item_id}/revisions/{rev_version}/restore")
def restore_revision(db: Db, actor: Editor, item_id: uuid.UUID, rev_version: int, payload: TransitionIn) -> dict[str, Any]:
    item = svc.restore_revision(db, item_id, rev_version, payload.version, actor)
    db.commit()
    return admin_out(item)

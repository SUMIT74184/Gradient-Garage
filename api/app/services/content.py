"""Create, edit, lifecycle (draft → published → archived), ordering and revisions for content items."""

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError
from pydantic.alias_generators import to_snake
from sqlalchemy import Select, func, nulls_last, or_, select
from sqlalchemy.orm import Session, with_polymorphic

from app.errors import Conflict, Forbidden, Invalid, NotFound
from app.models import (
    TYPE_CLASS,
    Benchmark,
    ContentItem,
    ContentType,
    Label,
    Media,
    Revision,
    Role,
    Source,
    Status,
    Tag,
    User,
)
from app.schemas.content import FIELDS_BY_TYPE, CommonFields
from app.services.history import audit, record_revision
from app.services.serialize import diff, snapshot
from app.services.taxonomy import resolve_labels, resolve_tags

ENTITY = "content"

# action → (allowed from, goes to)
TRANSITIONS: dict[str, tuple[set[Status], Status]] = {
    "publish": ({Status.draft}, Status.published),
    "unpublish": ({Status.published}, Status.draft),
    "archive": ({Status.draft, Status.published}, Status.archived),
    "restore": ({Status.archived}, Status.draft),
}

SORTS = {
    "updated": ContentItem.updated_at,
    "created": ContentItem.created_at,
    "name": func.lower(ContentItem.name),
    "date": ContentItem.content_date,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- reads ----------


def get_item(db: Session, item_id: uuid.UUID, *, lock: bool = False) -> ContentItem:
    item = db.get(ContentItem, item_id, with_for_update=lock)
    if item is None:
        raise NotFound("item not found")
    return item


def list_items(
    db: Session,
    *,
    type: ContentType | None = None,
    status: list[Status] | None = None,
    q: str | None = None,
    tag: str | None = None,
    label: uuid.UUID | None = None,
    badge: str | None = None,
    featured: bool | None = None,
    source: Source | None = None,
    sort: str = "-updated",
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[ContentItem], int]:
    poly = with_polymorphic(ContentItem, "*")
    stmt: Select = select(poly)
    if type:
        stmt = stmt.where(poly.type == type)
    if status:
        stmt = stmt.where(poly.status.in_(status))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(poly.name.ilike(like), poly.slug.ilike(like), poly.description.ilike(like)))
    if tag:
        stmt = stmt.where(poly.tags.any(Tag.slug == tag))
    if label:
        stmt = stmt.where(poly.labels.any(Label.id == label))
    if badge:
        stmt = stmt.where(poly.badges.contains([badge]))
    if featured is not None:
        stmt = stmt.where(poly.featured.is_(featured))
    if source:
        stmt = stmt.where(poly.source == source)

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0

    if sort == "order":
        order = [poly.featured.desc(), nulls_last(poly.sort_order.asc()), func.lower(poly.name)]
    else:
        key = sort.lstrip("-")
        if key not in SORTS:
            raise Invalid(f"unknown sort '{sort}'", allowed=sorted(SORTS) + ["order"])
        col = getattr(poly, SORTS[key].key) if key != "name" else func.lower(poly.name)
        order = [nulls_last(col.desc() if sort.startswith("-") else col.asc()), poly.id]
    items = list(db.scalars(stmt.order_by(*order).limit(page_size).offset((page - 1) * page_size)))
    return items, total


def published_items(db: Session) -> list[ContentItem]:
    poly = with_polymorphic(ContentItem, "*")
    stmt = (
        select(poly)
        .where(poly.status == Status.published)
        .order_by(
            poly.featured.desc(),
            nulls_last(poly.sort_order.asc()),
            nulls_last(poly.content_date.desc()),
            func.lower(poly.name),
        )
    )
    return list(db.scalars(stmt))


# ---------- writes ----------


def _validate(t: ContentType, data: dict[str, Any]) -> CommonFields:
    try:
        return FIELDS_BY_TYPE[t].model_validate({**data, "type": t.value})
    except ValidationError as e:
        raise Invalid("validation failed", errors=e.errors(include_url=False, include_context=False)) from e


def _check_slug(db: Session, t: ContentType, slug: str, exclude: uuid.UUID | None = None) -> None:
    stmt = select(ContentItem.id).where(ContentItem.type == t, func.lower(ContentItem.slug) == slug.lower())
    if exclude:
        stmt = stmt.where(ContentItem.id != exclude)
    if db.scalar(stmt):
        raise Conflict(f"a {t.value} with id '{slug}' already exists")


def _apply(db: Session, item: ContentItem, values: dict[str, Any], keys: set[str]) -> None:
    """Copy validated field values (snake_case) for `keys` onto the item."""
    for key in keys:
        value = values[key]
        if key == "tags":
            item.tags = resolve_tags(db, value)
        elif key == "label_ids":
            item.labels = resolve_labels(db, value)
        elif key == "benchmarks":
            item.benchmarks = [Benchmark(**b, position=i) for i, b in enumerate(value)]  # type: ignore[attr-defined]
        elif key == "cover_media_id":
            if value is not None and db.get(Media, value) is None:
                raise Invalid("cover image not found", errors=[{"loc": ["coverMediaId"], "msg": "Image not found"}])
            item.cover_media_id = value
            item.cover = db.get(Media, value) if value else None
        elif key == "badges":
            item.badges = [getattr(b, "value", b) for b in value]
        else:
            setattr(item, key, value)


def _check_version(item: ContentItem, version: int) -> None:
    if version != item.version:
        raise Conflict(
            "this item was changed by someone else; reload and try again",
            currentVersion=item.version,
        )


def create_item(
    db: Session,
    payload: CommonFields,
    actor: User,
    *,
    source: Source = Source.local,
    note: str = "Created",
    action: str = "create",
) -> ContentItem:
    t = ContentType(payload.type)  # type: ignore[attr-defined]
    _check_slug(db, t, payload.slug)
    item = TYPE_CLASS[t](
        type=t,
        status=Status.draft,
        source=source,
        version=1,
        created_by_id=actor.id,
        updated_by_id=actor.id,
        edited_fields=[],
    )
    values = payload.model_dump(exclude={"type"})
    _apply(db, item, values, set(values))
    db.add(item)
    db.flush()
    db.refresh(item)
    snap = snapshot(item)
    record_revision(db, entity_type=ENTITY, entity_id=str(item.id), version=1, snapshot=snap, actor=actor, note=note)
    audit(db, actor=actor, action=action, entity_type=t.value, entity_id=str(item.id), entity_label=item.name)
    return item


def _update(
    db: Session,
    item: ContentItem,
    changes_camel: dict[str, Any],
    actor: User,
    note: str = "",
    *,
    action: str = "update",
    mark_edited: bool = True,
) -> ContentItem:
    """Apply a camelCase patch: validate, write, bump version, record a revision and an audit entry.

    `mark_edited=False` is for the sync job: its changes don't count as admin overrides.
    """
    before = snapshot(item)
    validated = _validate(item.type, {**before, **changes_camel})
    values = validated.model_dump(exclude={"type"})
    keys = {to_snake(k) for k in changes_camel} & set(values)
    if "slug" in keys:
        _check_slug(db, item.type, values["slug"], exclude=item.id)

    _apply(db, item, values, keys)
    db.flush()
    db.expire(item, ["tags", "labels"])
    after = snapshot(item)
    changes = diff(before, after)
    if not changes:
        return item

    item.version += 1
    item.updated_by_id = actor.id
    item.updated_at = _now()
    if mark_edited and item.source is Source.huggingface:
        item.edited_fields = sorted(set(item.edited_fields or []) | {to_snake(k) for k in changes})
    record_revision(
        db, entity_type=ENTITY, entity_id=str(item.id), version=item.version, snapshot=after, actor=actor, note=note
    )
    audit(
        db, actor=actor, action=action, entity_type=item.type.value, entity_id=str(item.id),
        entity_label=item.name, changes=changes,
    )
    return item


def update_item(db: Session, item_id: uuid.UUID, patch: dict[str, Any], version: int, actor: User, note: str = "") -> ContentItem:
    """`patch` is camelCase, only the fields the client sent."""
    item = get_item(db, item_id, lock=True)
    _check_version(item, version)
    return _update(db, item, patch, actor, note or "")


def transition(db: Session, item_id: uuid.UUID, action: str, version: int, actor: User) -> ContentItem:
    allowed, target = TRANSITIONS[action]
    item = get_item(db, item_id, lock=True)
    _check_version(item, version)
    if item.status not in allowed:
        raise Conflict(f"cannot {action} an item that is {item.status.value}")
    before = item.status
    item.status = target
    if action == "publish":
        item.published_at = _now()
    elif action == "archive":
        item.archived_at = _now()
    elif action == "restore":
        item.archived_at = None
    item.version += 1
    item.updated_by_id = actor.id
    item.updated_at = _now()
    audit(
        db, actor=actor, action=action, entity_type=item.type.value, entity_id=str(item.id),
        entity_label=item.name, changes={"status": [before.value, target.value]},
    )
    return item


def delete_item(db: Session, item_id: uuid.UUID, actor: User) -> None:
    if actor.role is not Role.owner:
        raise Forbidden("only an Owner can permanently delete")
    item = get_item(db, item_id, lock=True)
    if item.status is not Status.archived:
        raise Conflict("archive the item before deleting it permanently")
    audit(
        db, actor=actor, action="delete", entity_type=item.type.value, entity_id=str(item.id),
        entity_label=item.name, changes={"snapshot": snapshot(item)},
    )
    db.delete(item)


def reset_overrides(db: Session, item_id: uuid.UUID, fields: list[str], version: int, actor: User) -> ContentItem:
    """Hand fields back to the Hugging Face sync: they get the remote value on the next sync run."""
    item = get_item(db, item_id, lock=True)
    _check_version(item, version)
    if item.source is not Source.huggingface:
        raise Conflict("only Hugging Face items have synced fields")
    wanted = {to_snake(f) for f in fields}
    current = set(item.edited_fields or [])
    released = sorted(current & wanted)
    if not released:
        return item
    item.edited_fields = sorted(current - wanted)
    item.version += 1
    item.updated_by_id = actor.id
    item.updated_at = _now()
    audit(
        db, actor=actor, action="sync.release", entity_type=item.type.value, entity_id=str(item.id),
        entity_label=item.name, changes={"editedFields": [sorted(current), item.edited_fields]},
    )
    return item


# ---------- revisions ----------


def list_revisions(db: Session, item_id: uuid.UUID) -> list[tuple[Revision, str | None]]:
    get_item(db, item_id)
    rows = db.execute(
        select(Revision, User.email)
        .outerjoin(User, User.id == Revision.created_by_id)
        .where(Revision.entity_type == ENTITY, Revision.entity_id == str(item_id))
        .order_by(Revision.version.desc())
    )
    return [(r, email) for r, email in rows]


def get_revision(db: Session, item_id: uuid.UUID, rev_version: int) -> Revision:
    rev = db.scalar(
        select(Revision).where(
            Revision.entity_type == ENTITY, Revision.entity_id == str(item_id), Revision.version == rev_version
        )
    )
    if rev is None:
        raise NotFound(f"revision {rev_version} not found")
    return rev


def restore_revision(db: Session, item_id: uuid.UUID, rev_version: int, version: int, actor: User) -> ContentItem:
    item = get_item(db, item_id, lock=True)
    _check_version(item, version)
    rev = get_revision(db, item_id, rev_version)
    snap = dict(rev.snapshot)
    # Labels deleted since that revision can't come back
    existing = {str(i) for i in db.scalars(select(Label.id).where(Label.id.in_(snap.get("labelIds") or [])))}
    snap["labelIds"] = [i for i in snap.get("labelIds") or [] if i in existing]
    if snap.get("coverMediaId") and db.get(Media, uuid.UUID(snap["coverMediaId"])) is None:
        snap["coverMediaId"] = None
    return _update(db, item, snap, actor, note=f"Restored from v{rev_version}")


# ---------- ordering ----------


def set_order(db: Session, t: ContentType, ids: list[uuid.UUID], actor: User) -> None:
    """Pin `ids` in this order at the top of their section; every other item of the type is unpinned."""
    if len(set(ids)) != len(ids):
        raise Invalid("duplicate ids")
    items = {i.id: i for i in db.scalars(select(ContentItem).where(ContentItem.type == t))}
    missing = [str(i) for i in ids if i not in items]
    if missing:
        raise Invalid(f"ids are not {t.value} items", ids=missing)
    position = {item_id: n for n, item_id in enumerate(ids)}
    for item in items.values():
        item.sort_order = position.get(item.id)
    audit(db, actor=actor, action="reorder", entity_type=t.value, changes={"order": [str(i) for i in ids]})

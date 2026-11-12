"""Things a signed-in visitor keeps: saved items and recently viewed items."""

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session as DbSession
from sqlalchemy.orm import with_polymorphic

from app.errors import NotFound
from app.models import Bookmark, ContentItem, ContentType, ItemView, Status, User
from app.services.serialize import public_out

RECENT_KEEP = 200


def _published(db: DbSession, type_: ContentType, slug: str) -> ContentItem:
    item = db.scalar(
        select(ContentItem).where(
            ContentItem.type == type_, func.lower(ContentItem.slug) == slug.lower(), ContentItem.status == Status.published
        )
    )
    if item is None:
        raise NotFound("item not found")
    return item


def set_bookmark(db: DbSession, user: User, type_: ContentType, slug: str, saved: bool) -> None:
    item = _published(db, type_, slug)
    if saved:
        db.execute(insert(Bookmark).values(user_id=user.id, content_id=item.id).on_conflict_do_nothing())
    else:
        db.execute(delete(Bookmark).where(Bookmark.user_id == user.id, Bookmark.content_id == item.id))


def bookmark_keys(db: DbSession, user: User) -> list[dict]:
    rows = db.execute(
        select(ContentItem.type, ContentItem.slug)
        .join(Bookmark, Bookmark.content_id == ContentItem.id)
        .where(Bookmark.user_id == user.id, ContentItem.status == Status.published)
    )
    return [{"type": t.value, "id": s} for t, s in rows]


def record_view(db: DbSession, user: User, type_: ContentType, slug: str) -> None:
    item = _published(db, type_, slug)
    stmt = insert(ItemView).values(user_id=user.id, content_id=item.id, view_count=1)
    db.execute(
        stmt.on_conflict_do_update(
            index_elements=[ItemView.user_id, ItemView.content_id],
            set_={"view_count": ItemView.view_count + 1, "last_viewed_at": func.now()},
        )
    )
    # Keep the history short
    keep = select(ItemView.content_id).where(ItemView.user_id == user.id).order_by(ItemView.last_viewed_at.desc()).limit(RECENT_KEEP)
    db.execute(delete(ItemView).where(ItemView.user_id == user.id, ItemView.content_id.not_in(keep)))


def _items(db: DbSession, ids_in_order: list) -> list[tuple]:
    """(content_id, {"type", "item"}) for the published ones, in the given order."""
    if not ids_in_order:
        return []
    poly = with_polymorphic(ContentItem, "*")
    by_id = {i.id: i for i in db.scalars(select(poly).where(poly.id.in_(ids_in_order), poly.status == Status.published))}
    return [(i, {"type": by_id[i].type.value, "item": public_out(by_id[i])}) for i in ids_in_order if i in by_id]


def library(db: DbSession, user: User, recent_limit: int = 24) -> dict:
    saved = list(db.scalars(select(Bookmark.content_id).where(Bookmark.user_id == user.id).order_by(Bookmark.created_at.desc())))
    rows = db.execute(
        select(ItemView.content_id, ItemView.view_count, ItemView.last_viewed_at)
        .where(ItemView.user_id == user.id)
        .order_by(ItemView.last_viewed_at.desc())
        .limit(recent_limit)
    ).all()
    stats = {cid: (n, at) for cid, n, at in rows}
    recent = []
    for cid, entry in _items(db, [r[0] for r in rows]):
        n, at = stats[cid]
        recent.append({**entry, "views": n, "lastViewedAt": at.isoformat()})
    return {"saved": [e for _, e in _items(db, saved)], "recent": recent}


def clear_history(db: DbSession, user: User) -> None:
    db.execute(delete(ItemView).where(ItemView.user_id == user.id))

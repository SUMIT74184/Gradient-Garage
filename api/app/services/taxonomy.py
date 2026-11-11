import re
import uuid

from sqlalchemy import delete, func, insert, literal, select
from sqlalchemy.orm import Session

from app.errors import Conflict, Invalid, NotFound
from app.models import Label, Tag, User, content_labels, content_tags
from app.services.history import audit


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-") or "tag"


def resolve_tags(db: Session, names: list[str]) -> list[Tag]:
    """Find tags by slug, creating any that don't exist yet (free tagging). Keeps input order."""
    wanted: dict[str, str] = {}
    for n in names:
        wanted.setdefault(slugify(n), n.strip())
    if not wanted:
        return []
    existing = {t.slug: t for t in db.scalars(select(Tag).where(Tag.slug.in_(wanted)))}
    out = []
    for slug, name in wanted.items():
        tag = existing.get(slug)
        if tag is None:
            tag = Tag(name=name, slug=slug)
            db.add(tag)
        out.append(tag)
    return out


def resolve_labels(db: Session, ids: list[uuid.UUID]) -> list[Label]:
    ids = list(dict.fromkeys(ids))
    labels = list(db.scalars(select(Label).where(Label.id.in_(ids)))) if ids else []
    missing = set(ids) - {lb.id for lb in labels}
    if missing:
        raise Invalid("unknown label ids", ids=sorted(str(i) for i in missing))
    return labels


# ---------- tags ----------


def list_tags(db: Session) -> list[dict]:
    counts = (
        select(content_tags.c.tag_id, func.count().label("n")).group_by(content_tags.c.tag_id).subquery()
    )
    rows = db.execute(
        select(Tag, func.coalesce(counts.c.n, 0)).outerjoin(counts, counts.c.tag_id == Tag.id).order_by(Tag.slug)
    )
    return [{"id": t.id, "name": t.name, "slug": t.slug, "count": n} for t, n in rows]


def _get_tag(db: Session, tag_id: uuid.UUID) -> Tag:
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise NotFound("tag not found")
    return tag


def create_tag(db: Session, name: str, actor: User) -> Tag:
    slug = slugify(name)
    if db.scalar(select(Tag).where(Tag.slug == slug)):
        raise Conflict(f"tag '{slug}' already exists")
    tag = Tag(name=name.strip(), slug=slug)
    db.add(tag)
    db.flush()
    audit(db, actor=actor, action="tag.create", entity_type="tag", entity_id=str(tag.id), entity_label=tag.name)
    return tag


def rename_tag(db: Session, tag_id: uuid.UUID, name: str, actor: User) -> Tag:
    tag = _get_tag(db, tag_id)
    slug = slugify(name)
    clash = db.scalar(select(Tag).where(Tag.slug == slug, Tag.id != tag.id))
    if clash:
        raise Conflict(f"tag '{slug}' already exists; merge instead", existingId=str(clash.id))
    before = tag.name
    tag.name, tag.slug = name.strip(), slug
    audit(
        db, actor=actor, action="tag.rename", entity_type="tag", entity_id=str(tag.id),
        entity_label=tag.name, changes={"name": [before, tag.name]},
    )
    return tag


def delete_tag(db: Session, tag_id: uuid.UUID, actor: User) -> None:
    tag = _get_tag(db, tag_id)
    audit(db, actor=actor, action="tag.delete", entity_type="tag", entity_id=str(tag.id), entity_label=tag.name)
    db.delete(tag)


def merge_tag(db: Session, tag_id: uuid.UUID, into_id: uuid.UUID, actor: User) -> Tag:
    """Move every use of `tag_id` onto `into_id`, then delete `tag_id`."""
    if tag_id == into_id:
        raise Invalid("cannot merge a tag into itself")
    src, dst = _get_tag(db, tag_id), _get_tag(db, into_id)
    already = select(content_tags.c.content_id).where(content_tags.c.tag_id == dst.id)
    db.execute(
        insert(content_tags).from_select(
            ["content_id", "tag_id"],
            select(content_tags.c.content_id, literal(dst.id)).where(
                content_tags.c.tag_id == src.id, content_tags.c.content_id.not_in(already)
            ),
        )
    )
    db.execute(delete(content_tags).where(content_tags.c.tag_id == src.id))
    audit(
        db, actor=actor, action="tag.merge", entity_type="tag", entity_id=str(dst.id),
        entity_label=dst.name, changes={"merged": [src.name, dst.name]},
    )
    db.delete(src)
    db.flush()
    db.expire_all()
    return dst


# ---------- labels ----------


def list_labels(db: Session) -> list[dict]:
    counts = (
        select(content_labels.c.label_id, func.count().label("n")).group_by(content_labels.c.label_id).subquery()
    )
    rows = db.execute(
        select(Label, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.label_id == Label.id)
        .order_by(func.lower(Label.name))
    )
    return [
        {"id": lb.id, "name": lb.name, "color": lb.color, "description": lb.description, "count": n} for lb, n in rows
    ]


def _get_label(db: Session, label_id: uuid.UUID) -> Label:
    lb = db.get(Label, label_id)
    if lb is None:
        raise NotFound("label not found")
    return lb


def _check_label_name(db: Session, name: str, exclude: uuid.UUID | None = None) -> None:
    q = select(Label).where(func.lower(Label.name) == name.strip().lower())
    if exclude:
        q = q.where(Label.id != exclude)
    if db.scalar(q):
        raise Conflict(f"label '{name}' already exists")


def create_label(db: Session, data: dict, actor: User) -> Label:
    _check_label_name(db, data["name"])
    lb = Label(**{**data, "name": data["name"].strip()})
    db.add(lb)
    db.flush()
    audit(db, actor=actor, action="label.create", entity_type="label", entity_id=str(lb.id), entity_label=lb.name)
    return lb


def update_label(db: Session, label_id: uuid.UUID, data: dict, actor: User) -> Label:
    lb = _get_label(db, label_id)
    if "name" in data:
        _check_label_name(db, data["name"], exclude=lb.id)
        data["name"] = data["name"].strip()
    changes = {k: [getattr(lb, k), v] for k, v in data.items() if getattr(lb, k) != v}
    for k, v in data.items():
        setattr(lb, k, v)
    audit(
        db, actor=actor, action="label.update", entity_type="label", entity_id=str(lb.id),
        entity_label=lb.name, changes=changes,
    )
    return lb


def delete_label(db: Session, label_id: uuid.UUID, actor: User) -> None:
    lb = _get_label(db, label_id)
    audit(db, actor=actor, action="label.delete", entity_type="label", entity_id=str(lb.id), entity_label=lb.name)
    db.delete(lb)

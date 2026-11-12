from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import Conflict, Invalid, NotFound
from app.models import Revision, SiteContent, User
from app.schemas.site import PRIVATE_SITE_KEYS, SITE_KEYS
from app.services.history import audit, record_revision
from app.services.serialize import diff

ENTITY = "site"


def _schema(key: str):
    if key not in SITE_KEYS:
        raise NotFound(f"unknown site key '{key}'", allowed=sorted(SITE_KEYS))
    return SITE_KEYS[key]


def all_stored(db: Session) -> dict[str, SiteContent]:
    return {row.key: row for row in db.scalars(select(SiteContent))}


def public_values(db: Session) -> dict[str, Any]:
    """Only the keys someone has saved; the website fills in the rest from its defaults."""
    return {k: row.value for k, row in all_stored(db).items() if k in SITE_KEYS and k not in PRIVATE_SITE_KEYS}


def validate(key: str, value: dict) -> dict:
    schema, _ = _schema(key)
    try:
        return schema.model_validate(value).model_dump(mode="json", by_alias=True)
    except ValidationError as e:
        raise Invalid("validation failed", errors=e.errors(include_url=False, include_context=False)) from e


def put(db: Session, key: str, value: dict, version: int, actor: User, note: str = "") -> SiteContent:
    clean = validate(key, value)
    row = db.get(SiteContent, key, with_for_update=True)
    current = row.version if row else 0
    if version != current:
        raise Conflict("someone else changed this since you opened it; reload and try again", currentVersion=current)
    before = row.value if row else {}
    if row and row.value == clean:
        return row
    if row is None:
        row = SiteContent(key=key, value=clean, version=1, updated_by_id=actor.id)
        db.add(row)
    else:
        row.value = clean
        row.version += 1
        row.updated_by_id = actor.id
    db.flush()
    record_revision(db, entity_type=ENTITY, entity_id=key, version=row.version, snapshot=clean, actor=actor, note=note)
    changes = diff(before, clean) if isinstance(before, dict) else {"value": [before, clean]}
    audit(db, actor=actor, action="site.update", entity_type=ENTITY, entity_id=key, entity_label=key, changes=changes)
    db.refresh(row)
    return row


def revisions(db: Session, key: str) -> list[tuple[Revision, str | None]]:
    _schema(key)
    from app.models import User as U

    rows = db.execute(
        select(Revision, U.email)
        .outerjoin(U, U.id == Revision.created_by_id)
        .where(Revision.entity_type == ENTITY, Revision.entity_id == key)
        .order_by(Revision.version.desc())
    )
    return [(r, e) for r, e in rows]


def restore(db: Session, key: str, rev_version: int, version: int, actor: User) -> SiteContent:
    rev = db.scalar(
        select(Revision).where(Revision.entity_type == ENTITY, Revision.entity_id == key, Revision.version == rev_version)
    )
    if rev is None:
        raise NotFound(f"revision {rev_version} not found")
    return put(db, key, rev.snapshot, version, actor, note=f"Restored from v{rev_version}")


def required_role(key: str) -> str:
    return _schema(key)[1]

from typing import Any

from fastapi import APIRouter

from app.deps import Actor, Db
from app.errors import Forbidden
from app.models import Role
from app.services.auth import has_role
from app.schemas.content import TransitionIn
from app.schemas.site import SITE_KEYS, SitePut
from app.services import site as svc

router = APIRouter(prefix="/site", tags=["admin: site & landing"])


def _out(row) -> dict[str, Any]:
    return {"value": row.value, "version": row.version, "updatedAt": row.updated_at.isoformat()}


@router.get("")
def get_site(db: Db) -> dict[str, Any]:
    """Saved documents by key, with versions. Keys that were never saved are absent (the site uses its default)."""
    stored = svc.all_stored(db)
    return {
        "keys": {k: {"role": role} for k, (_, role) in SITE_KEYS.items()},
        "values": {k: _out(row) for k, row in stored.items() if k in SITE_KEYS},
    }


def _check_role(actor, key: str) -> None:
    need = Role(svc.required_role(key))
    if not has_role(actor, need):
        raise Forbidden(f"changing '{key}' needs the {need.value} role")


@router.put("/{key}")
def put_site(db: Db, actor: Actor, key: str, payload: SitePut) -> dict[str, Any]:
    _check_role(actor, key)
    row = svc.put(db, key, payload.value, payload.version, actor)
    db.commit()
    return _out(row)


@router.get("/{key}/revisions")
def site_revisions(db: Db, key: str) -> list[dict[str, Any]]:
    return [
        {"version": r.version, "note": r.note, "createdAt": r.created_at.isoformat(), "createdBy": email, "snapshot": r.snapshot}
        for r, email in svc.revisions(db, key)
    ]


class RestoreIn(TransitionIn):
    pass


@router.post("/{key}/revisions/{rev_version}/restore")
def restore_site(db: Db, actor: Actor, key: str, rev_version: int, payload: RestoreIn) -> dict[str, Any]:
    _check_role(actor, key)
    row = svc.restore(db, key, rev_version, payload.version, actor)
    db.commit()
    return _out(row)

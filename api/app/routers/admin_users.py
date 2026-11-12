import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, status
from pydantic import Field
from sqlalchemy import func, select

from app.deps import Db, Owner
from app.models import TEAM_ROLES, Invite, Role, Session, User
from app.schemas.content import CamelModel
from app.services import auth as svc

router = APIRouter(tags=["admin: team"])


class InviteIn(CamelModel):
    email: Annotated[str, Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    role: Role = Role.editor


class MemberPatch(CamelModel):
    role: Role | None = None
    is_active: bool | None = None


@router.get("/users")
def list_users(db: Db, _: Owner, scope: str = Query("team", pattern="^(team|members)$"), q: str | None = None, limit: int = Query(100, le=500)) -> list[dict]:
    """`team` = owners/editors/viewers; `members` = public site accounts."""
    counts = dict(
        db.execute(
            select(Session.user_id, func.count()).where(Session.expires_at > svc.now()).group_by(Session.user_id)
        ).all()
    )
    stmt = select(User).where(User.email != "system@localhost")
    stmt = stmt.where(User.role.in_(TEAM_ROLES)) if scope == "team" else stmt.where(User.role == Role.member)
    if q:
        stmt = stmt.where(User.email.ilike(f"%{q}%") | User.name.ilike(f"%{q}%"))
    users = db.scalars(stmt.order_by(User.created_at.desc() if scope == "members" else User.created_at).limit(limit))
    return [svc.user_out(u, sessions=counts.get(u.id, 0)) for u in users]


@router.patch("/users/{user_id}")
def update_user(db: Db, actor: Owner, user_id: uuid.UUID, payload: MemberPatch) -> dict:
    user = svc.update_member(db, user_id, actor, role=payload.role, is_active=payload.is_active)
    db.commit()
    return svc.user_out(user)


@router.post("/users/{user_id}/reset-link")
def reset_link(db: Db, actor: Owner, bg: BackgroundTasks, user_id: uuid.UUID) -> dict:
    token, reset = svc.create_reset(db, user_id, actor, bg)
    db.commit()
    return {"token": token, "expiresAt": reset.expires_at.isoformat()}


@router.post("/users/{user_id}/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def sign_out_user(db: Db, actor: Owner, user_id: uuid.UUID) -> None:
    svc.end_all_sessions(db, user_id)
    db.commit()


def _invite_out(inv: Invite) -> dict:
    state = "accepted" if inv.accepted_at else "revoked" if inv.revoked_at else "expired" if inv.expires_at <= svc.now() else "pending"
    return {
        "id": str(inv.id),
        "email": inv.email,
        "role": inv.role.value,
        "state": state,
        "createdAt": inv.created_at.isoformat() if inv.created_at else None,
        "expiresAt": inv.expires_at.isoformat(),
    }


@router.get("/invites")
def list_invites(db: Db, _: Owner) -> list[dict]:
    rows = db.scalars(select(Invite).where(Invite.accepted_at.is_(None)).order_by(Invite.created_at.desc()).limit(100))
    return [_invite_out(i) for i in rows]


@router.post("/invites", status_code=status.HTTP_201_CREATED)
def create_invite(db: Db, actor: Owner, bg: BackgroundTasks, payload: InviteIn) -> dict:
    token, inv = svc.create_invite(db, payload.email, payload.role, actor, bg)
    db.commit()
    return {**_invite_out(inv), "token": token}


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invite(db: Db, actor: Owner, invite_id: uuid.UUID) -> None:
    svc.revoke_invite(db, invite_id, actor)
    db.commit()

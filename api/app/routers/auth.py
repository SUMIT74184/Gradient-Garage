"""Sign-in endpoints, called by the website's server (never directly by browsers)."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import Field

from app.deps import Actor, Db, Token, client_meta, is_internal
from app.errors import Forbidden
from app.schemas.content import CamelModel
from app.models import ContentType
from app.services import auth as svc
from app.services import member as member_svc

router = APIRouter(prefix="/auth", tags=["auth"])

Password = Annotated[str, Field(min_length=1, max_length=1000)]


class LoginIn(CamelModel):
    email: Annotated[str, Field(min_length=3, max_length=320)]
    password: Password


class AcceptIn(CamelModel):
    name: Annotated[str, Field(max_length=200)] = ""
    password: Password


class ResetIn(CamelModel):
    password: Password


class OAuthIn(CamelModel):
    provider: str
    provider_user_id: Annotated[str, Field(min_length=1, max_length=200)]
    email: Annotated[str, Field(max_length=320)]
    email_verified: bool
    name: Annotated[str, Field(max_length=200)] = ""
    avatar_url: Annotated[str | None, Field(max_length=1000)] = None
    invite_token: Annotated[str | None, Field(max_length=200)] = None


class SignupIn(CamelModel):
    name: Annotated[str, Field(max_length=200)] = ""
    email: Annotated[str, Field(min_length=3, max_length=320)]
    password: Password


class EmailIn(CamelModel):
    email: Annotated[str, Field(min_length=3, max_length=320)]


class DeleteMeIn(CamelModel):
    password: Annotated[str | None, Field(max_length=1000)] = None
    confirm_email: Annotated[str | None, Field(max_length=320)] = None


class ItemRef(CamelModel):
    type: ContentType
    id: Annotated[str, Field(min_length=1, max_length=200)]


class BookmarkIn(ItemRef):
    saved: bool = True


class MeIn(CamelModel):
    name: Annotated[str, Field(max_length=200)]


class PasswordChangeIn(CamelModel):
    current_password: Annotated[str | None, Field(max_length=1000)] = None
    new_password: Password


def _session(token: str, user) -> dict:
    return {"token": token, "user": svc.user_out(user)}


@router.post("/login")
def login(db: Db, request: Request, payload: LoginIn) -> dict:
    token, user = svc.login(db, payload.email, payload.password, **client_meta(request))
    db.commit()
    return _session(token, user)


@router.post("/signup")
def signup(db: Db, request: Request, bg: BackgroundTasks, payload: SignupIn) -> dict:
    token, user = svc.signup(db, name=payload.name, email=payload.email, password=payload.password, bg=bg, **client_meta(request))
    db.commit()
    return _session(token, user)


@router.post("/verify/{token}")
def verify(db: Db, token: str) -> dict:
    user = svc.verify_email(db, token)
    db.commit()
    return {"email": user.email}


@router.post("/me/verify", status_code=204)
def resend_verification(db: Db, user: Actor, bg: BackgroundTasks) -> None:
    svc.send_verification(db, user, bg)
    db.commit()


@router.post("/password/forgot", status_code=204)
def forgot(db: Db, bg: BackgroundTasks, payload: EmailIn) -> None:
    svc.forgot_password(db, payload.email, bg)
    db.commit()


@router.post("/me/delete", status_code=204)
def delete_me(db: Db, user: Actor, payload: DeleteMeIn) -> None:
    svc.delete_own_account(db, user, password=payload.password, confirm_email=payload.confirm_email)
    db.commit()


# ---------- saved & recently viewed ----------


@router.get("/me/state")
def me_state(db: Db, user: Actor) -> dict:
    """Small payload for the site header: who's signed in and what they saved."""
    return {"user": svc.user_out(user), "bookmarks": member_svc.bookmark_keys(db, user)}


@router.get("/me/library")
def me_library(db: Db, user: Actor) -> dict:
    return member_svc.library(db, user)


@router.put("/me/bookmarks", status_code=204)
def set_bookmark(db: Db, user: Actor, payload: BookmarkIn) -> None:
    member_svc.set_bookmark(db, user, payload.type, payload.id, payload.saved)
    db.commit()


@router.post("/me/views", status_code=204)
def record_view(db: Db, user: Actor, payload: ItemRef) -> None:
    member_svc.record_view(db, user, payload.type, payload.id)
    db.commit()


@router.delete("/me/views", status_code=204)
def clear_views(db: Db, user: Actor) -> None:
    member_svc.clear_history(db, user)
    db.commit()


@router.post("/oauth")
def oauth(db: Db, request: Request, payload: OAuthIn) -> dict:
    # The website verified this identity with GitHub/Google; only it may assert one
    if not is_internal(request):
        raise Forbidden("internal endpoint")
    token, user = svc.oauth_sign_in(
        db,
        provider=payload.provider,
        provider_user_id=payload.provider_user_id,
        email=payload.email,
        email_verified=payload.email_verified,
        name=payload.name,
        avatar_url=payload.avatar_url,
        invite_token=payload.invite_token,
        **client_meta(request),
    )
    db.commit()
    return _session(token, user)


@router.get("/invites/{token}")
def peek_invite(db: Db, token: str) -> dict:
    inv = svc.peek_invite(db, token)
    return {"email": inv.email, "role": inv.role.value, "expiresAt": inv.expires_at.isoformat()}


@router.post("/invites/{token}/accept")
def accept_invite(db: Db, request: Request, token: str, payload: AcceptIn) -> dict:
    session_token, user = svc.accept_invite(db, token, payload.name, payload.password, **client_meta(request))
    db.commit()
    return _session(session_token, user)


@router.get("/reset/{token}")
def peek_reset(db: Db, token: str) -> dict:
    user = svc.peek_reset(db, token)
    return {"email": user.email}


@router.post("/reset/{token}")
def use_reset(db: Db, request: Request, token: str, payload: ResetIn) -> dict:
    session_token, user = svc.use_reset(db, token, payload.password, **client_meta(request))
    db.commit()
    return _session(session_token, user)


@router.get("/me")
def me(user: Actor) -> dict:
    return svc.user_out(user)


@router.patch("/me")
def update_me(db: Db, user: Actor, payload: MeIn) -> dict:
    user.name = payload.name.strip()
    db.commit()
    return svc.user_out(user)


@router.post("/me/password", status_code=204)
def change_password(db: Db, user: Actor, token: Token, payload: PasswordChangeIn) -> None:
    if user.password_hash:
        try:
            svc._hasher.verify(user.password_hash, payload.current_password or "")
        except Exception as e:
            raise svc.Invalid("current password is wrong", errors=[{"loc": ["currentPassword"], "msg": "Wrong password"}]) from e
    svc.set_password(user, payload.new_password)
    svc.end_all_sessions(db, user.id, keep_token=token)
    svc.audit(db, actor=user, action="user.password_change", entity_type="user", entity_id=str(user.id), entity_label=user.email)
    db.commit()


@router.delete("/me/oauth/{provider}", status_code=204)
def unlink(db: Db, user: Actor, provider: str) -> None:
    svc.unlink_oauth(db, user, provider)
    db.commit()


@router.post("/logout", status_code=204)
def logout(db: Db, token: Token) -> None:
    svc.end_session(db, token)
    db.commit()


@router.post("/logout-all", status_code=204)
def logout_all(db: Db, user: Actor) -> None:
    svc.end_all_sessions(db, user.id)
    db.commit()

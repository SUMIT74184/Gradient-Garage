import hmac
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import Forbidden
from app.models import Role, User
from app.services import auth as auth_svc

Db = Annotated[Session, Depends(get_db)]


def bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise auth_svc.Unauthorized("sign in required")
    return authorization[7:].strip()


Token = Annotated[str, Depends(bearer_token)]


def current_user(db: Db, token: Token) -> User:
    return auth_svc.user_for_token(db, token)


def require_role(need: Role):
    def dep(user: Annotated[User, Depends(current_user)]) -> User:
        if not auth_svc.has_role(user, need):
            raise Forbidden(f"this needs the {need.value} role")
        return user

    return dep


# Anyone signed in (team or public member). Admin routes additionally require Viewer+.
Actor = Annotated[User, Depends(current_user)]
Editor = Annotated[User, Depends(require_role(Role.editor))]
Owner = Annotated[User, Depends(require_role(Role.owner))]


def is_internal(request: Request) -> bool:
    """True when the call carries the website's shared secret."""
    secret = get_settings().internal_api_secret
    given = request.headers.get("x-internal-secret", "")
    return bool(secret) and hmac.compare_digest(given, secret)


def client_meta(request: Request) -> dict[str, str]:
    """The visitor's IP / user agent as forwarded by the website (trusted only with the secret)."""
    if is_internal(request):
        return {"ip": request.headers.get("x-client-ip", ""), "user_agent": request.headers.get("x-client-ua", "")}
    return {"ip": request.client.host if request.client else "", "user_agent": request.headers.get("user-agent", "")}


def get_or_create_system_user(db: Session) -> User:
    """Non-login account that scripts (seeding, imports) attribute their changes to."""
    email = "system@localhost"
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, name="System", role=Role.owner, is_active=False)
        db.add(user)
        db.commit()
    return user

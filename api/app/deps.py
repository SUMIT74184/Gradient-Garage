from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Role, User

Db = Annotated[Session, Depends(get_db)]


def require_admin_enabled() -> None:
    # Phase 6 replaces this with real sign-in. Until then admin routes simply don't exist outside dev.
    if not get_settings().admin_enabled:
        raise HTTPException(status_code=404, detail="Not Found")


def get_or_create_dev_owner(db: Session) -> User:
    email = get_settings().dev_admin_email.lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, name="Dev Owner", role=Role.owner)
        db.add(user)
        db.commit()
    return user


def current_actor(db: Db) -> User:
    return get_or_create_dev_owner(db)


Actor = Annotated[User, Depends(current_actor)]

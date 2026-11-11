import enum
import uuid

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, new_uuid, str_enum_values


class Role(str, enum.Enum):
    owner = "owner"
    editor = "editor"
    viewer = "viewer"


class User(TimestampMixin, Base):
    """An admin-panel team member. Sign-in credentials are added in Phase 6."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(200), default="")
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="user_role", values_callable=str_enum_values), default=Role.editor
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

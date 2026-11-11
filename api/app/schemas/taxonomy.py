import uuid
from datetime import datetime
from typing import Annotated, Optional

from pydantic import Field

from app.schemas.content import CamelModel

TagName = Annotated[str, Field(min_length=1, max_length=80)]
Color = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]


class TagIn(CamelModel):
    name: TagName


class TagOut(CamelModel):
    id: uuid.UUID
    name: str
    slug: str
    count: int = 0


class TagMergeIn(CamelModel):
    into_id: uuid.UUID


class LabelIn(CamelModel):
    name: TagName
    color: Color = "#f97316"
    description: str = ""


class LabelPatch(CamelModel):
    name: Optional[TagName] = None
    color: Optional[Color] = None
    description: Optional[str] = None


class LabelOutWithCount(CamelModel):
    id: uuid.UUID
    name: str
    color: str
    description: str
    count: int = 0


class AuditOut(CamelModel):
    id: int
    actor_email: str
    action: str
    entity_type: str
    entity_id: Optional[str]
    entity_label: str
    changes: dict
    created_at: datetime


class AuditList(CamelModel):
    items: list[AuditOut]
    total: int
    page: int
    page_size: int

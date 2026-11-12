"""Content items: one shared `content_items` row plus a table per type (joined-table inheritance).

Tags, internal labels, lifecycle, badges, featured order and revisions all live on
the shared row, so every admin feature works the same way for all four types.
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid, str_enum_values
from app.models.media import Media


class ContentType(str, enum.Enum):
    model = "model"
    dataset = "dataset"
    demo = "demo"
    library = "library"


class Status(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class Source(str, enum.Enum):
    local = "local"
    huggingface = "huggingface"


class Badge(str, enum.Enum):
    """Public status badges shown on cards."""

    new = "new"
    beta = "beta"
    updated = "updated"
    deprecated = "deprecated"
    coming_soon = "coming_soon"


class ModelKind(str, enum.Enum):
    base = "base"
    fine_tuned = "fine-tuned"


class Modality(str, enum.Enum):
    image = "image"
    video = "video"
    text = "text"
    audio = "audio"
    tabular = "tabular"
    multimodal = "multimodal"
    other = "other"


class DemoSdk(str, enum.Enum):
    gradio = "gradio"
    streamlit = "streamlit"
    docker = "docker"
    static = "static"
    web = "web"


def _enum(e: type[enum.Enum], name: str) -> Enum:
    return Enum(e, name=name, values_callable=str_enum_values)


StrList = ARRAY(Text)

content_tags = Table(
    "content_tags",
    Base.metadata,
    Column("content_id", ForeignKey("content_items.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

content_labels = Table(
    "content_labels",
    Base.metadata,
    Column("content_id", ForeignKey("content_items.id", ondelete="CASCADE"), primary_key=True),
    Column("label_id", ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(TimestampMixin, Base):
    """Public tag, shared across all content types."""

    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(80))
    slug: Mapped[str] = mapped_column(String(80), unique=True)


class Label(TimestampMixin, Base):
    """Internal, admin-only label (e.g. "needs benchmark"). Never sent to the public API."""

    __tablename__ = "labels"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    color: Mapped[str] = mapped_column(String(20), default="#f97316")
    description: Mapped[str] = mapped_column(Text, default="")


class ContentItem(TimestampMixin, Base):
    __tablename__ = "content_items"
    __table_args__ = (
        UniqueConstraint("type", "slug", name="uq_content_items_type_slug"),
        Index("ix_content_items_type_status", "type", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    type: Mapped[ContentType] = mapped_column(_enum(ContentType, "content_type"))
    # Public id, e.g. "owner/model-name" (Hugging Face style) or "posekit"
    slug: Mapped[str] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    links: Mapped[dict] = mapped_column(JSONB, default=dict)

    status: Mapped[Status] = mapped_column(_enum(Status, "content_status"), default=Status.draft)
    badges: Mapped[list[str]] = mapped_column(StrList, default=list)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    # Manual order within a type (lower first); null = after ordered items
    sort_order: Mapped[int | None] = mapped_column(Integer)

    source: Mapped[Source] = mapped_column(_enum(Source, "content_source"), default=Source.local)
    # Fields an admin edited on an HF-synced item; sync never overwrites these
    edited_fields: Mapped[list[str]] = mapped_column(StrList, default=list)
    hf_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    cover_media_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media.id", ondelete="SET NULL"))
    cover: Mapped[Media | None] = relationship(lazy="selectin")

    # The "updated" date shown publicly (from HF lastModified, or set by hand)
    content_date: Mapped[date | None] = mapped_column(Date)

    version: Mapped[int] = mapped_column(Integer, default=1)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    tags: Mapped[list[Tag]] = relationship(
        secondary=content_tags, order_by="Tag.slug", lazy="selectin"
    )
    labels: Mapped[list[Label]] = relationship(secondary=content_labels, lazy="selectin")

    __mapper_args__ = {"polymorphic_on": "type"}


def _child_pk() -> Mapped[uuid.UUID]:
    return mapped_column(ForeignKey("content_items.id", ondelete="CASCADE"), primary_key=True)


class Model(ContentItem):
    __tablename__ = "models"
    __mapper_args__ = {"polymorphic_identity": ContentType.model}

    id: Mapped[uuid.UUID] = _child_pk()
    author: Mapped[str] = mapped_column(String(200), default="")
    task: Mapped[str] = mapped_column(String(100), default="other")
    kind: Mapped[ModelKind] = mapped_column(_enum(ModelKind, "model_kind"), default=ModelKind.base)
    base_model: Mapped[str | None] = mapped_column(String(200))
    datasets: Mapped[list[str]] = mapped_column(StrList, default=list)
    params: Mapped[str | None] = mapped_column(String(40))
    license: Mapped[str] = mapped_column(String(80), default="unknown")
    library: Mapped[str | None] = mapped_column(String(80))
    downloads: Mapped[int] = mapped_column(BigInteger, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    capabilities: Mapped[list[str]] = mapped_column(StrList, default=list)
    usage: Mapped[str | None] = mapped_column(Text)

    benchmarks: Mapped[list["Benchmark"]] = relationship(
        back_populates="model",
        cascade="all, delete-orphan",
        order_by="Benchmark.position",
        lazy="selectin",
    )


class Benchmark(Base):
    __tablename__ = "benchmarks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    model_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("models.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    score: Mapped[float] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(20))
    lower_is_better: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)

    model: Mapped[Model] = relationship(back_populates="benchmarks")


class Dataset(ContentItem):
    __tablename__ = "datasets"
    __mapper_args__ = {"polymorphic_identity": ContentType.dataset}

    id: Mapped[uuid.UUID] = _child_pk()
    author: Mapped[str] = mapped_column(String(200), default="")
    modality: Mapped[Modality] = mapped_column(_enum(Modality, "dataset_modality"), default=Modality.other)
    task: Mapped[str | None] = mapped_column(String(100))
    size: Mapped[str | None] = mapped_column(String(80))
    # The dataset's own classes ("labels" in the public API); not the internal admin labels
    class_labels: Mapped[list[str]] = mapped_column(StrList, default=list)
    license: Mapped[str] = mapped_column(String(80), default="unknown")
    downloads: Mapped[int] = mapped_column(BigInteger, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text)


class Demo(ContentItem):
    __tablename__ = "demos"
    __mapper_args__ = {"polymorphic_identity": ContentType.demo}

    id: Mapped[uuid.UUID] = _child_pk()
    sdk: Mapped[DemoSdk] = mapped_column(_enum(DemoSdk, "demo_sdk"), default=DemoSdk.web)
    url: Mapped[str] = mapped_column(Text, default="")
    embed_url: Mapped[str | None] = mapped_column(Text)
    models: Mapped[list[str]] = mapped_column(StrList, default=list)
    emoji: Mapped[str | None] = mapped_column(String(16))
    likes: Mapped[int] = mapped_column(Integer, default=0)


class Library(ContentItem):
    __tablename__ = "libraries"
    __mapper_args__ = {"polymorphic_identity": ContentType.library}

    id: Mapped[uuid.UUID] = _child_pk()
    language: Mapped[str] = mapped_column(String(40), default="")
    install: Mapped[str] = mapped_column(Text, default="")
    repo: Mapped[str | None] = mapped_column(String(200))
    pypi: Mapped[str | None] = mapped_column(String(200))
    npm: Mapped[str | None] = mapped_column(String(200))
    # Package version ("version" in the public API); `version` on the row is the edit counter
    package_version: Mapped[str | None] = mapped_column(String(40))
    stars: Mapped[int] = mapped_column(Integer, default=0)
    license: Mapped[str] = mapped_column(String(80), default="unknown")
    features: Mapped[list[str]] = mapped_column(StrList, default=list)
    usage: Mapped[str | None] = mapped_column(Text)
    used_by: Mapped[list[str]] = mapped_column(StrList, default=list)


TYPE_CLASS: dict[ContentType, type[ContentItem]] = {
    ContentType.model: Model,
    ContentType.dataset: Dataset,
    ContentType.demo: Demo,
    ContentType.library: Library,
}


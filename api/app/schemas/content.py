"""Admin API payloads (camelCase on the wire).

Naming that differs from the public API, to avoid clashes inside the admin panel:
- `labelIds` / `labels`: internal admin labels (public API never sees them)
- `classLabels` (datasets): the dataset's own classes; public API calls them `labels`
- `packageVersion` (libraries): the release version; `version` is the edit counter
"""

import uuid
from datetime import date, datetime
from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, create_model, field_validator
from pydantic.alias_generators import to_camel

from app.models import Badge, ContentType, DemoSdk, Modality, ModelKind, Source, Status


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


Slug = Annotated[str, Field(min_length=1, max_length=200, pattern=r"^[A-Za-z0-9][A-Za-z0-9._\-/]*$")]
Name = Annotated[str, Field(min_length=1, max_length=200)]
ShortStr = Annotated[str, Field(max_length=200)]
Count = Annotated[int, Field(ge=0)]

LINK_KEYS = {"huggingface", "github", "paper", "demo", "docs", "pypi", "npm"}


class BenchmarkIn(CamelModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    score: float
    unit: Optional[Annotated[str, Field(max_length=20)]] = None
    lower_is_better: bool = False


class CommonFields(CamelModel):
    slug: Slug
    name: Name
    description: str = ""
    links: dict[str, str] = Field(default_factory=dict)
    badges: list[Badge] = Field(default_factory=list)
    featured: bool = False
    sort_order: Optional[int] = None
    content_date: Optional[date] = None
    tags: list[Annotated[str, Field(min_length=1, max_length=80)]] = Field(default_factory=list)
    label_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("links")
    @classmethod
    def _links(cls, v: dict[str, str]) -> dict[str, str]:
        unknown = set(v) - LINK_KEYS
        if unknown:
            raise ValueError(f"unknown link keys: {sorted(unknown)}; allowed: {sorted(LINK_KEYS)}")
        for key, url in v.items():
            if url and not url.startswith(("https://", "http://")):
                raise ValueError(f"links.{key} must be an http(s) URL")
        return {k: u for k, u in v.items() if u}

    @field_validator("badges")
    @classmethod
    def _dedupe_badges(cls, v: list[Badge]) -> list[Badge]:
        return list(dict.fromkeys(v))


class ModelFields(CommonFields):
    type: Literal[ContentType.model] = ContentType.model
    author: ShortStr = ""
    task: ShortStr = "other"
    kind: ModelKind = ModelKind.base
    base_model: Optional[ShortStr] = None
    datasets: list[str] = Field(default_factory=list)
    params: Optional[Annotated[str, Field(max_length=40)]] = None
    license: ShortStr = "unknown"
    library: Optional[ShortStr] = None
    downloads: Count = 0
    likes: Count = 0
    capabilities: list[str] = Field(default_factory=list)
    usage: Optional[str] = None
    benchmarks: list[BenchmarkIn] = Field(default_factory=list)


class DatasetFields(CommonFields):
    type: Literal[ContentType.dataset] = ContentType.dataset
    author: ShortStr = ""
    modality: Modality = Modality.other
    task: Optional[ShortStr] = None
    size: Optional[ShortStr] = None
    class_labels: list[str] = Field(default_factory=list)
    license: ShortStr = "unknown"
    downloads: Count = 0
    likes: Count = 0
    notes: Optional[str] = None


class DemoFields(CommonFields):
    type: Literal[ContentType.demo] = ContentType.demo
    sdk: DemoSdk = DemoSdk.web
    url: str = ""
    embed_url: Optional[str] = None
    models: list[str] = Field(default_factory=list)
    emoji: Optional[Annotated[str, Field(max_length=16)]] = None
    likes: Count = 0


class LibraryFields(CommonFields):
    type: Literal[ContentType.library] = ContentType.library
    language: ShortStr = ""
    install: str = ""
    repo: Optional[ShortStr] = None
    pypi: Optional[ShortStr] = None
    npm: Optional[ShortStr] = None
    package_version: Optional[Annotated[str, Field(max_length=40)]] = None
    stars: Count = 0
    license: ShortStr = "unknown"
    features: list[str] = Field(default_factory=list)
    usage: Optional[str] = None
    used_by: list[str] = Field(default_factory=list)


FIELDS_BY_TYPE: dict[ContentType, type[CommonFields]] = {
    ContentType.model: ModelFields,
    ContentType.dataset: DatasetFields,
    ContentType.demo: DemoFields,
    ContentType.library: LibraryFields,
}

ContentCreate = Annotated[
    Union[ModelFields, DatasetFields, DemoFields, LibraryFields], Field(discriminator="type")
]


def _patch_model(fields: type[CommonFields]) -> type[CamelModel]:
    """Same fields as `fields`, all optional, plus the `version` the client last saw.

    The service merges the patch onto the current item and re-validates the whole
    thing with `fields`, so field validators and non-null rules still apply.
    """
    defs: dict[str, Any] = {"version": (int, ...), "note": (Optional[str], None)}
    for name, info in fields.model_fields.items():
        if name == "type":
            continue
        defs[name] = (Optional[info.annotation], None)
    patch = create_model(f"{fields.__name__.removesuffix('Fields')}Patch", __base__=CamelModel, **defs)
    return patch


PATCH_BY_TYPE = {t: _patch_model(f) for t, f in FIELDS_BY_TYPE.items()}


# ---------- responses ----------


class LabelOut(CamelModel):
    id: uuid.UUID
    name: str
    color: str
    description: str = ""


class ItemMeta(CamelModel):
    model_config = ConfigDict(extra="allow")

    id: uuid.UUID
    type: ContentType
    status: Status
    version: int
    source: Source
    labels: list[LabelOut]
    edited_fields: list[str]
    hf_synced_at: Optional[datetime]
    published_at: Optional[datetime]
    archived_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class ItemList(CamelModel):
    items: list[ItemMeta]
    total: int
    page: int
    page_size: int


class TransitionIn(CamelModel):
    version: int


class OrderIn(CamelModel):
    type: ContentType
    ids: list[uuid.UUID]


class RevisionOut(CamelModel):
    id: uuid.UUID
    version: int
    note: str
    created_at: datetime
    created_by: Optional[str]
    snapshot: Optional[dict] = None

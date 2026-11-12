import io
import uuid

from PIL import Image, UnidentifiedImageError
from sqlalchemy import cast, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.types import Text

from app.config import get_settings
from app.errors import Conflict, Invalid, NotFound
from app.models import ContentItem, Media, SiteContent, User
from app.services.history import audit
from app.storage import get_storage

# Detected format → (extension, MIME). SVG is deliberately not accepted (it can carry scripts).
FORMATS = {"JPEG": ("jpg", "image/jpeg"), "PNG": ("png", "image/png"), "WEBP": ("webp", "image/webp"), "GIF": ("gif", "image/gif")}
Image.MAX_IMAGE_PIXELS = 60_000_000  # refuse decompression bombs


def media_out(m: Media, usage: list[dict] | None = None) -> dict:
    out = {
        "id": str(m.id),
        "url": get_storage().url(m.storage_key),
        "filename": m.filename,
        "contentType": m.content_type,
        "sizeBytes": m.size_bytes,
        "width": m.width,
        "height": m.height,
        "alt": m.alt,
        "createdAt": m.created_at.isoformat() if m.created_at else None,
    }
    if usage is not None:
        out["usage"] = usage
    return out


def upload(db: Session, *, data: bytes, filename: str, alt: str, actor: User) -> Media:
    limit = get_settings().max_upload_mb * 1024 * 1024
    if len(data) > limit:
        raise Invalid(f"file is larger than {get_settings().max_upload_mb} MB")
    if not data:
        raise Invalid("empty file")
    try:
        with Image.open(io.BytesIO(data)) as img:
            fmt = img.format
            width, height = img.size
            img.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise Invalid("not a valid image (JPEG, PNG, WebP or GIF)") from e
    if fmt not in FORMATS:
        raise Invalid(f"{fmt} images aren't supported; use JPEG, PNG, WebP or GIF")

    ext, mime = FORMATS[fmt]
    key = f"{uuid.uuid4().hex}.{ext}"
    get_storage().save(key, data)
    m = Media(
        storage_key=key,
        filename=(filename or f"upload.{ext}")[:300],
        content_type=mime,
        size_bytes=len(data),
        width=width,
        height=height,
        alt=alt.strip(),
        created_by_id=actor.id,
    )
    db.add(m)
    db.flush()
    audit(db, actor=actor, action="media.upload", entity_type="media", entity_id=str(m.id), entity_label=m.filename)
    return m


def get(db: Session, media_id: uuid.UUID) -> Media:
    m = db.get(Media, media_id)
    if m is None:
        raise NotFound("media not found")
    return m


def usage(db: Session, m: Media) -> list[dict]:
    """Where this image is used: item covers and site content that references its URL."""
    out = [
        {"kind": "cover", "type": t.value, "id": str(i), "name": n}
        for i, t, n in db.execute(
            select(ContentItem.id, ContentItem.type, ContentItem.name).where(ContentItem.cover_media_id == m.id)
        )
    ]
    url = get_storage().url(m.storage_key)
    for (key,) in db.execute(select(SiteContent.key).where(cast(SiteContent.value, Text).contains(url))):
        out.append({"kind": "site", "key": key})
    return out


def list_media(db: Session, q: str | None = None) -> list[dict]:
    stmt = select(Media).order_by(Media.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Media.filename.ilike(like), Media.alt.ilike(like)))
    items = list(db.scalars(stmt))
    covers: dict[uuid.UUID, list[dict]] = {}
    for i, t, n, mid in db.execute(
        select(ContentItem.id, ContentItem.type, ContentItem.name, ContentItem.cover_media_id).where(
            ContentItem.cover_media_id.is_not(None)
        )
    ):
        covers.setdefault(mid, []).append({"kind": "cover", "type": t.value, "id": str(i), "name": n})
    site = [(k, str(v)) for k, v in db.execute(select(SiteContent.key, cast(SiteContent.value, Text)))]
    out = []
    for m in items:
        url = get_storage().url(m.storage_key)
        used = covers.get(m.id, []) + [{"kind": "site", "key": k} for k, v in site if url in v]
        out.append(media_out(m, used))
    return out


def update_alt(db: Session, media_id: uuid.UUID, alt: str, actor: User) -> Media:
    m = get(db, media_id)
    before = m.alt
    m.alt = alt.strip()
    audit(
        db, actor=actor, action="media.update", entity_type="media", entity_id=str(m.id),
        entity_label=m.filename, changes={"alt": [before, m.alt]},
    )
    return m


def delete(db: Session, media_id: uuid.UUID, actor: User) -> None:
    m = get(db, media_id)
    used = usage(db, m)
    if used:
        raise Conflict("this image is still in use; replace it there first", usage=used)
    audit(db, actor=actor, action="media.delete", entity_type="media", entity_id=str(m.id), entity_label=m.filename)
    key = m.storage_key
    db.delete(m)
    db.flush()
    get_storage().delete(key)


def count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Media)) or 0

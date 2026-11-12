import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.deps import Db, Editor
from app.errors import Invalid
from app.schemas.content import CamelModel
from app.services import media as svc

router = APIRouter(prefix="/media", tags=["admin: media"])


class AltIn(CamelModel):
    alt: str


@router.get("")
def list_media(db: Db, q: str | None = Query(None)) -> list[dict]:
    return svc.list_media(db, q)


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload(db: Db, actor: Editor, file: Annotated[UploadFile, File()], alt: Annotated[str, Form()] = "") -> dict:
    limit = svc.get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise Invalid(f"file is larger than {svc.get_settings().max_upload_mb} MB")
    m = svc.upload(db, data=data, filename=file.filename or "", alt=alt, actor=actor)
    db.commit()
    return svc.media_out(m, [])


@router.patch("/{media_id}")
def update_media(db: Db, actor: Editor, media_id: uuid.UUID, payload: AltIn) -> dict:
    m = svc.update_alt(db, media_id, payload.alt, actor)
    db.commit()
    return svc.media_out(m, svc.usage(db, m))


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(db: Db, actor: Editor, media_id: uuid.UUID) -> None:
    svc.delete(db, media_id, actor)
    db.commit()

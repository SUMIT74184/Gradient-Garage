from fastapi import APIRouter, Response

from app.deps import Db
from app.models import ContentType
from app.services.content import published_items
from app.services.serialize import public_out

router = APIRouter(prefix="/public", tags=["public"])

HUB_KEYS = {
    ContentType.model: "models",
    ContentType.library: "libraries",
    ContentType.dataset: "datasets",
    ContentType.demo: "demos",
}


@router.get("/hub")
def hub(db: Db, response: Response) -> dict[str, list[dict]]:
    """Every published item, in the `Hub` shape the website already renders."""
    out: dict[str, list[dict]] = {key: [] for key in HUB_KEYS.values()}
    for item in published_items(db):
        out[HUB_KEYS[item.type]].append(public_out(item))
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=300"
    return out

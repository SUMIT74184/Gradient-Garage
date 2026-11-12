"""Phase 5 admin tools: Hugging Face sync, bulk actions, CSV import/export, stats."""

import uuid
from typing import Any

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import Response

from app.config import get_settings
from app.deps import Db, Editor
from app.errors import NotFound
from app.models import ContentType, SyncRun
from app.schemas.content import CamelModel
from app.services import bulk as bulk_svc
from app.services import csv_io
from app.services import stats as stats_svc
from app.services import sync as sync_svc

router = APIRouter(tags=["admin: sync, bulk, import/export, stats"])


def _run_out(run: SyncRun) -> dict[str, Any]:
    return {
        "id": str(run.id),
        "status": run.status,
        "trigger": run.trigger,
        "actorEmail": run.actor_email,
        "report": run.report,
        "error": run.error,
        "startedAt": run.started_at.isoformat(),
        "finishedAt": run.finished_at.isoformat() if run.finished_at else None,
    }


# ---------- sync ----------


@router.get("/sync")
def sync_status(db: Db) -> dict[str, Any]:
    """Settings (saved with PUT /admin/site/sync, Owner only), recent runs, and which tokens are configured."""
    cfg, saved = sync_svc.get_settings_doc(db)
    s = get_settings()
    return {
        "settings": cfg.model_dump(by_alias=True),
        "saved": saved,
        "tokens": {"huggingface": bool(s.hf_token), "github": bool(s.github_token)},
        "runs": [_run_out(r) for r in sync_svc.latest_runs(db, 10)],
    }


@router.post("/sync/huggingface")
def run_sync(db: Db, actor: Editor) -> dict[str, Any]:
    """Import new Hugging Face items as drafts, refresh synced fields and live stats. Takes a few seconds."""
    return _run_out(sync_svc.run_sync(db, actor, trigger="manual"))


@router.get("/sync/runs/{run_id}")
def get_run(db: Db, run_id: uuid.UUID) -> dict[str, Any]:
    run = db.get(SyncRun, run_id)
    if run is None:
        raise NotFound("sync run not found")
    return _run_out(run)


# ---------- bulk ----------


class BulkIn(CamelModel):
    ids: list[uuid.UUID]
    action: bulk_svc.BulkAction
    value: Any = None


@router.post("/content/bulk")
def bulk(db: Db, actor: Editor, payload: BulkIn) -> dict[str, Any]:
    """Apply one action to many items. Items that can't take it are listed in `skipped`."""
    result = bulk_svc.run_bulk(db, payload.ids, payload.action, payload.value, actor)
    db.commit()
    return result


# ---------- CSV ----------


@router.get("/export.csv")
def export_csv(db: Db, type: ContentType) -> Response:
    body = csv_io.export_csv(db, type)
    return Response(
        body.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{type.value}s.csv"', "Cache-Control": "no-store"},
    )


@router.get("/import/columns")
def import_columns(type: ContentType) -> dict[str, Any]:
    return {"columns": csv_io.columns(type), "readOnly": csv_io.READ_ONLY, "listSeparator": csv_io.SEP.strip()}


@router.post("/import")
async def import_csv(
    db: Db,
    actor: Editor,
    type: ContentType,
    file: UploadFile = File(...),
    dry_run: bool = Query(True, description="true: preview only; false: apply (all rows or none)"),
) -> dict[str, Any]:
    data = await file.read(csv_io.MAX_BYTES + 1)
    if dry_run:
        return csv_io.plan_import(db, type, data)
    result = csv_io.commit_import(db, type, data, actor, filename=file.filename or "")
    db.commit()
    return result


# ---------- stats ----------


@router.get("/stats")
def stats(db: Db, days: int = Query(30, ge=7, le=365)) -> dict[str, Any]:
    return stats_svc.overview(db, days)

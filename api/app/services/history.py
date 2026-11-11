from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog, Revision, User


def record_revision(
    db: Session, *, entity_type: str, entity_id: str, version: int, snapshot: dict, actor: User | None, note: str = ""
) -> None:
    db.add(
        Revision(
            entity_type=entity_type,
            entity_id=entity_id,
            version=version,
            snapshot=snapshot,
            note=note,
            created_by_id=actor.id if actor else None,
        )
    )


def audit(
    db: Session,
    *,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    entity_label: str = "",
    changes: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            actor_email=actor.email if actor else "system",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=entity_label[:300],
            changes=changes or {},
        )
    )

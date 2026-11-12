"""Bulk actions on many content items at once.

Each item is applied in its own savepoint: one item that can't take the action (wrong
status, deleted meanwhile) is reported as skipped and the rest still go through.
Every change goes through the normal write path, so revisions and the activity log
look exactly as if it had been done one item at a time.
"""

import uuid
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.errors import AppError, Forbidden, Invalid
from app.models import Badge, Role, Status, User
from app.services import content as svc
from app.services.serialize import snapshot
from app.services.taxonomy import resolve_labels, slugify

BulkAction = Literal[
    "publish", "unpublish", "archive", "restore",
    "add_tags", "remove_tags", "add_labels", "remove_labels",
    "add_badge", "remove_badge", "feature", "unfeature",
    "delete",
]

MAX_ITEMS = 200


def _patch_for(action: str, current: dict[str, Any], value: Any) -> dict[str, Any] | None:
    """camelCase patch for a field action, or None when the item already matches."""
    if action in ("add_tags", "remove_tags"):
        names = [str(v) for v in value]
        have = {slugify(t): t for t in current["tags"]}
        want = {slugify(n): n for n in names}
        if action == "add_tags":
            merged = {**want, **have}  # keep the existing spelling of tags it already has
        else:
            merged = {k: v for k, v in have.items() if k not in want}
        return None if merged.keys() == have.keys() else {"tags": list(merged.values())}
    if action in ("add_labels", "remove_labels"):
        have = list(current["labelIds"])
        ids = [str(v) for v in value]
        new = list(dict.fromkeys(have + ids)) if action == "add_labels" else [i for i in have if i not in ids]
        return None if set(new) == set(have) else {"labelIds": new}
    if action in ("add_badge", "remove_badge"):
        have = list(current["badges"])
        new = list(dict.fromkeys(have + [value])) if action == "add_badge" else [b for b in have if b != value]
        return None if new == have else {"badges": new}
    if action in ("feature", "unfeature"):
        want = action == "feature"
        return None if current["featured"] is want else {"featured": want}
    raise Invalid(f"unknown action {action}")


def _check_value(action: str, value: Any) -> Any:
    if action in ("add_tags", "remove_tags", "add_labels", "remove_labels"):
        if not isinstance(value, list) or not value or not all(isinstance(v, str) and v.strip() for v in value):
            raise Invalid(f"{action} needs a non-empty list in `value`")
        if action.endswith("labels"):
            try:
                [uuid.UUID(v) for v in value]
            except ValueError as e:
                raise Invalid("`value` must be label ids") from e
    if action in ("add_badge", "remove_badge"):
        if value not in {b.value for b in Badge}:
            raise Invalid("`value` must be a badge", allowed=[b.value for b in Badge])
    return value


def run_bulk(db: Session, ids: list[uuid.UUID], action: str, value: Any, actor: User) -> dict[str, Any]:
    if not ids:
        raise Invalid("choose at least one item")
    if len(ids) > MAX_ITEMS:
        raise Invalid(f"at most {MAX_ITEMS} items at a time")
    if action == "delete" and actor.role is not Role.owner:
        raise Forbidden("only an Owner can permanently delete")
    value = _check_value(action, value)
    if action == "add_labels":
        # Fails the whole request up front if a label doesn't exist
        resolve_labels(db, [uuid.UUID(v) for v in value])

    done: list[str] = []
    unchanged: list[str] = []
    skipped: list[dict[str, str]] = []
    for item_id in dict.fromkeys(ids):
        try:
            with db.begin_nested():
                item = svc.get_item(db, item_id, lock=True)
                if action in svc.TRANSITIONS:
                    allowed, target = svc.TRANSITIONS[action]
                    if item.status is target:
                        unchanged.append(str(item_id))
                        continue
                    if item.status not in allowed:
                        skipped.append({"id": str(item_id), "name": item.name, "reason": f"it's {item.status.value}"})
                        continue
                    svc.transition(db, item_id, action, item.version, actor)
                elif action == "delete":
                    if item.status is not Status.archived:
                        skipped.append({"id": str(item_id), "name": item.name, "reason": "archive it first"})
                        continue
                    svc.delete_item(db, item_id, actor)
                else:
                    patch = _patch_for(action, snapshot(item), value)
                    if patch is None:
                        unchanged.append(str(item_id))
                        continue
                    svc._update(db, item, patch, actor, note=f"Bulk: {action.replace('_', ' ')}")
                done.append(str(item_id))
        except AppError as e:
            skipped.append({"id": str(item_id), "name": "", "reason": e.message})
    return {"action": action, "done": done, "unchanged": unchanged, "skipped": skipped}


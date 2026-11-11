"""Seed Postgres with the content the site shows today (api/seed/*.json).

    python -m scripts.seed           # add anything missing, skip existing ids
    python -m scripts.seed --reset   # wipe all content first (asks for confirmation)

Regenerate the JSON from web/src/data with:  node web/scripts/export-seed.mjs
"""

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import delete, func, select

from app.db import SessionLocal
from app.deps import get_or_create_dev_owner
from app.models import AuditLog, ContentItem, ContentType, Label, Revision, Tag
from app.schemas.content import FIELDS_BY_TYPE
from app.services import content as svc

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"
FILES = {
    ContentType.model: "models.json",
    ContentType.dataset: "datasets.json",
    ContentType.demo: "demos.json",
    ContentType.library: "libraries.json",
}
# Public/web field name → admin field name
RENAMES = {
    ContentType.dataset: {"labels": "classLabels"},
    ContentType.library: {"version": "packageVersion"},
}
DEFAULT_LABELS = [
    ("Needs benchmark", "#eab308", "No benchmark scores yet"),
    ("Needs description", "#f97316", "Description is a placeholder"),
    ("Review", "#3b82f6", "Ready for a second pair of eyes"),
    ("Sample data", "#64748b", "Placeholder entry from the starter template"),
]


def to_payload(t: ContentType, row: dict) -> dict:
    data = dict(row)
    data["slug"] = data.pop("id")
    data["contentDate"] = data.pop("updatedAt", None)
    data.pop("source", None)
    for old, new in RENAMES.get(t, {}).items():
        if old in data:
            data[new] = data.pop(old)
    if data.get("emoji") == "":
        data["emoji"] = None
    return data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="delete all content, tags, revisions and activity first")
    parser.add_argument("--yes", action="store_true", help="don't ask before --reset")
    args = parser.parse_args()

    with SessionLocal() as db:
        if args.reset:
            if not args.yes and input("Delete ALL content, tags, labels, revisions and activity? [y/N] ").lower() != "y":
                sys.exit("aborted")
            for model in (ContentItem, Tag, Label, Revision, AuditLog):
                db.execute(delete(model))
            db.commit()

        actor = get_or_create_dev_owner(db)

        existing_labels = {n.lower() for n in db.scalars(select(Label.name))}
        for name, color, desc in DEFAULT_LABELS:
            if name.lower() not in existing_labels:
                db.add(Label(name=name, color=color, description=desc))
        db.flush()
        sample_label = db.scalar(select(Label).where(func.lower(Label.name) == "sample data"))

        added = skipped = 0
        for t, filename in FILES.items():
            for row in json.loads((SEED_DIR / filename).read_text()):
                data = to_payload(t, row)
                exists = db.scalar(
                    select(ContentItem.id).where(
                        ContentItem.type == t, func.lower(ContentItem.slug) == data["slug"].lower()
                    )
                )
                if exists:
                    skipped += 1
                    continue
                # The starter files are all placeholder entries; the label makes them easy to find and replace
                if sample_label:
                    data["labelIds"] = [str(sample_label.id)]
                payload = FIELDS_BY_TYPE[t].model_validate({**data, "type": t.value})
                item = svc.create_item(db, payload, actor)
                # Everything in the static files is live on the site today
                svc.transition(db, item.id, "publish", item.version, actor)
                added += 1
        db.commit()
        print(f"seeded {added} items, skipped {skipped} existing")


if __name__ == "__main__":
    main()

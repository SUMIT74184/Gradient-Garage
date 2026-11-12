"""Run the Hugging Face / GitHub sync from the command line (for cron or a systemd timer).

    python -m scripts.sync            # same as the "Sync now" button in the admin panel
    python -m scripts.sync --quiet    # print nothing unless it fails

Exit code 1 when the run failed, 2 when another run is already in progress.
Changes are attributed to the "System" account in the activity log.
"""

import argparse
import json
import sys

from app.db import SessionLocal
from app.deps import get_or_create_system_user
from app.errors import Conflict
from app.services.sync import run_sync


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    with SessionLocal() as db:
        actor = get_or_create_system_user(db)
        try:
            run = run_sync(db, actor, trigger="schedule")
        except Conflict as e:
            print(e.message, file=sys.stderr)
            sys.exit(2)

    if run.status != "succeeded":
        print(f"sync failed: {run.error}", file=sys.stderr)
        sys.exit(1)
    if not args.quiet:
        r = run.report
        print(
            f"imported {len(r['created'])}, updated {len(r['updated'])}, refreshed {r['refreshed']}, "
            f"unchanged {r['unchanged']}, missing {len(r['missing'])}, libraries {r['libraries']}"
        )
        for err in r["errors"]:
            print(f"  ! {err}")
        if r["missing"]:
            print("  missing on Hugging Face:", json.dumps([m["slug"] for m in r["missing"]]))


if __name__ == "__main__":
    main()

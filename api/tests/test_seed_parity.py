"""The public hub, after seeding, must match the static data the site renders today."""

import json
from pathlib import Path

from scripts import seed

SEED = Path(__file__).resolve().parent.parent / "seed"


def test_seed_matches_static_data(client, monkeypatch):
    monkeypatch.setattr("sys.argv", ["seed"])
    seed.main()
    hub = client.get("/api/v1/public/hub").json()

    for key in ("models", "datasets", "demos", "libraries"):
        expected = {row["id"]: row for row in json.loads((SEED / f"{key}.json").read_text())}
        got = {row["id"]: row for row in hub[key]}
        assert got.keys() == expected.keys(), key
        for item_id, want in expected.items():
            have = dict(got[item_id])
            assert have.pop("badges") == [] and have.pop("featured") is False and "sortOrder" not in have
            want = {k: v for k, v in want.items() if v not in ("", None)}
            assert sorted(have.pop("tags")) == sorted(want.pop("tags")), item_id
            have.pop("tags", None)
            assert have == want, item_id

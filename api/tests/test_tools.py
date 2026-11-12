"""Bulk actions, CSV import/export, stats and the activity log filters."""

import csv
import io

from tests.conftest import ADMIN, as_role, make_model


def ids_of(*items):
    return [i["id"] for i in items]


def bulk(client, ids, action, value=None, expect=200):
    r = client.post(f"{ADMIN}/content/bulk", json={"ids": ids, "action": action, "value": value})
    assert r.status_code == expect, r.text
    return r.json()


def get(client, item):
    return client.get(f"{ADMIN}/content/{item['id']}").json()


# ---------- bulk ----------


def test_bulk_publish_skips_items_that_cant(client):
    a = make_model(client, slug="a/a", name="A")
    b = make_model(client, slug="a/b", name="B")
    c = make_model(client, slug="a/c", name="C")
    client.post(f"{ADMIN}/content/{c['id']}/archive", json={"version": 1})
    client.post(f"{ADMIN}/content/{b['id']}/publish", json={"version": 1})

    out = bulk(client, ids_of(a, b, c), "publish")
    assert out["done"] == [a["id"]]
    assert out["unchanged"] == [b["id"]]
    assert out["skipped"] == [{"id": c["id"], "name": "C", "reason": "it's archived"}]
    assert sorted(m["id"] for m in client.get("/api/v1/public/hub").json()["models"]) == ["a/a", "a/b"]


def test_bulk_tags_labels_badges_featured(client):
    a = make_model(client, slug="a/a", tags=["Vision"])
    b = make_model(client, slug="a/b", tags=[])
    label = client.post(f"{ADMIN}/labels", json={"name": "Review"}).json()

    out = bulk(client, ids_of(a, b), "add_tags", ["vision", "new-tag"])
    assert sorted(out["done"]) == sorted(ids_of(a, b))
    assert get(client, a)["tags"] == ["new-tag", "Vision"]  # existing spelling kept
    assert get(client, b)["tags"] == ["new-tag", "Vision"]  # tags are shared, so the existing tag is reused

    assert bulk(client, ids_of(a), "remove_tags", ["VISION"])["done"] == [a["id"]]
    assert get(client, a)["tags"] == ["new-tag"]

    bulk(client, ids_of(a, b), "add_labels", [label["id"]])
    assert [lb["name"] for lb in get(client, b)["labels"]] == ["Review"]
    bulk(client, ids_of(a, b), "add_badge", "beta")
    assert get(client, a)["badges"] == ["beta"]
    out = bulk(client, ids_of(a, b), "feature")
    assert get(client, a)["featured"] is True
    assert bulk(client, ids_of(a, b), "feature")["unchanged"] == ids_of(a, b)

    revs = client.get(f"{ADMIN}/content/{a['id']}/revisions").json()
    assert revs[0]["note"] == "Bulk: feature"


def test_bulk_validation_and_roles(client):
    a = make_model(client)
    bulk(client, [], "publish", expect=422)
    bulk(client, ids_of(a), "add_badge", "shiny", expect=422)
    bulk(client, ids_of(a), "add_tags", [], expect=422)
    bulk(client, ids_of(a), "add_labels", ["00000000-0000-0000-0000-000000000000"], expect=422)
    viewer = as_role("viewer")
    assert viewer.post(f"{ADMIN}/content/bulk", json={"ids": ids_of(a), "action": "publish"}).status_code == 403
    editor = as_role("editor")
    assert editor.post(f"{ADMIN}/content/bulk", json={"ids": ids_of(a), "action": "delete"}).status_code == 403


def test_bulk_delete_only_archived(client):
    a = make_model(client, slug="a/a")
    b = make_model(client, slug="a/b")
    client.post(f"{ADMIN}/content/{a['id']}/archive", json={"version": 1})
    out = bulk(client, ids_of(a, b), "delete")
    assert out["done"] == [a["id"]] and out["skipped"][0]["reason"] == "archive it first"
    assert client.get(f"{ADMIN}/content/{a['id']}").status_code == 404


# ---------- CSV ----------


def export(client, type_="model"):
    r = client.get(f"{ADMIN}/export.csv", params={"type": type_})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    return r.content.decode("utf-8-sig")


def upload(client, text, type_="model", dry_run=True, expect=200):
    r = client.post(
        f"{ADMIN}/import",
        params={"type": type_, "dry_run": str(dry_run).lower()},
        files={"file": ("items.csv", text.encode("utf-8"), "text/csv")},
    )
    assert r.status_code == expect, r.text
    return r.json()


def test_export_then_reimport_is_a_noop(client):
    client.post(f"{ADMIN}/labels", json={"name": "Review"})
    make_model(client, tags=["LLM", "english"], capabilities=["Chat", "Code"], benchmarks=[{"name": "MMLU", "score": 40.1, "unit": "%"}])
    text = export(client)
    rows = list(csv.DictReader(io.StringIO(text)))
    assert rows[0]["slug"] == "acme/nova" and rows[0]["capabilities"] == "Chat | Code"
    assert rows[0]["links.huggingface"] == "https://huggingface.co/acme/nova"
    assert rows[0]["status"] == "draft"

    plan = upload(client, text)
    assert plan["summary"]["unchanged"] == 1 and plan["summary"]["error"] == 0, plan


def test_import_creates_and_updates_only_given_columns(client):
    item = make_model(client, description="Old", task="text-generation")
    text = "slug,description,tags\nacme/nova,New words,llm | chat\nacme/new-one,Fresh,\n"
    plan = upload(client, text)
    rows = {r["slug"]: r for r in plan["rows"]}
    assert rows["acme/nova"]["action"] == "update" and rows["acme/nova"]["changes"] == ["description", "tags"]
    assert rows["acme/new-one"]["action"] == "error"  # name is required for a new item

    text = "slug,name,description,tags\nacme/nova,Nova,New words,llm | chat\nacme/new-one,New One,Fresh,\n"
    plan = upload(client, text)
    assert plan["summary"] == {"create": 1, "update": 1, "unchanged": 0, "error": 0, "skip": 0}
    # dry run wrote nothing
    assert get(client, item)["description"] == "Old"

    upload(client, text, dry_run=False)
    out = get(client, item)
    assert out["description"] == "New words" and out["task"] == "text-generation"
    assert out["tags"] == ["chat", "LLM"]  # "llm" matched the existing "LLM" tag
    created = [i for i in client.get(f"{ADMIN}/content", params={"type": "model"}).json()["items"] if i["slug"] == "acme/new-one"][0]
    assert created["status"] == "draft"
    log = client.get(f"{ADMIN}/audit", params={"action": "import.csv"}).json()["items"]
    assert log[0]["changes"] == {"created": 1, "updated": 1, "unchanged": 0}


def test_import_with_errors_writes_nothing(client):
    make_model(client)
    text = "slug,name,downloads,featured,labels\nacme/nova,Nova,lots,maybe,Ghost\na/ok,Fine,3,true,\n"
    plan = upload(client, text)
    bad = plan["rows"][0]
    assert bad["action"] == "error"
    assert {e["field"] for e in bad["errors"]} == {"downloads", "featured", "labels"}
    upload(client, text, dry_run=False, expect=422)
    assert [i["slug"] for i in client.get(f"{ADMIN}/content", params={"type": "model"}).json()["items"]] == ["acme/nova"]


def test_import_rejects_unknown_columns_and_duplicates(client):
    r = upload(client, "slug,colour\na/b,red\n", expect=422)
    assert "colour" in r["detail"]
    plan = upload(client, "slug,name\na/b,B\nA/B,B again\n")
    assert plan["rows"][1]["errors"][0]["msg"] == "appears more than once in this file"


def test_export_neutralises_formulas(client):
    make_model(client, description="=HYPERLINK(\"http://evil\")")
    text = export(client)
    row = next(csv.DictReader(io.StringIO(text)))
    assert row["description"].startswith("'=")
    # and the quote is stripped again on the way back in
    assert upload(client, text)["summary"]["unchanged"] == 1


def test_import_needs_editor(client):
    viewer = as_role("viewer")
    r = viewer.post(f"{ADMIN}/import", params={"type": "model"}, files={"file": ("a.csv", b"slug\n", "text/csv")})
    assert r.status_code == 403
    assert viewer.get(f"{ADMIN}/export.csv", params={"type": "model"}).status_code == 200


# ---------- stats ----------


def test_stats_overview(client):
    from datetime import date, timedelta

    from app.db import SessionLocal
    from app.models import StatSnapshot

    a = make_model(client, slug="a/a", name="A", downloads=500)
    b = make_model(client, slug="a/b", name="B", downloads=100)
    make_model(client, slug="a/draft", name="Draft", description="")
    for it in (a, b):
        client.post(f"{ADMIN}/content/{it['id']}/publish", json={"version": 1})
    today = date.today()
    with SessionLocal() as db:
        db.add_all(
            [
                StatSnapshot(content_id=a["id"], day=today - timedelta(days=40), downloads=100, likes=0, stars=0),
                StatSnapshot(content_id=a["id"], day=today - timedelta(days=3), downloads=400, likes=0, stars=0),
                StatSnapshot(content_id=b["id"], day=today - timedelta(days=1), downloads=100, likes=0, stars=0),
            ]
        )
        db.commit()

    s = client.get(f"{ADMIN}/stats", params={"days": 30}).json()
    assert s["totals"]["model"]["published"] == 2 and s["totals"]["model"]["downloads"] == 600
    assert len(s["series"]) == 30 and s["hasHistory"] is True
    assert s["series"][0]["downloads"] == 100  # carried forward from before the window
    assert s["series"][-1]["downloads"] == 500  # 400 (a, 3 days ago) + 100 (b, yesterday)
    assert [t["name"] for t in s["top"]] == ["A", "B"]
    assert s["rising"][0] == {**s["rising"][0], "name": "A", "gain": 400}
    assert s["attention"]["drafts"] == 1 and s["attention"]["recentDrafts"][0]["name"] == "Draft"
    assert s["lastSync"] is None


# ---------- activity ----------


def test_audit_search_and_facets(client):
    a = make_model(client, slug="a/a", name="Alpha")
    make_model(client, slug="a/b", name="Beta")
    client.post(f"{ADMIN}/content/{a['id']}/publish", json={"version": 1})
    log = client.get(f"{ADMIN}/audit", params={"q": "alp"}).json()
    assert [e["action"] for e in log["items"]] == ["publish", "create"]
    facets = client.get(f"{ADMIN}/audit/facets").json()
    assert facets["actions"] == ["create", "publish"]
    assert facets["actors"] == ["owner@example.com"]
    from datetime import date, timedelta

    future = (date.today() + timedelta(days=2)).isoformat()
    assert client.get(f"{ADMIN}/audit", params={"since": future}).json()["total"] == 0

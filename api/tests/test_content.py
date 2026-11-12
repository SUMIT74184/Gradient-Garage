from tests.conftest import ADMIN, make_model


def test_create_starts_as_draft_and_is_not_public(client):
    item = make_model(client)
    assert item["status"] == "draft"
    assert item["version"] == 1
    assert item["tags"] == ["english", "LLM"]  # sorted by slug
    assert client.get("/api/v1/public/hub").json()["models"] == []


def test_lifecycle_publish_archive_restore(client):
    item = make_model(client)
    r = client.post(f"{ADMIN}/content/{item['id']}/publish", json={"version": 1})
    assert r.status_code == 200 and r.json()["status"] == "published"
    hub = client.get("/api/v1/public/hub").json()
    assert [m["id"] for m in hub["models"]] == ["acme/nova"]
    assert hub["models"][0]["benchmarks"] == [{"name": "MMLU", "score": 40.1, "unit": "%"}]
    assert "labels" not in hub["models"][0]

    r = client.post(f"{ADMIN}/content/{item['id']}/archive", json={"version": 2})
    assert r.json()["status"] == "archived" and r.json()["archivedAt"]
    assert client.get("/api/v1/public/hub").json()["models"] == []

    # can't publish straight from archive
    assert client.post(f"{ADMIN}/content/{item['id']}/publish", json={"version": 3}).status_code == 409
    r = client.post(f"{ADMIN}/content/{item['id']}/restore", json={"version": 3})
    assert r.json()["status"] == "draft" and r.json()["archivedAt"] is None


def test_duplicate_slug_conflicts_case_insensitively(client):
    make_model(client)
    r = client.post(f"{ADMIN}/content", json={"type": "model", "slug": "ACME/Nova", "name": "x"})
    assert r.status_code == 409
    # same slug in another type is fine
    r = client.post(f"{ADMIN}/content", json={"type": "dataset", "slug": "acme/nova", "name": "x"})
    assert r.status_code == 201


def test_patch_updates_only_sent_fields_and_bumps_version(client):
    item = make_model(client)
    r = client.patch(f"{ADMIN}/content/{item['id']}", json={"version": 1, "description": "Better", "badges": ["new", "new"]})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["description"] == "Better"
    assert out["badges"] == ["new"]
    assert out["name"] == "Nova" and out["benchmarks"][0]["name"] == "MMLU"
    assert out["version"] == 2


def test_patch_with_stale_version_conflicts(client):
    item = make_model(client)
    client.patch(f"{ADMIN}/content/{item['id']}", json={"version": 1, "description": "A"})
    r = client.patch(f"{ADMIN}/content/{item['id']}", json={"version": 1, "description": "B"})
    assert r.status_code == 409
    assert r.json()["currentVersion"] == 2


def test_noop_patch_does_not_create_revision(client):
    item = make_model(client)
    r = client.patch(f"{ADMIN}/content/{item['id']}", json={"version": 1, "name": "Nova"})
    assert r.json()["version"] == 1
    assert len(client.get(f"{ADMIN}/content/{item['id']}/revisions").json()) == 1


def test_patch_validation(client):
    item = make_model(client)
    url = f"{ADMIN}/content/{item['id']}"
    assert client.patch(url, json={"version": 1, "name": None}).status_code == 422  # not nullable
    assert client.patch(url, json={"version": 1, "links": {"myspace": "https://x"}}).status_code == 422
    assert client.patch(url, json={"version": 1, "links": {"github": "javascript:alert(1)"}}).status_code == 422
    assert client.patch(url, json={"version": 1, "modality": "image"}).status_code == 422  # dataset-only field
    assert client.patch(url, json={"version": 1, "baseModel": None}).status_code == 200  # nullable


def test_revisions_and_restore(client):
    item = make_model(client)
    url = f"{ADMIN}/content/{item['id']}"
    client.patch(url, json={"version": 1, "description": "v2 text", "tags": ["vision"]})
    revs = client.get(f"{url}/revisions").json()
    assert [r["version"] for r in revs] == [2, 1]
    assert revs[0]["createdBy"] == "owner@example.com"

    r = client.post(f"{url}/revisions/1/restore", json={"version": 2})
    assert r.status_code == 200
    out = r.json()
    assert out["description"] == "Small LM" and out["tags"] == ["english", "LLM"] and out["version"] == 3
    assert client.get(f"{url}/revisions").json()[0]["note"] == "Restored from v1"


def test_delete_requires_archive(client):
    item = make_model(client)
    url = f"{ADMIN}/content/{item['id']}"
    assert client.delete(url).status_code == 409
    client.post(f"{url}/archive", json={"version": 1})
    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404


def test_list_filters_and_search(client):
    a = make_model(client)
    make_model(client, slug="acme/whisper", name="Whisper Hindi", tags=["speech"], badges=["beta"])
    client.post(f"{ADMIN}/content/{a['id']}/publish", json={"version": 1})

    def ids(**params):
        return [i["slug"] for i in client.get(f"{ADMIN}/content", params=params).json()["items"]]

    assert ids(q="whisper") == ["acme/whisper"]
    assert ids(tag="llm") == ["acme/nova"]
    assert ids(badge="beta") == ["acme/whisper"]
    assert ids(status="published") == ["acme/nova"]
    assert ids(status=["draft", "published"], sort="name") == ["acme/nova", "acme/whisper"]
    assert client.get(f"{ADMIN}/content", params={"sort": "bogus"}).status_code == 422


def test_featured_order_drives_public_order(client):
    slugs = ["a/one", "a/two", "a/three"]
    items = [make_model(client, slug=s, name=s) for s in slugs]
    for it in items:
        client.post(f"{ADMIN}/content/{it['id']}/publish", json={"version": 1})
    client.patch(f"{ADMIN}/content/{items[2]['id']}", json={"version": 2, "featured": True})
    r = client.put(f"{ADMIN}/content/order", json={"type": "model", "ids": [items[1]["id"], items[0]["id"]]})
    assert r.status_code == 204
    assert [m["id"] for m in client.get("/api/v1/public/hub").json()["models"]] == ["a/three", "a/two", "a/one"]


def test_audit_log_records_actions(client):
    item = make_model(client)
    client.patch(f"{ADMIN}/content/{item['id']}", json={"version": 1, "description": "x"})
    client.post(f"{ADMIN}/content/{item['id']}/publish", json={"version": 2})
    log = client.get(f"{ADMIN}/audit", params={"entity_id": item["id"]}).json()
    assert [e["action"] for e in log["items"]] == ["publish", "update", "create"]
    assert log["items"][1]["changes"]["description"] == ["Small LM", "x"]


def test_summary_counts(client):
    a = make_model(client)
    make_model(client, slug="a/b")
    client.post(f"{ADMIN}/content/{a['id']}/publish", json={"version": 1})
    counts = client.get(f"{ADMIN}/content/summary").json()["counts"]
    assert counts["model"] == {"draft": 1, "published": 1, "archived": 0}
    assert counts["demo"] == {"draft": 0, "published": 0, "archived": 0}

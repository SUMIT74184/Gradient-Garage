import pytest

from app.services import sources
from tests.conftest import ADMIN, make_model

HF_MODELS = [
    {
        "id": "acme/nova",
        "downloads": 1200,
        "likes": 30,
        "pipeline_tag": "text-generation",
        "library_name": "transformers",
        "lastModified": "2026-10-01T10:00:00.000Z",
        "tags": ["llm", "license:apache-2.0", "transformers", "safetensors"],
        "safetensors": {"total": 1_100_000_000},
        "cardData": {"license": "apache-2.0"},
    },
    {
        "id": "acme/nova-chat",
        "downloads": 50,
        "likes": 2,
        "pipeline_tag": "text-generation",
        "lastModified": "2026-10-05T00:00:00Z",
        "tags": ["base_model:finetune:acme/nova", "dataset:acme/chat-data"],
    },
]
HF_DATASETS = [
    {
        "id": "acme/chat-data",
        "downloads": 7,
        "likes": 1,
        "lastModified": "2026-09-01T00:00:00Z",
        "tags": ["modality:text", "task_categories:text-generation", "size_categories:1K<n<10K", "license:mit"],
        "description": "Chat pairs.\nMore text",
    }
]
HF_SPACES = [
    {
        "id": "acme/nova-demo",
        "likes": 4,
        "sdk": "gradio",
        "lastModified": "2026-10-06T00:00:00Z",
        "models": ["acme/nova-chat"],
        "subdomain": "acme-nova-demo",
        "cardData": {"title": "Nova demo", "emoji": "💬"},
    }
]


@pytest.fixture
def remote(monkeypatch):
    """Fake remote APIs. Tests mutate the dict to simulate changes on Hugging Face."""
    state = {"models": [dict(m) for m in HF_MODELS], "datasets": list(HF_DATASETS), "spaces": list(HF_SPACES), "fail": set(), "calls": []}

    def fake_get_json(url, headers=None):
        state["calls"].append(url)
        for kind in ("models", "datasets", "spaces"):
            if url.startswith(f"https://huggingface.co/api/{kind}?"):
                if kind in state["fail"]:
                    raise sources.SourceError("huggingface.co returned 503")
                return state[kind] if "author=acme" in url else []
        if url == "https://api.github.com/repos/acme/kit":
            return {"stargazers_count": 99, "pushed_at": "2026-11-01T00:00:00Z", "license": {"spdx_id": "MIT"}}
        if url == "https://pypi.org/pypi/acmekit/json":
            return {"info": {"version": "2.3.0"}}
        return None

    monkeypatch.setattr(sources, "get_json", fake_get_json)
    return state


def configure(client, **over):
    value = {"hfAuthors": ["acme"], "importModels": True, "importDatasets": True, "importDemos": True, "refreshLibraries": True, **over}
    current = client.get(f"{ADMIN}/site").json()["values"].get("sync", {}).get("version", 0)
    r = client.put(f"{ADMIN}/site/sync", json={"version": current, "value": value})
    assert r.status_code == 200, r.text


def sync(client):
    r = client.post(f"{ADMIN}/sync/huggingface")
    assert r.status_code == 200, r.text
    run = r.json()
    assert run["status"] == "succeeded", run
    return run["report"]


def items(client, type_):
    return {i["slug"]: i for i in client.get(f"{ADMIN}/content", params={"type": type_, "status": []}).json()["items"]}


def test_first_sync_imports_everything_as_drafts(client, remote):
    configure(client)
    report = sync(client)
    assert sorted(c["slug"] for c in report["created"]) == ["acme/chat-data", "acme/nova", "acme/nova-chat", "acme/nova-demo"]
    assert report["errors"] == []

    models = items(client, "model")
    nova = models["acme/nova"]
    assert nova["status"] == "draft" and nova["source"] == "huggingface" and nova["hfSyncedAt"]
    assert nova["params"] == "1.1B" and nova["license"] == "apache-2.0" and nova["downloads"] == 1200
    assert nova["tags"] == ["llm"] and nova["contentDate"] == "2026-10-01"
    chat = models["acme/nova-chat"]
    assert chat["kind"] == "fine-tuned" and chat["baseModel"] == "acme/nova" and chat["datasets"] == ["acme/chat-data"]

    ds = items(client, "dataset")["acme/chat-data"]
    assert ds["modality"] == "text" and ds["size"] == "1K–10K rows" and ds["description"] == "Chat pairs."
    demo = items(client, "demo")["acme/nova-demo"]
    assert demo["embedUrl"] == "https://acme-nova-demo.hf.space" and demo["models"] == ["acme/nova-chat"] and demo["emoji"] == "💬"

    # drafts aren't public until someone publishes them
    assert client.get("/api/v1/public/hub").json()["models"] == []
    actions = [e["action"] for e in client.get(f"{ADMIN}/audit").json()["items"]]
    assert actions.count("sync.import") == 4 and "sync.run" in actions


def test_resync_keeps_admin_edits_and_refreshes_the_rest(client, remote):
    configure(client)
    sync(client)
    nova = items(client, "model")["acme/nova"]
    r = client.patch(f"{ADMIN}/content/{nova['id']}", json={"version": nova["version"], "description": "Our flagship"})
    assert r.json()["editedFields"] == ["description"]
    edited_version = r.json()["version"]

    remote["models"][0].update(downloads=5000, pipeline_tag="text2text-generation", cardData={"license": "mit"})
    report = sync(client)
    assert [(u["slug"], u["fields"]) for u in report["updated"]] == [("acme/nova", ["license", "task"])]

    nova = items(client, "model")["acme/nova"]
    assert nova["description"] == "Our flagship"  # the admin's edit stuck
    assert nova["license"] == "mit" and nova["task"] == "text2text-generation"
    assert nova["downloads"] == 5000
    assert nova["version"] == edited_version + 1  # metadata change = one new version


def test_stats_only_change_is_silent(client, remote):
    configure(client)
    sync(client)
    before = items(client, "model")["acme/nova"]
    remote["models"][0]["downloads"] = 9999
    report = sync(client)
    assert report["updated"] == [] and report["refreshed"] == 1
    after = items(client, "model")["acme/nova"]
    assert after["downloads"] == 9999
    assert after["version"] == before["version"] and after["updatedAt"] == before["updatedAt"]
    assert len(client.get(f"{ADMIN}/content/{after['id']}/revisions").json()) == 1


def test_local_items_get_live_stats_but_keep_their_metadata(client, remote):
    local = make_model(client, slug="acme/nova", name="Nova (ours)", description="Hand written", downloads=1)
    configure(client)
    report = sync(client)
    assert "acme/nova" not in [c["slug"] for c in report["created"]]
    nova = items(client, "model")["acme/nova"]
    assert nova["id"] == local["id"] and nova["source"] == "local"
    assert nova["name"] == "Nova (ours)" and nova["description"] == "Hand written" and nova["task"] == "text-generation"
    assert nova["downloads"] == 1200 and nova["likes"] == 30


def test_released_override_follows_hf_again(client, remote):
    configure(client)
    sync(client)
    nova = items(client, "model")["acme/nova"]
    nova = client.patch(f"{ADMIN}/content/{nova['id']}", json={"version": nova["version"], "license": "custom"}).json()
    r = client.post(f"{ADMIN}/content/{nova['id']}/overrides/reset", json={"version": nova["version"], "fields": ["license"]})
    assert r.status_code == 200 and r.json()["editedFields"] == []
    sync(client)
    assert items(client, "model")["acme/nova"]["license"] == "apache-2.0"


def test_missing_items_are_reported_not_deleted(client, remote):
    configure(client)
    sync(client)
    remote["models"] = remote["models"][:1]
    report = sync(client)
    assert [m["slug"] for m in report["missing"]] == ["acme/nova-chat"]
    assert "acme/nova-chat" in items(client, "model")


def test_failed_fetch_is_reported_and_nothing_marked_missing(client, remote):
    configure(client)
    sync(client)
    remote["fail"].add("models")
    report = sync(client)
    assert any("models for acme" in e for e in report["errors"])
    assert report["missing"] == []


def test_disabled_types_are_not_fetched(client, remote):
    configure(client, importDatasets=False, importDemos=False)
    report = sync(client)
    assert {c["type"] for c in report["created"]} == {"model"}
    assert not any("/api/datasets" in u or "/api/spaces" in u for u in remote["calls"])


def test_library_stats_refresh(client, remote):
    lib = client.post(
        f"{ADMIN}/content",
        json={"type": "library", "slug": "acmekit", "name": "acmekit", "repo": "acme/kit", "pypi": "acmekit", "stars": 3},
    ).json()
    configure(client, hfAuthors=[])
    report = sync(client)
    assert report["libraries"] == 1
    out = client.get(f"{ADMIN}/content/{lib['id']}").json()
    assert out["stars"] == 99 and out["packageVersion"] == "2.3.0" and out["license"] == "mit"
    assert out["contentDate"] == "2026-11-01" and out["version"] == 1


def test_sync_needs_editor_and_settings_need_owner(client, remote):
    from tests.conftest import as_role

    viewer = as_role("viewer")
    assert viewer.post(f"{ADMIN}/sync/huggingface").status_code == 403
    editor = as_role("editor")
    assert editor.put(f"{ADMIN}/site/sync", json={"version": 0, "value": {"hfAuthors": ["x"]}}).status_code == 403
    assert editor.post(f"{ADMIN}/sync/huggingface").status_code == 200


def test_sync_settings_are_not_public(client, remote):
    configure(client)
    assert "sync" not in client.get("/api/v1/public/site").json()
    status = client.get(f"{ADMIN}/sync").json()
    assert status["settings"]["hfAuthors"] == ["acme"] and status["saved"] is True
    assert status["tokens"] == {"huggingface": False, "github": False}


def test_concurrent_run_is_refused(client, remote):
    from app.db import SessionLocal
    from app.models import SyncRun

    with SessionLocal() as db:
        db.add(SyncRun(status="running", trigger="manual"))
        db.commit()
    r = client.post(f"{ADMIN}/sync/huggingface")
    assert r.status_code == 409


def test_sync_records_daily_snapshots(client, remote):
    configure(client)
    sync(client)
    sync(client)  # same day: updates in place
    from sqlalchemy import func, select

    from app.db import SessionLocal
    from app.models import StatSnapshot

    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(StatSnapshot)) == 4


def test_mapping_helpers():
    assert sources.format_params(22_000_000) == "22M"
    assert sources.format_params(1_100_000_000) == "1.1B"
    assert sources.format_params(None) is None
    assert sources._size_category("n<1K") == "< 1K"
    assert sources.pretty_name("whisper_small-hi") == "Whisper Small Hi"

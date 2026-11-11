from tests.conftest import ADMIN, make_model


def test_labels_are_internal_only(client):
    lb = client.post(f"{ADMIN}/labels", json={"name": "Needs benchmark", "color": "#eab308"}).json()
    item = make_model(client, labelIds=[lb["id"]])
    assert item["labels"][0]["name"] == "Needs benchmark"
    client.post(f"{ADMIN}/content/{item['id']}/publish", json={"version": 1})
    public = client.get("/api/v1/public/hub").json()["models"][0]
    assert "labelIds" not in public and "labels" not in public
    assert client.get(f"{ADMIN}/content", params={"label": lb["id"]}).json()["total"] == 1
    assert client.get(f"{ADMIN}/labels").json()[0]["count"] == 1


def test_unknown_label_id_rejected(client):
    r = client.post(
        f"{ADMIN}/content",
        json={"type": "model", "slug": "a/b", "name": "b", "labelIds": ["00000000-0000-0000-0000-000000000000"]},
    )
    assert r.status_code == 422


def test_label_name_unique_and_color_validated(client):
    client.post(f"{ADMIN}/labels", json={"name": "Review"})
    assert client.post(f"{ADMIN}/labels", json={"name": "review"}).status_code == 409
    assert client.post(f"{ADMIN}/labels", json={"name": "X", "color": "red"}).status_code == 422


def test_tag_rename_and_merge(client):
    make_model(client, slug="a/one", tags=["llm"])
    make_model(client, slug="a/two", tags=["LLMs", "llm"])
    tags = {t["slug"]: t for t in client.get(f"{ADMIN}/tags").json()}
    assert tags["llm"]["count"] == 2 and tags["llms"]["count"] == 1

    # renaming onto an existing slug must go through merge
    assert client.patch(f"{ADMIN}/tags/{tags['llms']['id']}", json={"name": "llm"}).status_code == 409
    r = client.post(f"{ADMIN}/tags/{tags['llms']['id']}/merge", json={"intoId": tags["llm"]["id"]})
    assert r.status_code == 200
    tags = client.get(f"{ADMIN}/tags").json()
    assert [(t["slug"], t["count"]) for t in tags] == [("llm", 2)]

    r = client.patch(f"{ADMIN}/tags/{tags[0]['id']}", json={"name": "Large Language Model"})
    assert r.json()["slug"] == "large-language-model"


def test_admin_hidden_when_dev_mode_off(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "admin_dev_mode", False)
    assert client.get(f"{ADMIN}/content").status_code == 404
    assert client.get("/api/v1/public/hub").status_code == 200

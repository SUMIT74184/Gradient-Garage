import io

from PIL import Image

from tests.conftest import ADMIN, make_model


def png(w=4, h=3, fmt="PNG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (240, 122, 42)).save(buf, format=fmt)
    return buf.getvalue()


def upload(client, data=None, name="cover.png", alt="Orange"):
    return client.post(f"{ADMIN}/media", files={"file": (name, data or png(), "image/png")}, data={"alt": alt})


def test_upload_serves_file_and_records_size(client):
    r = upload(client)
    assert r.status_code == 201, r.text
    m = r.json()
    assert (m["width"], m["height"], m["contentType"]) == (4, 3, "image/png")
    assert m["url"].startswith("/media/") and m["url"].endswith(".png")
    f = client.get(m["url"])
    assert f.status_code == 200 and f.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert f.headers["x-content-type-options"] == "nosniff"


def test_upload_rejects_non_images_and_svg(client):
    assert upload(client, data=b"<?php echo 1; ?>", name="x.png").status_code == 422
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    assert upload(client, data=svg, name="x.svg").status_code == 422
    # extension lies are ignored: a JPEG named .png is stored as .jpg
    r = upload(client, data=png(fmt="JPEG"), name="trick.png")
    assert r.json()["url"].endswith(".jpg") and r.json()["contentType"] == "image/jpeg"


def test_cover_image_on_item_and_public(client):
    m = upload(client).json()
    item = make_model(client, coverMediaId=m["id"])
    assert item["cover"]["url"] == m["url"]
    client.post(f"{ADMIN}/content/{item['id']}/publish", json={"version": 1})
    pub = client.get("/api/v1/public/hub").json()["models"][0]
    assert pub["cover"] == {"url": m["url"], "alt": "Orange", "width": 4, "height": 3}

    # in use → can't delete; listed with its usage
    assert client.delete(f"{ADMIN}/media/{m['id']}").status_code == 409
    listed = client.get(f"{ADMIN}/media").json()[0]
    assert listed["usage"][0]["kind"] == "cover"

    client.patch(f"{ADMIN}/content/{item['id']}", json={"version": 2, "coverMediaId": None})
    assert client.delete(f"{ADMIN}/media/{m['id']}").status_code == 204
    assert client.get(m["url"]).status_code == 404


def test_unknown_cover_rejected(client):
    r = client.post(
        f"{ADMIN}/content",
        json={"type": "model", "slug": "a/b", "name": "b", "coverMediaId": "00000000-0000-0000-0000-000000000000"},
    )
    assert r.status_code == 422


def test_site_content_versioning_and_validation(client):
    assert client.get("/api/v1/public/site").json() == {}
    faq = {"items": [{"q": "Free?", "a": "Yes."}]}
    r = client.put(f"{ADMIN}/site/landing.faq", json={"version": 0, "value": faq})
    assert r.status_code == 200 and r.json()["version"] == 1
    assert client.get("/api/v1/public/site").json() == {"landing.faq": faq}

    # stale version
    assert client.put(f"{ADMIN}/site/landing.faq", json={"version": 0, "value": faq}).status_code == 409
    # bad shapes
    assert client.put(f"{ADMIN}/site/landing.faq", json={"version": 1, "value": {"items": [{"q": ""}]}}).status_code == 422
    assert client.put(f"{ADMIN}/site/nope", json={"version": 0, "value": {}}).status_code == 404
    feats = {"items": [{"title": "a", "body": "b"}]}  # must be exactly four
    assert client.put(f"{ADMIN}/site/landing.features", json={"version": 0, "value": feats}).status_code == 422
    scene = {"src": "https://evil.example/x.jpg", "title": "", "credit": "", "href": ""}
    hero = {"headlineTop": "a", "headlineBottom": "b", "primaryCta": "Go", "secondaryCta": "Star", "scenes": [scene]}
    assert client.put(f"{ADMIN}/site/landing.hero", json={"version": 0, "value": hero}).status_code == 422

    client.put(f"{ADMIN}/site/landing.faq", json={"version": 1, "value": {"items": []}})
    revs = client.get(f"{ADMIN}/site/landing.faq/revisions").json()
    assert [r["version"] for r in revs] == [2, 1]
    r = client.post(f"{ADMIN}/site/landing.faq/revisions/1/restore", json={"version": 2})
    assert r.json()["value"] == faq and r.json()["version"] == 3


def test_site_image_reference_counts_as_usage(client):
    m = upload(client).json()
    image = {"src": m["url"], "title": "Elephant", "credit": "me", "href": ""}
    value = {"title": "Pull {words}", "words": ["LLM"], "image": image}
    assert client.put(f"{ADMIN}/site/landing.tryIt", json={"version": 0, "value": value}).status_code == 200
    r = client.delete(f"{ADMIN}/media/{m['id']}")
    assert r.status_code == 409 and r.json()["usage"] == [{"kind": "site", "key": "landing.tryIt"}]

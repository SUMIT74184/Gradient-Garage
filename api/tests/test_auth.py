from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import ADMIN, as_role, make_user, make_model

AUTH = "/api/v1/auth"
INTERNAL = {"X-Internal-Secret": "test-internal-secret"}


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_password_login_me_logout(anon):
    make_user("ada@example.com", "editor", "a long password 1")
    r = anon.post(f"{AUTH}/login", json={"email": " ADA@example.com ", "password": "a long password 1"})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    me = anon.get(f"{AUTH}/me", headers=bearer(token)).json()
    assert me["email"] == "ada@example.com" and me["role"] == "editor" and me["hasPassword"]
    assert anon.post(f"{AUTH}/logout", headers=bearer(token)).status_code == 204
    assert anon.get(f"{AUTH}/me", headers=bearer(token)).status_code == 401


def test_wrong_password_and_unknown_email_look_the_same(anon):
    make_user("ada@example.com", "editor", "a long password 1")
    a = anon.post(f"{AUTH}/login", json={"email": "ada@example.com", "password": "nope"})
    b = anon.post(f"{AUTH}/login", json={"email": "ghost@example.com", "password": "nope"})
    assert a.status_code == b.status_code == 401 and a.json() == b.json()


def test_login_rate_limited(anon):
    make_user("ada@example.com", "editor", "a long password 1")
    for _ in range(5):
        assert anon.post(f"{AUTH}/login", json={"email": "ada@example.com", "password": "x"}).status_code == 401
    r = anon.post(f"{AUTH}/login", json={"email": "ada@example.com", "password": "a long password 1"})
    assert r.status_code == 429


def test_disabled_user_cannot_sign_in_and_loses_sessions(client):
    uid, token = make_user("bob@example.com", "editor", "a long password 1")
    assert client.patch(f"{ADMIN}/users/{uid}", json={"isActive": False}).status_code == 200
    with TestClient(app) as anon:
        assert anon.get(f"{AUTH}/me", headers=bearer(token)).status_code == 401
        assert anon.post(f"{AUTH}/login", json={"email": "bob@example.com", "password": "a long password 1"}).status_code == 401


def test_roles(client):
    item = make_model(client)
    viewer, editor = as_role("viewer"), as_role("editor")
    # viewer: read only
    assert viewer.get(f"{ADMIN}/content").status_code == 200
    assert viewer.patch(f"{ADMIN}/content/{item['id']}", json={"version": 1, "name": "x"}).status_code == 403
    assert viewer.post(f"{ADMIN}/tags", json={"name": "x"}).status_code == 403
    # editor: edit + publish, landing copy, but not delete / site identity / team
    assert editor.post(f"{ADMIN}/content/{item['id']}/archive", json={"version": 1}).status_code == 200
    assert editor.delete(f"{ADMIN}/content/{item['id']}").status_code == 403
    assert editor.put(f"{ADMIN}/site/landing.footer", json={"version": 0, "value": {"note": "hi"}}).status_code == 200
    site = {"name": "X", "mark": "x"}
    assert editor.put(f"{ADMIN}/site/site", json={"version": 0, "value": site}).status_code == 403
    assert editor.get(f"{ADMIN}/users").status_code == 403
    # owner
    assert client.put(f"{ADMIN}/site/site", json={"version": 0, "value": site}).status_code == 200
    assert client.delete(f"{ADMIN}/content/{item['id']}").status_code == 204


def test_invite_flow(client, anon):
    r = client.post(f"{ADMIN}/invites", json={"email": "New@Example.com", "role": "viewer"})
    assert r.status_code == 201
    token = r.json()["token"]
    assert anon.get(f"{AUTH}/invites/{token}").json()["email"] == "new@example.com"
    assert anon.post(f"{AUTH}/invites/{token}/accept", json={"name": "New", "password": "short"}).status_code == 422
    r = anon.post(f"{AUTH}/invites/{token}/accept", json={"name": "New", "password": "a long password 1"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "viewer"
    # single use
    assert anon.get(f"{AUTH}/invites/{token}").status_code == 404
    # inviting an existing member is refused
    assert client.post(f"{ADMIN}/invites", json={"email": "new@example.com"}).status_code == 409


def test_reinvite_revokes_old_link(client, anon):
    t1 = client.post(f"{ADMIN}/invites", json={"email": "x@example.com"}).json()["token"]
    client.post(f"{ADMIN}/invites", json={"email": "x@example.com"})
    assert anon.get(f"{AUTH}/invites/{t1}").status_code == 404


def test_reset_link_signs_out_everywhere(client, anon):
    uid, old = make_user("ada@example.com", "editor", "a long password 1")
    token = client.post(f"{ADMIN}/users/{uid}/reset-link").json()["token"]
    assert anon.get(f"{AUTH}/reset/{token}").json()["email"] == "ada@example.com"
    r = anon.post(f"{AUTH}/reset/{token}", json={"password": "another long one 2"})
    assert r.status_code == 200
    assert anon.get(f"{AUTH}/me", headers=bearer(old)).status_code == 401
    assert anon.post(f"{AUTH}/reset/{token}", json={"password": "another long one 3"}).status_code == 404
    assert anon.post(f"{AUTH}/login", json={"email": "ada@example.com", "password": "another long one 2"}).status_code == 200


def test_oauth_requires_internal_secret_and_existing_account(anon):
    body = {"provider": "github", "providerUserId": "42", "email": "ada@example.com", "emailVerified": True}
    assert anon.post(f"{AUTH}/oauth", json=body).status_code == 403  # no secret
    make_user("ada@example.com", "editor", None)
    r = anon.post(f"{AUTH}/oauth", json=body, headers=INTERNAL)
    assert r.status_code == 200 and r.json()["user"]["providers"] == ["github"]
    # later sign-ins match by provider id even if the email changed
    r = anon.post(f"{AUTH}/oauth", json={**body, "email": "new@else.com"}, headers=INTERNAL)
    assert r.json()["user"]["email"] == "ada@example.com"
    assert anon.post(f"{AUTH}/oauth", json={**body, "providerUserId": "9", "emailVerified": False}, headers=INTERNAL).status_code == 403


def test_oauth_invite_must_match_email(client, anon):
    token = client.post(f"{ADMIN}/invites", json={"email": "ada@example.com", "role": "editor"}).json()["token"]
    body = {"provider": "google", "providerUserId": "g1", "emailVerified": True, "inviteToken": token}
    assert anon.post(f"{AUTH}/oauth", json={**body, "email": "eve@example.com"}, headers=INTERNAL).status_code == 403
    r = anon.post(f"{AUTH}/oauth", json={**body, "email": "ada@example.com", "name": "Ada"}, headers=INTERNAL)
    assert r.status_code == 200 and r.json()["user"]["role"] == "editor"


def test_last_owner_protected(client):
    users = client.get(f"{ADMIN}/users").json()
    me = users[0]
    # can't change yourself
    assert client.patch(f"{ADMIN}/users/{me['id']}", json={"role": "editor"}).status_code == 409
    uid, _ = make_user("o2@example.com", "owner")
    assert client.patch(f"{ADMIN}/users/{uid}", json={"role": "editor"}).status_code == 200


def test_change_password_keeps_current_session(anon):
    _, token = make_user("ada@example.com", "editor", "a long password 1")
    h = bearer(token)
    assert anon.post(f"{AUTH}/me/password", json={"currentPassword": "wrong", "newPassword": "a new long one 22"}, headers=h).status_code == 422
    assert anon.post(f"{AUTH}/me/password", json={"currentPassword": "a long password 1", "newPassword": "a new long one 22"}, headers=h).status_code == 204
    assert anon.get(f"{AUTH}/me", headers=h).status_code == 200

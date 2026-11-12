from tests.conftest import ADMIN, as_role, make_model, make_user, outbox_links

AUTH = "/api/v1/auth"
INTERNAL = {"X-Internal-Secret": "test-internal-secret"}
PW = "a long member password"


def bearer(t):
    return {"Authorization": f"Bearer {t}"}


def signup(anon, email="vis@example.com"):
    r = anon.post(f"{AUTH}/signup", json={"name": "Vis", "email": email, "password": PW})
    assert r.status_code == 200, r.text
    return r.json()


def published(client, slug="acme/nova"):
    item = make_model(client, slug=slug)
    client.post(f"{ADMIN}/content/{item['id']}/publish", json={"version": 1})
    return item


def test_signup_creates_member_and_sends_verification(anon):
    out = signup(anon)
    assert out["user"]["role"] == "member" and not out["user"]["emailVerified"] and not out["user"]["isTeam"]
    tokens = outbox_links("/verify/")
    assert len(tokens) == 1
    assert anon.post(f"{AUTH}/verify/{tokens[0]}").json()["email"] == "vis@example.com"
    assert anon.get(f"{AUTH}/me", headers=bearer(out["token"])).json()["emailVerified"]
    # single use
    assert anon.post(f"{AUTH}/verify/{tokens[0]}").status_code == 404


def test_signup_validation_and_duplicates(anon):
    assert anon.post(f"{AUTH}/signup", json={"email": "x@example.com", "password": "short"}).status_code == 422
    assert anon.post(f"{AUTH}/signup", json={"email": "not-an-email", "password": PW}).status_code == 422
    signup(anon)
    assert anon.post(f"{AUTH}/signup", json={"email": "VIS@example.com", "password": PW}).status_code == 409


def test_members_cannot_use_admin(anon):
    tok = signup(anon)["token"]
    assert anon.get(f"{ADMIN}/content", headers=bearer(tok)).status_code == 403
    assert anon.get(f"{ADMIN}/site", headers=bearer(tok)).status_code == 403


def test_resend_verification_rate_limited(anon):
    tok = signup(anon)["token"]  # 1st email
    assert anon.post(f"{AUTH}/me/verify", headers=bearer(tok)).status_code == 204
    assert anon.post(f"{AUTH}/me/verify", headers=bearer(tok)).status_code == 204
    assert anon.post(f"{AUTH}/me/verify", headers=bearer(tok)).status_code == 429


def test_forgot_password_never_reveals_accounts(anon):
    assert anon.post(f"{AUTH}/password/forgot", json={"email": "ghost@example.com"}).status_code == 204
    assert outbox_links("/reset/") == []
    signup(anon)
    assert anon.post(f"{AUTH}/password/forgot", json={"email": "vis@example.com"}).status_code == 204
    token = outbox_links("/reset/")[-1]
    assert anon.post(f"{AUTH}/reset/{token}", json={"password": "a brand new password"}).status_code == 200
    assert anon.post(f"{AUTH}/login", json={"email": "vis@example.com", "password": "a brand new password"}).status_code == 200


def test_oauth_signup_and_unverified_takeover_protection(anon):
    # An attacker registers the victim's address with a password but can't confirm it
    attacker = signup(anon, "victim@example.com")["token"]
    body = {"provider": "google", "providerUserId": "g-victim", "email": "victim@example.com", "emailVerified": True}
    r = anon.post(f"{AUTH}/oauth", json=body, headers=INTERNAL)
    assert r.status_code == 200
    me = r.json()["user"]
    assert me["emailVerified"] and not me["hasPassword"] and me["providers"] == ["google"]
    # attacker's session and password are gone
    assert anon.get(f"{AUTH}/me", headers=bearer(attacker)).status_code == 401
    assert anon.post(f"{AUTH}/login", json={"email": "victim@example.com", "password": PW}).status_code == 401
    # brand-new visitor via GitHub becomes a member
    r = anon.post(f"{AUTH}/oauth", json={**body, "provider": "github", "providerUserId": "77", "email": "new@example.com"}, headers=INTERNAL)
    assert r.json()["user"]["role"] == "member"


def test_bookmarks_and_recently_viewed(client, anon):
    published(client)
    tok = signup(anon)["token"]
    h = bearer(tok)
    ref = {"type": "model", "id": "ACME/nova"}
    assert anon.put(f"{AUTH}/me/bookmarks", json={**ref, "saved": True}, headers=h).status_code == 204
    assert anon.put(f"{AUTH}/me/bookmarks", json={**ref, "saved": True}, headers=h).status_code == 204  # idempotent
    assert anon.get(f"{AUTH}/me/state", headers=h).json()["bookmarks"] == [{"type": "model", "id": "acme/nova"}]
    for _ in range(3):
        anon.post(f"{AUTH}/me/views", json=ref, headers=h)
    lib = anon.get(f"{AUTH}/me/library", headers=h).json()
    assert lib["saved"][0]["item"]["id"] == "acme/nova"
    assert lib["recent"][0]["views"] == 3
    # drafts / unknown items can't be saved
    assert anon.put(f"{AUTH}/me/bookmarks", json={"type": "model", "id": "nope/x"}, headers=h).status_code == 404
    anon.put(f"{AUTH}/me/bookmarks", json={**ref, "saved": False}, headers=h)
    anon.delete(f"{AUTH}/me/views", headers=h)
    assert anon.get(f"{AUTH}/me/library", headers=h).json() == {"saved": [], "recent": []}


def test_delete_own_account(anon, client):
    tok = signup(anon)["token"]
    h = bearer(tok)
    assert anon.post(f"{AUTH}/me/delete", json={"password": "wrong"}, headers=h).status_code == 422
    assert anon.post(f"{AUTH}/me/delete", json={"password": PW}, headers=h).status_code == 204
    assert anon.get(f"{AUTH}/me", headers=h).status_code == 401
    # team accounts can't delete themselves
    assert client.post(f"{AUTH}/me/delete", json={"password": "correct horse battery"}).status_code == 409


def test_owner_sees_members_and_can_promote(client, anon):
    signup(anon)
    members = client.get(f"{ADMIN}/users", params={"scope": "members"}).json()
    assert [m["email"] for m in members] == ["vis@example.com"]
    assert all(u["isTeam"] for u in client.get(f"{ADMIN}/users").json())
    # inviting an existing member points to promotion instead
    assert client.post(f"{ADMIN}/invites", json={"email": "vis@example.com"}).status_code == 409
    r = client.patch(f"{ADMIN}/users/{members[0]['id']}", json={"role": "editor"})
    assert r.status_code == 200 and r.json()["isTeam"]


def test_invite_and_owner_reset_are_emailed(client):
    client.post(f"{ADMIN}/invites", json={"email": "team@example.com", "role": "editor"})
    assert len(outbox_links("/admin/invite/")) == 1
    uid, _ = make_user("ed@example.com", "editor")
    client.post(f"{ADMIN}/users/{uid}/reset-link")
    assert len(outbox_links("/reset/")) == 1


def test_viewer_role_still_reads_admin():
    assert as_role("viewer").get(f"{ADMIN}/content").status_code == 200

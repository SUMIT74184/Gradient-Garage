import os

# Must be set before the app (and its engine) is imported
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://gg:gg@127.0.0.1:5433/gg_test")
os.environ["INTERNAL_API_SECRET"] = "test-internal-secret"
os.environ["ENV"] = "test"
import tempfile  # noqa: E402

os.environ["MEDIA_DIR"] = tempfile.mkdtemp(prefix="gg-media-")
os.environ["OUTBOX_DIR"] = OUTBOX = tempfile.mkdtemp(prefix="gg-outbox-")
os.environ["SMTP_HOST"] = ""

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402

API_DIR = os.path.dirname(os.path.dirname(__file__))


@pytest.fixture(scope="session", autouse=True)
def migrated():
    cfg = Config(os.path.join(API_DIR, "alembic.ini"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def clean_db():
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    yield


def make_user(email="owner@example.com", role="owner", password="correct horse battery"):
    """Create a team member directly and return (user_id, session token)."""
    from app.db import SessionLocal
    from app.models import Role, User
    from app.services import auth

    with SessionLocal() as db:
        user = User(email=email, name=email.split("@")[0], role=Role(role))
        db.add(user)
        db.flush()
        if password:
            auth.set_password(user, password)
        token, _ = auth.create_session(db, user)
        db.commit()
        return str(user.id), token


@pytest.fixture
def anon():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def client():
    """Signed in as an Owner."""
    _, token = make_user()
    with TestClient(app, headers={"Authorization": f"Bearer {token}"}) as c:
        yield c


def as_role(role: str):
    _, token = make_user(email=f"{role}@example.com", role=role)
    return TestClient(app, headers={"Authorization": f"Bearer {token}"})


ADMIN = "/api/v1/admin"


def make_model(client, **over):
    body = {
        "type": "model",
        "slug": "acme/nova",
        "name": "Nova",
        "description": "Small LM",
        "task": "text-generation",
        "tags": ["LLM", "english"],
        "benchmarks": [{"name": "MMLU", "score": 40.1, "unit": "%"}],
        "links": {"huggingface": "https://huggingface.co/acme/nova"},
        **over,
    }
    r = client.post(f"{ADMIN}/content", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def outbox_links(path_prefix: str) -> list[str]:
    """Tokens from links like {app_url}{path_prefix}<token> in emails written to the outbox, newest last."""
    import email
    import email.policy
    import re
    from pathlib import Path

    tokens = []
    for f in sorted(Path(OUTBOX).glob("*.eml"), key=lambda p: p.stat().st_mtime_ns):
        msg = email.message_from_bytes(f.read_bytes(), policy=email.policy.default)
        text = msg.get_body(preferencelist=("plain",)).get_content()
        tokens += re.findall(re.escape(path_prefix) + r"([A-Za-z0-9_\-]{20,})", text)
    return tokens


@pytest.fixture(autouse=True)
def clean_outbox():
    from pathlib import Path

    for f in Path(OUTBOX).glob("*.eml"):
        f.unlink()
    yield

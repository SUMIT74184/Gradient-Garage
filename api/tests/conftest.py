import os

# Must be set before the app (and its engine) is imported
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://gg:gg@127.0.0.1:5433/gg_test")
os.environ["ADMIN_DEV_MODE"] = "true"
os.environ["ENV"] = "test"

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


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


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

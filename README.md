# Gradient Garage

Open-source hub for ML models, fine-tunes, datasets, demos and libraries, with an admin panel in progress.

| Folder | What |
|---|---|
| `web/` | Next.js 16 site (public pages; admin UI lands at `/admin` in Phase 3). See `web/README.md`. |
| `api/` | FastAPI + Postgres: content, lifecycle, tags/labels, revisions, activity log |
| `docs/admin-panel-plan.md` | The admin panel plan and phase checklist |

## Run locally

```bash
docker compose up -d db                 # Postgres on 127.0.0.1:5433

cd api
python3 -m venv --copies .venv && .venv/bin/pip install -e '.[dev]'
cp .env.example .env                    # ADMIN_DEV_MODE=true exposes /api/v1/admin without sign-in
.venv/bin/alembic upgrade head
.venv/bin/python -m scripts.seed        # loads the current sample content, published
.venv/bin/uvicorn app.main:app --reload # http://localhost:8000/docs

cd ../web && npm install && npm run dev # http://localhost:3000
```

Tests: `cd api && .venv/bin/pytest` (uses the `gg_test` database the compose file creates).

Re-export seed data after editing `web/src/data/*.ts`: `node web/scripts/export-seed.mjs`.

> The admin API has **no sign-in yet** (Phase 6). It only runs with `ADMIN_DEV_MODE=true`, and the app refuses to start that way when `ENV=production`.

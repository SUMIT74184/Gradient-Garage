# Gradient Garage

Open-source hub for ML models, fine-tunes, datasets, demos and libraries, with an admin panel at `/admin`.

| Folder | What |
|---|---|
| `web/` | Next.js 16 site: public pages + the admin panel at `/admin`. See `web/README.md`. |
| `api/` | FastAPI + Postgres: content, lifecycle, tags/labels, revisions, activity log |
| `docs/admin-panel-plan.md` | The admin panel plan and phase checklist |
| `docs/deploy.md` | Production deploy (Docker Compose + Caddy HTTPS) |

## Run locally

```bash
docker compose up -d db                 # Postgres on 127.0.0.1:5433

cd api
python3 -m venv --copies .venv && .venv/bin/pip install -e '.[dev]'
cp .env.example .env                    # set INTERNAL_API_SECRET (same value in web/.env.local)
.venv/bin/alembic upgrade head
.venv/bin/python -m scripts.seed        # loads the current sample content, published
.venv/bin/python -m scripts.create_owner you@example.com   # prints your sign-up link
.venv/bin/uvicorn app.main:app --reload # http://localhost:8000/docs

cd ../web && npm install
cp .env.example .env.local             # API_URL, INTERNAL_API_SECRET, optional GitHub/Google keys
npm run dev                             # site: http://localhost:3000  admin: http://localhost:3000/admin
```

Hugging Face sync: set the accounts in **Admin → Hugging Face sync** (or `HF_USERNAME` in `api/.env`) and press "Sync now". To run it daily, add a cron line such as `0 4 * * * cd /path/to/api && .venv/bin/python -m scripts.sync --quiet`.

Tests: `cd api && .venv/bin/pytest` (uses the `gg_test` database the compose file creates).

Re-export seed data after editing `web/src/data/*.ts`: `node web/scripts/export-seed.mjs`.

> `next build` prerenders the homepage from the API, so the API must be running during a build.

> Everyone signs in at `/login`. Anyone can sign up at `/signup` (member account); the team joins by invite. Without SMTP settings, emails land in `api/outbox/`.

> On this drive (NTFS) `next dev` may not notice edits to existing files; restart it if a page looks stale.

# Gradient Garage — Admin Panel Plan

_Written 2026-11-11. Decisions below come from the planning Q&A._

## 1. Decisions

| Topic | Decision |
|---|---|
| Storage | **Postgres** (hosted Supabase/Neon in prod, Docker locally) |
| Backend | **FastAPI** (Python), SQLAlchemy 2 + Alembic, Pydantic v2 |
| Frontend | Existing **Next.js 16** site; admin lives at `/admin` in the same app |
| Repo | **Monorepo**: `web/` (Next.js), `api/` (FastAPI), `docs/`, `docker-compose.yml` |
| Admin users | **Small team with roles**: Owner / Editor / Viewer, invite-only |
| Sign-in | Email + password, GitHub OAuth, Google OAuth — **built last** (Phase 6) |
| Hosting | Not decided → keep everything host-agnostic (S3-compatible uploads, env-based config, Dockerfile) |
| Editable | 4 content types, site settings, landing copy, media uploads |
| Labels | Free tags, status badges, internal-only labels, featured + pinned order |
| Lifecycle | **Draft → Published → Archived** (restore from archive; hard delete = Owner only) |
| Hugging Face | **Import + override**: sync imports as drafts, admin edits stick, live stats keep updating |
| Extras | Activity log, version history + restore, bulk actions + CSV import/export, dashboard stats |
| Admin look | Matches site theme (navy/orange), calm and dense: sidebar, tables, forms, side drawer |

## 2. Architecture

```
            ┌─────────────── web/ (Next.js) ────────────────┐
 visitors → │ public pages  ──GET /api/v1/public/hub──┐     │
 team     → │ /admin/*      ──/api/v1/admin/* ────────┤     │
            └─────────────────────────────────────────┼─────┘
                                                      ▼
                                        api/ (FastAPI) ── Postgres
                                          │   ├─ HF sync job (models/datasets/spaces)
                                          │   └─ media → S3-compatible bucket (local disk in dev)
```

- The **public site** reads published content only, from one cached endpoint that returns the same `Hub` shape the components already use. Components barely change.
- The Hugging Face merge currently in `web/src/lib/*.ts` moves to the API as a **sync job**, so the database is the single source of truth.
- Until Phase 6, admin routes run in **dev mode only**: the API refuses to expose them unless `ADMIN_DEV_MODE=true` and `ENV != production`, and every write is attributed to a seeded dev Owner.

## 3. Data model

Joined-table inheritance: a shared `content_items` row + a type table per kind. Tags, labels, revisions and bulk actions all work on `content_items`, so they treat all four types the same way.

**content_items** (shared by all four types)
`id uuid` · `type` (model|dataset|demo|library) · `slug` (public id, e.g. `owner/name`; unique per type) · `name` · `description` · `links jsonb` · `status` (draft|published|archived) · `badges text[]` (new, beta, updated, deprecated, coming_soon) · `featured bool` · `sort_order int` · `source` (local|huggingface) · `edited_fields text[]` (HF sync won't overwrite these) · `hf_synced_at` · `content_date` (the "updated" date shown publicly) · `version int` (optimistic locking) · `published_at` · `archived_at` · `created_at/by` · `updated_at/by`

**Type tables**
- `models`: author, task, kind, base_model, datasets[], params, license, library, downloads, likes, capabilities[], usage + `benchmarks` child table (name, score, unit, lower_is_better, position)
- `datasets`: author, modality, task, size, class_labels[], license, downloads, likes, notes
- `demos`: sdk, url, embed_url, models[], emoji, likes
- `libraries`: language, install, repo, pypi, npm, version, stars, license, features[], usage, used_by[]

**Taxonomy**
- `tags` (name, slug) + `content_tags` — public, shared list, rename/merge
- `labels` (name, color, description) + `content_labels` — internal only, never sent to the public API

**History & site**
- `revisions` (entity_type, entity_id, version, snapshot jsonb, note, created_by/at): one per write, so any version can be restored
- `audit_log` (actor, action, entity_type/id/label, changes jsonb diff, created_at)
- `site_content` (key, value jsonb, version): `site`, `sections`, `landing.hero`, `landing.manifesto`, `landing.features`, `landing.faq`, …
- `users` (email, name, role, is_active); auth tables (`credentials`, `oauth_accounts`, `sessions`, `invites`) come in Phase 6
- `media` (storage_key, filename, mime, size, width, height, alt): Phase 4

## 4. API surface (`/api/v1`)

**Public**
- `GET /public/hub`: published items, `Hub` shape (camelCase), featured first then sort_order
- `GET /public/site`: settings, section names, landing copy (Phase 4)

**Admin**
- `GET /admin/content?type&status&q&tag&label&badge&featured&source&sort&page&page_size`
- `POST /admin/content`: create (starts as draft)
- `GET|PATCH|DELETE /admin/content/{id}`: PATCH needs `version` (409 on conflict); DELETE is Owner only and the item must be archived first
- `POST /admin/content/{id}/{publish|unpublish|archive|restore}`
- `GET /admin/content/{id}/revisions` · `POST /admin/content/{id}/revisions/{v}/restore`
- `PUT /admin/content/order`: set featured/pinned order for a type
- `POST /admin/content/bulk`: publish/archive/restore/tag/untag/label/badge on many ids (Phase 5)
- `GET /admin/export.csv` · `POST /admin/import`: dry-run preview, then commit (Phase 5)
- `/admin/tags` CRUD + `POST /admin/tags/{id}/merge` · `/admin/labels` CRUD
- `/admin/site/{key}` GET/PUT (Phase 4) · `/admin/media` upload/list/delete (Phase 4)
- `POST /admin/sync/huggingface` (Phase 5) · `GET /admin/stats` (Phase 5) · `GET /admin/audit`
- `/admin/users` + invites (Phase 6)

**Roles:** Viewer = read everything in admin · Editor = create/edit/publish/archive, manage tags, labels and media · Owner = everything plus hard delete, users, site settings, HF sync config.

## 5. Admin UI (`web/src/app/admin`)

- **Shell**: left sidebar (Overview, Checkpoints, Playground, Corpus, Toolkit, Tags & Labels, Media, Site, Landing, Activity, Users), top bar with ⌘K search and the user menu
- **List screen** (one generic table for each type): status tabs (Drafts / Published / Archived / All), search, filters (tag, label, badge, featured, source, task/modality), sortable columns, row checkboxes → bulk bar, colored label dots, badge chips, "HF" source marker
- **Edit drawer / page**: grouped form sections (Basics, Classification, Links, Benchmarks/Features, Usage snippet with code editor, Media, Labels & badges), autosave of drafts, a "Preview as public card" panel, and Publish / Archive buttons with confirmation. Fields set by HF show a lock or override toggle
- **Featured order**: drag and drop list per type
- **Tags & Labels**: manage, rename, merge, color picker, usage counts
- **History tab**: revision list → side-by-side diff → Restore
- **Site / Landing**: forms for settings and section names, plus repeatable editors for FAQ, feature cards and hero copy
- **Media library**: upload, alt text, used-in list
- **Overview**: counts by status, drafts needing attention, internal labels like "needs benchmark", top downloads, downloads-over-time chart (stats snapshot table)
- **Activity**: filterable log (who, what, when, diff)

## 6. Phases

| # | Phase | Contents | Done when |
|---|---|---|---|
| **1** | **Backend foundation** | Monorepo, docker-compose Postgres, FastAPI app, models + Alembic migration, seed from current `src/data`, public hub endpoint, admin content CRUD + lifecycle, tags, labels, badges, featured order, revisions, audit log, tests | `pytest` green; `/public/hub` returns the same items the site shows today |
| 2 | Public site on API | `web` fetches `/public/hub` (keeping the static data as fallback), removes HF merge from web, cache revalidation hook when admin publishes | Site looks identical, data comes from Postgres |
| 3 | Admin UI: content | `/admin` shell, list tables, edit forms for all 4 types, lifecycle buttons, tags/labels/badges, featured order | Team can fully manage content in the browser |
| 4 | Site, landing, media | `site_content` editors, landing copy moved out of components, media upload (local/S3) + cover images | No content left hard-coded in components |
| 5 | Power features | HF import+override sync, bulk actions, CSV import/export, version diff/restore UI, activity log UI, overview stats + chart | Extras checklist complete |
| 6 | Auth + roles + deploy | Email/password (argon2, reset, invites), GitHub + Google OAuth (invite allow-list), httpOnly session cookies, CSRF, role checks, rate limiting, users screen; Dockerfiles, deploy guide for the chosen host | Dev mode removed; prod deploy works |

## 7. Progress

**Phase 1 — done (2026-11-11)**
- Site moved to `web/`; `api/` + `docker-compose.yml` added
- Schema: 14 tables, one Alembic migration (up/down tested, `alembic check` clean)
- API: public hub, content CRUD + lifecycle, optimistic locking, revisions + restore, featured order, tags (rename/merge), internal labels, audit log
- Seed: `web/scripts/export-seed.mjs` → `api/seed/*.json` → `python -m scripts.seed` (all 20 sample items, published, labelled "Sample data")
- 18 tests, including a parity test: seeded `/public/hub` equals today's static data

**Phase 2 — done (2026-11-11)**
- `web/src/lib/hub.ts`: with `API_URL` set, the site reads `/api/v1/public/hub` (`"use cache"`, tag `hub`, 1 min revalidate); without it, the old static + Hugging Face path still works
- Admin server actions call `updateTag("hub")`, so changes show on the site immediately
- Public cards show status badges; the catalog's default sort is now "Featured" (featured, then pinned order, then downloads)
- While `API_URL` is set, Hugging Face items are no longer merged in the web app; that moves to the API sync in Phase 5

**Phase 3 — done (2026-11-11)**
- `/admin` (only when `ADMIN_DEV_MODE=true`): Overview, one list per section, create/edit forms for all 4 types, Featured & order, Tags & labels
- Lists: status tabs (Active / Drafts / Published / Archived / All), search, tag/label/badge/featured filters, sorting, pagination, row actions (publish, unpublish, archive, restore, delete forever for archived items)
- Editor: grouped fields per type, benchmarks editor, links, badges, featured, content date, tags with suggestions, internal labels, lifecycle buttons, history with compare + restore, conflict banner on stale saves, sticky save bar, Ctrl/Cmd+S, unsaved-changes warning
- `next build` passes (Cache Components / partial prerendering)

**Phase 4 — done (2026-11-11)**
- Media library (`/admin/media`): upload (JPEG/PNG/WebP/GIF ≤ 10 MB, checked with Pillow, SVG refused), alt text, usage list, delete blocked while in use
- Cover images on items (shown on model and demo cards)
- Site settings (`/admin/site`): name, logo mark, tagline, author, GitHub URL, license, section names
- Landing copy (`/admin/landing`): hero + background scenes, "Runs on" strip, manifesto, what-is, try-it (+ photo), quote, feature cards, open-source call-out, FAQ, footer. Each block saves on its own, with history, restore and "Reset to built-in". Text supports `*orange*`, `_dim_`, `~underline~`, `` `code` ``, `{placeholders}`
- Defaults live in `web/src/lib/content/defaults.ts`; the API stores only saved overrides

**Phase 5 — done (2026-11-12)**
- Hugging Face sync (`/admin/sync`): imports models → Checkpoints, datasets → Corpus, Spaces → Playground as **drafts**; on synced items, fields follow Hugging Face until an admin edits them (`edited_fields`), and the editor's "Hugging Face sync" card hands a field back ("Use HF value"). Live stats (downloads, likes, stars, versions, dates) refresh on every item, local ones too, without a new version or "edited" time. Items gone from Hugging Face are reported, never deleted. One run at a time (advisory lock); every run is kept with its report
- Settings (Owner): accounts + what to sync, stored as site key `sync` (never in the public API). Tokens stay in `api/.env` (`HF_TOKEN`, `GITHUB_TOKEN`). Scheduled runs: `python -m scripts.sync --quiet` from cron
- Toolkit stars / PyPI + npm versions moved from the web app into the sync (the web app only fetches them in static mode)
- Bulk actions: checkboxes (shift-click ranges) → publish, archive, restore, unpublish, feature, tags, internal labels, badges, delete forever (Owner, archived only). Per-item results; items that can't take an action are listed, the rest still go through
- CSV: "Export CSV" per section; "Import CSV" previews every row (new draft / update / no change / error) and applies all rows or none. Matches on slug, changes only the columns in the file, neutralises spreadsheet formulas
- Overview: downloads / likes / stars totals with 30-day change, downloads chart (from daily `stat_snapshots`, carried forward over gaps), most downloaded, rising, needs-attention list, last sync
- Activity (`/admin/activity`): filters by action, area, person, dates and item name; expandable before → after diffs
- Version compare + restore was already done in Phase 3
- 26 new API tests (74 total); remote APIs are faked in tests

**Phase 6 — done (2026-11-11), except real GitHub/Google keys**
- Sign-in: email + password (argon2, lockout after 5 failures / 15 min), GitHub and Google (PKCE, verified email, invite-only); 30-day sliding sessions in an httpOnly cookie
- Team (`/admin/team`, Owners): invite links (7 days), roles Owner / Editor / Viewer, disable, sign out, password-reset links (24 h); the last Owner can't be removed
- Account (`/admin/account`): name, password, connect/disconnect GitHub/Google, sign out everywhere
- Roles enforced by the API on every route and reflected in the UI
- Deployment: `api/Dockerfile`, `web/Dockerfile` (standalone), `docker-compose.prod.yml` with Caddy HTTPS, `docs/deploy.md`
- Dev mode (`ADMIN_DEV_MODE`) removed; first Owner via `python -m scripts.create_owner`

**Public accounts — done (2026-11-11), awaiting your browser test**
- `/signup` and `/login` work: email + password (confirmation email), GitHub, Google. New people get a `member` role with no admin access; the team still joins by invite
- One login page for everyone; team members land in `/admin`, members on `/account`. `/admin/login` redirects to `/login`
- `/forgot-password` → email with a reset link (`/reset/<token>`); `/verify/<token>` confirms the address with one click
- `/account`: saved items, recently viewed (counted when an item's drawer opens), profile, password, connected accounts, sign out everywhere, delete account (members)
- Drawer "☆ Save" button; navbar avatar menu (Saved, Account, Admin panel for the team, Sign out)
- Email over SMTP (Resend / Postmark / Gmail…); without SMTP_HOST, emails are saved to `api/outbox/*.eml`
- Owners see site members on the Team page and can give them a team role
- Security: unconfirmed password accounts are taken over safely by a verified Google/GitHub sign-in; forgot-password doesn't reveal which emails exist; email and sign-up rate limits

Notes: with `API_URL` set, library GitHub stars and PyPI/npm versions come from the sync job; `web/src/lib/libraries.ts` only fetches them in static mode.

## 8. Open items (decide later)

- Hosting target (affects media bucket and where the API runs; see Phase 6)
- SMTP credentials for real email (code is ready; dev writes to api/outbox)
- GitHub / Google OAuth keys (code is in place, untested against the real providers)

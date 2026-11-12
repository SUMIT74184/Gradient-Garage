# Deploying Gradient Garage

One VPS (any provider) with Docker runs everything: Postgres, the API, the website and
Caddy for automatic HTTPS. Only ports 80/443 are public; the API listens on the server's
loopback only.

## 1. Server and DNS

- A Linux server with Docker + Docker Compose v2 (1 vCPU / 2 GB RAM is plenty to start).
- A DNS `A` record for your domain (e.g. `hub.example.com`) pointing at the server.

## 2. Configure

```bash
git clone <your repo> gradient-garage && cd gradient-garage
cp .env.production.example .env.production
# fill in DOMAIN, POSTGRES_PASSWORD, INTERNAL_API_SECRET (and GitHub/Google keys if wanted)
```

GitHub sign-in: create an OAuth App at https://github.com/settings/developers with callback
`https://<DOMAIN>/auth/github/callback`. Google: create a Web OAuth client in Google Cloud
with redirect URI `https://<DOMAIN>/auth/google/callback`. Leave the keys empty to hide a button.

## 3. Start

```bash
C="docker compose -f docker-compose.prod.yml --env-file .env.production"

$C up -d --build db api                         # migrations run automatically on start
$C exec api python -m scripts.seed              # optional: load the sample content
$C build web && $C up -d web caddy              # the web build reads the API on 127.0.0.1:8000
$C exec api python -m scripts.create_owner you@example.com --site https://<DOMAIN>
```

Open the printed link, set your password, and you're in at `https://<DOMAIN>/admin`.
Invite the rest of the team from **Team**.

## 4. Update

```bash
git pull
$C up -d --build api
$C build web && $C up -d web
```

## 5. Backups

```bash
$C exec -T db pg_dump -U gg gg | gzip > backup-$(date +%F).sql.gz            # database
docker run --rm -v gradient-garage_media:/m -v "$PWD":/b alpine tar czf /b/media-$(date +%F).tgz -C /m .   # uploads
```

(The media volume is named `<folder>_media`; check with `docker volume ls`.)

## Notes

- Email isn't set up: invite and password-reset links are shown to the Owner to send
  themselves. Adding an email provider later is a small change.
- Uploads live in the `media` volume on this server. Moving to S3/R2 means adding a backend
  to `api/app/storage.py`.
- Vercel or similar: the website can run there, but the API + Postgres still need a host
  (e.g. Railway, Render, Fly.io); point `API_URL` at it and keep the API private behind
  `INTERNAL_API_SECRET`.

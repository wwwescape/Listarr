<p align="center">
  <img src="frontend/public/Listarr.png" alt="Listarr logo" width="120" />
</p>

<h1 align="center">Listarr</h1>

A self-hosted, real-time shopping list app — for anything, not just groceries. Create lists,
share them with your household, and edit together live.

## Features

- **Real-time collaboration** — list and item changes sync live over Socket.IO to every open
  tab/device viewing that list, no refresh needed.
- **Offline-first, including writes** — a local IndexedDB database (Dexie) is the actual
  source of truth on-device; edits made while offline queue in an outbox and replay
  automatically on reconnect, with temporary IDs remapped to server IDs once synced.
- **Households, not just single-user** — create Homes, invite members, and assign roles
  (owner/member); every list belongs to a Home so a household shares one catalog and one set
  of lists.
- **Smart quick-add** — type `2kg potatoes` or `3x eggs` and it's parsed into quantity, unit,
  and name automatically.
- **Categories, buying areas, and a shared catalog** — items remember their usual category and
  where you buy them, and are suggested from recents/favourites next time.
- **Dashboard** — completion rate, most-purchased items, category breakdown, and activity
  over time.
- **CSV import/export** for list items.
- **Share-to-list** — send text/a link from any app on your phone straight into a Listarr list
  via the OS share sheet (PWA `share_target`).
- **PWA** — installable, works offline, Material 3 design with light/dark mode and responsive
  navigation (bottom bar / rail / drawer depending on screen size).
- **JWT auth** (access + refresh tokens) — no public registration; users are created by an
  admin (or via the one-time first-run setup screen).

## Prerequisites

- Git: https://git-scm.com/downloads
- Node.js 22+: https://nodejs.org/en/download/current
- Python 3.12+: https://www.python.org/downloads/

## Install

```
git clone https://github.com/wwwescape/Listarr.git
cd Listarr
npm install
cd backend
python -m venv venv
venv\Scripts\activate          # Windows; use `source venv/bin/activate` on macOS/Linux
pip install -r requirements-dev.txt
cd ..
```

## Configure

Create a `.env` file in the project root (see `.env.example`):

```
JWT_SECRET_KEY=   # generate with: python -c "import secrets; print(secrets.token_hex(32))"
```

Everything else is optional with sane defaults — see `.env.example` for `DATABASE_URL`
(defaults to a local SQLite file) and `CORS_ORIGINS` (defaults to the Vite dev server).

## Set up the database

```
cd backend
alembic upgrade head
```

There's no CLI admin script — the app handles first-run setup itself. The first time you
open it with no users yet, it redirects to `/setup` and shows a create-admin-user form
directly in the browser.

## Run (development)

Two processes, two terminals, from the project root:

```
cd backend && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000
```

```
npm start
```

The frontend runs on `http://localhost:3000` (Vite) and talks to the backend on
`http://localhost:8000` (FastAPI) — CORS is pre-configured for this pair. Log in with the
admin account you create on first run (see above).

## Test

```
npm run lint && npm run typecheck && npm test && npm run build
cd backend && ruff check . && pytest
```

## Deploy with Docker

A single container builds the frontend and serves it from the same FastAPI process as the
API (one origin, no separate frontend container/proxy split needed):

```
cp .env.example .env   # fill in JWT_SECRET_KEY
docker compose up -d --build
```

The app is then at `http://localhost:8000` (override with `APP_PORT` in `.env`). Migrations
run automatically on container start. The SQLite database lives in a named volume (`db-data`
→ `/app/backend/db`), so it survives `docker compose down`/recreates and
upgrades — only `docker compose down -v` removes it.

If you're fronting this with your own reverse proxy/TLS, make sure it forwards WebSocket
upgrades (`Connection: Upgrade`) for `/socket.io/*` — real-time sync won't work without it.

## Upgrading

Schema changes ship as Alembic migrations, applied automatically — there's no separate
upgrade step beyond getting the new code running:

- **Docker**: `git pull && docker compose up -d --build`. The entrypoint runs `alembic
  upgrade head` before the app starts, every time the container starts. Your data lives in
  the named volume described above, not in the container itself.
- **Bare metal**: `git pull`, reinstall dependencies if `requirements.txt`/`package.json`
  changed (`pip install -r requirements-dev.txt`, `npm install`), then run `cd backend &&
  alembic upgrade head` before starting the app again.

## Project layout

```
frontend/   TypeScript, Vite, MUI, Dexie (offline-first) — own package.json
backend/    FastAPI, SQLAlchemy, Alembic, python-socketio (SQLite by default) — own requirements.txt
docs/       developer guide
```

See [docs/developer-guide.md](docs/developer-guide.md) for conventions and where to add
things, [frontend/README.md](frontend/README.md) for frontend-specific notes, and
[CONTRIBUTING.md](CONTRIBUTING.md) if you're sending a PR.

## License

GPL-3.0 — see `LICENSE`.

## Support

If you find Listarr useful, consider buying me a coffee:

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40" />](https://buymeacoffee.com/wwwescape)

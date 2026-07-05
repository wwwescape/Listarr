<p align="center">
  <img src="frontend/public/Listarr.png" alt="Listarr logo" width="120" />
</p>

<h1 align="center">Listarr</h1>

<p align="center">
  A self-hosted, real-time shopping list app — for anything, not just groceries. Create lists,
  share them with your household, and edit them together live, even offline.
</p>

<p align="center">
  <a href="https://github.com/wwwescape/Listarr/releases"><img src="https://img.shields.io/github/v/release/wwwescape/Listarr.svg?style=flat-square" alt="GitHub release" /></a>
  <a href="https://github.com/wwwescape/Listarr/commits/main"><img src="https://img.shields.io/github/last-commit/wwwescape/Listarr.svg?style=flat-square" alt="GitHub last commit" /></a>
  <a href="https://github.com/wwwescape/Listarr"><img src="https://img.shields.io/github/languages/code-size/wwwescape/Listarr.svg?color=red&style=flat-square" alt="GitHub code size" /></a>
</p>

## Features

- **Real-time collaboration** — list and item changes sync live to every open tab and device
  viewing that list, with no refresh needed.
- **Offline-first, including edits** — everything is stored on the device first. Changes made
  offline are queued and synced automatically when you reconnect.
- **Households** — create Homes, invite members, and give them roles (owner or member). Every
  list belongs to a Home, so a household shares one catalog and one set of lists.
- **Smart quick-add** — type `2kg potatoes` or `3x eggs`, and it's split into quantity, unit,
  and name automatically.
- **Shared catalog** — items remember their usual category and where you buy them, and are
  suggested from recents and favourites next time.
- **Dashboard** — completion rate, most-purchased items, category breakdown, and activity over
  time.
- **CSV import/export** for list items.
- **Share to a list** — send text or a link from any app on your phone straight into a Listarr
  list from the share sheet.
- **PWA** — installable, works offline, with Material 3 design, light and dark mode, and
  responsive navigation.
- **Private by design** — no public registration. The first admin is created on first run, and
  everyone else is added by an admin.

## Installation

The published Docker image bundles the frontend and backend into a single container. Create a
`docker-compose.yml`:

```yaml
services:
  app:
    image: wwwescape/listarr:latest
    container_name: listarr
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - db-data:/app/backend/db
    restart: unless-stopped

volumes:
  db-data:
```

Create a `.env` file next to it (see [Configuration](#configuration)), then start it:

```bash
docker compose up -d
```

Open `http://localhost:8000`. The first visit takes you to `/setup` to create the admin
account. Migrations run automatically on startup, and the database lives in the `db-data`
volume, so it survives restarts and upgrades.

If you put Listarr behind your own reverse proxy, make sure it forwards WebSocket upgrades for
`/socket.io/*`, or real-time sync won't work.

### Upgrading

```bash
docker compose pull && docker compose up -d
```

Running from source instead? `git pull`, reinstall dependencies if they changed, then run
`alembic upgrade head` from `backend/` before starting the app.

## Configuration

Settings live in `.env` (see [.env.example](.env.example)). Only a JWT secret is required:

```env
JWT_SECRET_KEY=   # generate with: python -c "import secrets; print(secrets.token_hex(32))"
```

Optional: `DATABASE_URL` (a local SQLite file by default), `CORS_ORIGINS` (the Vite dev server
by default), and `APP_PORT` (`8000` by default, used by the repo's own `docker-compose.yml`).

## Development

Requires [Git](https://git-scm.com/downloads), [Node.js 22+](https://nodejs.org/en/download/current),
and [Python 3.12+](https://www.python.org/downloads/).

```bash
git clone https://github.com/wwwescape/Listarr.git
cd Listarr
npm install
cd backend
python -m venv venv
venv\Scripts\activate          # Windows; use `source venv/bin/activate` on macOS/Linux
pip install -r requirements-dev.txt
alembic upgrade head
```

Create `.env` in the project root as described in [Configuration](#configuration), then run the
backend and frontend in two terminals:

```bash
cd backend && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000
```

```bash
npm start
```

The frontend runs on `http://localhost:3000` and talks to the backend on
`http://localhost:8000`. The repo's own `docker-compose.yml` builds the image from source
(`docker compose up -d --build`).

### Test

```bash
npm run lint && npm run typecheck && npm test && npm run build
cd backend && ruff check . && pytest
```

### Release a new version

```bash
git tag v1.1.0
git push origin v1.1.0
```

The tag push publishes the Docker image to GHCR and Docker Hub (tagged with the version and
`latest`) and creates a GitHub Release. Publishing to Docker Hub needs the `DOCKERHUB_USERNAME`
and `DOCKERHUB_TOKEN` repository secrets.

### Project layout

```
frontend/   TypeScript, Vite, MUI, Dexie (offline-first) — own package.json
backend/    FastAPI, SQLAlchemy, Alembic, python-socketio (SQLite by default) — own requirements.txt
docs/       Developer guide
```

See [docs/developer-guide.md](docs/developer-guide.md) for conventions,
[frontend/README.md](frontend/README.md) for frontend notes, and
[CONTRIBUTING.md](CONTRIBUTING.md) if you're sending a PR.

## License

GPL-3.0 — see [LICENSE](LICENSE).

## Support

If you find Listarr useful, consider buying me a coffee:

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40" />](https://buymeacoffee.com/wwwescape)

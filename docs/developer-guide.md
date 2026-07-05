# Developer Guide

## Prerequisites

- Python 3.12+
- Node.js 22+
- Docker + Docker Compose (optional, for container testing)

## Repository layout

```
listarr/
├── backend/              FastAPI app (Python)
│   ├── app/
│   │   ├── api/          routes → services → repositories
│   │   ├── core/         config, logging, security
│   │   ├── db/           session, base, types, backfill
│   │   ├── models/       SQLAlchemy ORM models
│   │   ├── schemas/      Pydantic schemas
│   │   └── services/     business logic
│   ├── alembic/          database migrations
│   ├── db/               SQLite file (git-ignored; created on first run)
│   └── tests/            pytest suite
├── frontend/             TypeScript + Vite + React app
│   ├── api/               typed axios functions per resource
│   ├── components/        page-level and shared components
│   ├── navigation/         bottom bar, nav rail, nav drawer, breadcrumbs
│   ├── theme/              Material You (M3) theme builder
│   ├── db.ts               Dexie (IndexedDB) local database — offline source of truth
│   ├── sync.ts             outbox/mutation-queue engine — talks to the API, drives db.ts
│   ├── appSettings.ts      user preferences (theme, accent color, default sort/area)
│   └── sw.js               PWA service worker (hand-written, injectManifest strategy)
├── build/                Vite output (git-ignored; created by `npm run build`)
├── docs/                 this file
├── .env.example          template for the one .env the whole project reads
├── Dockerfile            multi-stage build (Node → Python)
└── docker-compose.yml    single `app` service + named volume
```

## Backend setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements-dev.txt
```

Copy the env template and set a secret key:

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET_KEY to the output of:
python -c "import secrets; print(secrets.token_hex(32))"
```

Run migrations and start the server:

```bash
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Auth setup

There's no CLI admin script — the app itself handles first-run setup. If no users exist yet,
navigating to the frontend redirects to `/setup`, which shows a create-admin-user form
directly in the browser (`frontend/components/Setup.tsx` + `CreateUser.tsx`). After that,
log in normally at `/login`.

### Running backend tests

```bash
cd backend
pytest                          # runs with coverage (see pyproject.toml)
pytest --no-cov                 # skip coverage (faster during development)
pytest tests/test_lists_routes.py  # single file
```

Coverage floor is 90% (branch coverage, see `pyproject.toml`).

### Linting

```bash
cd backend
ruff check .
ruff check . --fix   # auto-fix safe rules
```

### Database migrations

```bash
# After changing a model:
alembic revision --autogenerate -m "describe what changed"
alembic upgrade head

# Inspect history
alembic history
alembic current
```

## Frontend setup

From the **repo root** (not `frontend/`):

```bash
npm install    # installs root devDeps + frontend workspace
npm start      # Vite dev server on :3000
```

The backend must also be running (`:8000`) — dev is **cross-origin**, not proxied: the
frontend calls the backend directly (see `frontend/api/client.ts`'s `API_BASE_URL`), and the
backend's CORS allow-list (`cors_origins` in `.env`/`core/config.py`) permits `:3000` by
default.

### Running frontend tests

```bash
npm test               # Vitest, single run
npm run test:watch     # watch mode
npm run test:coverage  # with V8 coverage report
```

### Type checking and linting

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
```

### Building for production

```bash
npm run build   # outputs to build/ (repo root, served by FastAPI)
```

Then start the backend — it auto-detects and serves from `build/` when that directory exists.

## Architecture notes

### Backend layering

Routes call services, services call repositories. Repositories only `add`/`flush`/`delete` —
they never commit; services own the transaction boundary and are the only place that calls
`db.commit()`. Routes raise nothing directly — `NotFoundError`/`ForbiddenError`/`ConflictError`
(from `app/services/exceptions.py`) are translated to HTTP responses by exception handlers
registered once in `main.py`.

### Schemas

Plain Pydantic `BaseModel`s, not a camelCase-aliased base — field casing matches whatever the
original API contract already used field-by-field (e.g. `ListOut.createdBy` is camelCase but
`home_id`/`created_at` are snake_case). This is inherited from the app's pre-migration
Sequelize-era JSON shape and is intentionally left as-is rather than normalized, since
changing it would be a breaking API/frontend change with no functional benefit.

### Auth flow

1. `POST /api/auth/login` → returns an access token (15 min) + refresh token (30 days)
2. Frontend stores both in `localStorage` (`frontend/api/tokenStorage.ts`)
3. Axios interceptor (`frontend/api/client.ts`) attaches `Authorization: Bearer <accessToken>`
   on every request
4. On 401, the interceptor tries `POST /api/auth/refresh` once, then redirects to `/login`
5. Concurrent requests during a refresh are queued and replayed after the new token arrives

### Offline-write architecture (Dexie + outbox)

This is Listarr's core feature and has no equivalent in sibling projects — most apps in this
family only cache *reads* offline; Listarr supports offline *writes*.

- **`db.ts`**: a Dexie (IndexedDB) database that is the actual local source of truth for
  lists, items, categories, areas, and home data — not just a cache of the last server
  response.
- **`sync.ts`**: hydrates `db.ts` from the API on load/reconnect, and queues every mutation
  made while offline in an `outbox` table (with a temporary client-side ID). On reconnect,
  `drainOutbox()` replays queued mutations against the real API in order and remaps temp IDs
  to the server-assigned ones everywhere they're referenced locally.
- Conflicts (e.g. editing an item deleted elsewhere) and permanent failures surface through
  `syncEvents` (an `EventTarget`) rather than throwing — `OfflineStatusIndicator` and toasts
  subscribe to these to tell the user what happened.

If you're touching either file, test the actual offline path manually (devtools → Network →
Offline), not just the online path — this is the piece of the app most likely to regress
silently under type-checking alone.

### Real-time sync (Socket.IO)

Also Listarr-specific. `backend/app/socket_manager.py` runs a `python-socketio` server
wrapped around the FastAPI app (`socketio.ASGIApp` intercepts `/socket.io/*` before FastAPI
ever sees it). Clients join a room per list (`joinList`); list/item mutations emit events from
the **service** layer (after a successful commit, never from the route) so every open tab
viewing that list updates live. `cors_allowed_origins="*"` is intentionally permissive here —
the socket carries no cookies/credentials, so this doesn't have the ambient-authority problem
`CORSMiddleware`'s allow-list is guarding against for the REST API.

### PWA

`vite-plugin-pwa` runs in `injectManifest` mode (not the simpler `generateSW`), because
`sw.js` is hand-written to support background-sync message handling
(`SYNC_OUTBOX`) that a generated service worker wouldn't have. `sw.js` is deliberately kept as
plain JS, not TypeScript — the service worker global scope conflicts with the main
`tsconfig.json`'s DOM lib.

## Docker

Build and run locally:

```bash
docker compose up --build
```

The Dockerfile is multi-stage:
1. **`frontend-builder`** (Node 22): `npm ci` + `npm run build` → outputs to `/app/build`
2. **Python 3.12**: copies `backend/` + `/app/build`, runs as non-root `appuser`

The container exposes port 8000 internally (mapped to `8000` on the host by default, see
`APP_PORT` in `docker-compose.yml`). Uvicorn serves the API and the built frontend from one
process — `GET /healthz` reports DB connectivity, `GET /assets/*` and unmatched paths fall
back to the SPA's `index.html`. A named volume (`db-data`, mounted onto the `db/`
directory) persists data across restarts and rebuilds.

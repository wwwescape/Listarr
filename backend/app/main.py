from pathlib import Path

import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import areas as area_routes
from app.api.routes import auth as auth_routes
from app.api.routes import categories as category_routes
from app.api.routes import health as health_routes
from app.api.routes import homes as home_routes
from app.api.routes import items as item_routes
from app.api.routes import lists as list_routes
from app.api.routes import locations as location_routes
from app.api.routes import stats as stats_routes
from app.api.routes import test as test_routes
from app.api.routes import users as user_routes
from app.core.config import REPO_ROOT, get_settings
from app.core.logging import configure_logging
from app.db.backfill import backfill_first_admin, backfill_home_owners
from app.db.session import SessionLocal
from app.seed import seed_defaults
from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.socket_manager import sio

FRONTEND_BUILD_DIR = REPO_ROOT / "build"


def resolve_static_file(base_dir: Path, requested_path: str) -> Path | None:
    """Returns the real file under base_dir to serve for requested_path, or None if it
    should fall back to index.html (SPA client-side route, or nothing matched).

    requested_path is attacker-controlled - resolving and confirming the result is still
    inside base_dir (rather than trusting the joined path directly) is what stops a request
    like "../../etc/passwd" from escaping base_dir to serve arbitrary filesystem contents.
    """
    if not requested_path:
        return None
    candidate = (base_dir / requested_path).resolve()
    if candidate.is_relative_to(base_dir) and candidate.is_file():
        return candidate
    return None


configure_logging()
settings = get_settings()

fastapi_app = FastAPI(title="Listarr API")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@fastapi_app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@fastapi_app.exception_handler(ForbiddenError)
async def forbidden_handler(request: Request, exc: ForbiddenError) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@fastapi_app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


fastapi_app.include_router(health_routes.router)
fastapi_app.include_router(auth_routes.router)
fastapi_app.include_router(test_routes.router)
fastapi_app.include_router(item_routes.router)
fastapi_app.include_router(category_routes.router)
fastapi_app.include_router(area_routes.router)
fastapi_app.include_router(location_routes.router)
fastapi_app.include_router(user_routes.router)
fastapi_app.include_router(list_routes.router)
fastapi_app.include_router(stats_routes.router)
fastapi_app.include_router(home_routes.router)


@fastapi_app.on_event("startup")
def on_startup():
    # Schema is owned by Alembic now (see alembic/ — run `alembic upgrade head`
    # before starting the app, docker-entrypoint.sh does this in containers).
    # Only idempotent data fixups happen here.
    db = SessionLocal()
    try:
        seed_defaults(db)
        backfill_first_admin(db)
        backfill_home_owners(db)
    finally:
        db.close()


# Serves the built frontend (npm run build's output) from the same origin as the API.
# Guarded by existence so a backend-only dev run (frontend served separately by Vite on
# :3000, or the test suite, neither of which ever produce a build/ directory) is
# unaffected. Registered last so it never shadows the /api/* or /healthz routes above —
# Starlette matches routes in registration order.
if FRONTEND_BUILD_DIR.is_dir():
    fastapi_app.mount("/assets", StaticFiles(directory=FRONTEND_BUILD_DIR / "assets"), name="frontend-assets")

    @fastapi_app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str) -> FileResponse:
        static_file = resolve_static_file(FRONTEND_BUILD_DIR, full_path)
        return FileResponse(static_file if static_file is not None else FRONTEND_BUILD_DIR / "index.html")


# Mount Socket.IO's ASGI app around FastAPI. This must be the object passed
# to Uvicorn — socketio.ASGIApp intercepts /socket.io/... before FastAPI ever
# sees it, then forwards everything else to `other_asgi_app`.
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

# Multi-stage build: stage 1 builds the frontend (Vite), stage 2 runs the FastAPI backend
# and serves that build from the same origin (see backend/app/main.py's serve_frontend()).
# The container's /app mirrors the repo's own backend/ + build/ sibling layout, since
# backend/app/core/config.py derives REPO_ROOT (and therefore where it looks for build/)
# relative to backend/'s own location — see FRONTEND_BUILD_DIR in backend/app/main.py.

FROM node:22-slim AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY frontend ./frontend
RUN npm run build

# python:3.12-slim (glibc) rather than alpine: bcrypt and other C-extension deps have solid
# manylinux wheel coverage but spottier musllinux coverage, which can force a from-source
# build requiring a Rust toolchain on alpine.
FROM python:3.12-slim
WORKDIR /app/backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-builder /app/build /app/build

RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz', timeout=3).status == 200 else 1)"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

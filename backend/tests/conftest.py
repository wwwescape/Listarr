import os
from datetime import UTC, datetime

# Must happen before any `app.core.config` import anywhere in the test session — Settings
# is read once and cached, so the secret needs to exist before the first import, not
# inside a fixture (which would run too late for module-level imports in test files).
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-do-not-use-outside-pytest")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import get_settings
from app.core.security import hash_password
from app.main import fastapi_app as app
from app.models import Base, User

get_settings.cache_clear()


@pytest.fixture()
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{(tmp_path / 'test.db').as_posix()}")
    Base.metadata.create_all(engine)
    session = Session(bind=engine)
    yield session
    session.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def test_user(db_session):
    now = datetime.now(UTC)
    user = User(
        username="admin",
        firstname="Admin",
        lastname="User",
        password=hash_password("correct-password"),
        admin=True,
        status="active",
        createdAt=now,
        updatedAt=now,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture()
def auth_client(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    token = login.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client

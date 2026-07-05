from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session as DBSession

from app.core.security import TokenError, TokenType, decode_token
from app.db.session import SessionLocal
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: DBSession = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = decode_token(credentials.credentials, TokenType.ACCESS)
    except TokenError as exc:
        raise unauthorized from exc

    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise unauthorized

    return user


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: DBSession = Depends(get_db),
) -> User | None:
    # Same token validation as get_current_user, but returns None instead of
    # raising 401 — for routes that behave differently depending on whether
    # the caller happens to be logged in (e.g. user creation, which must
    # stay open for the very first admin account before any login exists).
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials, TokenType.ACCESS)
    except TokenError:
        return None
    return db.get(User, int(payload["sub"]))

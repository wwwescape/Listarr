from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from app.core.security import hash_password
from app.models import User
from app.repositories import user_repository
from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError


def admin_exists(db: DBSession) -> bool:
    return user_repository.count_users(db) > 0


def list_users(db: DBSession) -> list[User]:
    return user_repository.list_users(db)


def get_user(db: DBSession, user_id: int) -> User:
    user = user_repository.get_user(db, user_id)
    if user is None:
        raise NotFoundError("User not found")
    return user


def ensure_admin_or_self(requesting_user: User, user_id: int) -> None:
    # Gate for the homes/lists sub-resources on a user's detail page — a
    # user's household and list memberships aren't public the way the bare
    # user directory is, so only that user or an Admin may view them.
    if not requesting_user.admin and requesting_user.id != user_id:
        raise ForbiddenError("You can only view your own homes and lists")


def create_user(
    db: DBSession, requesting_user: User | None, username: str, firstname: str, lastname: str, password: str
) -> User:
    now = datetime.now(UTC)
    # The first account on a fresh install is the one created by the
    # CreateUser bootstrap screen — make it admin automatically, since
    # there's otherwise no way for *any* account to ever become admin
    # (admin is intentionally not client-settable via this endpoint). That's
    # also the only case this is allowed to run without an authenticated
    # admin caller — once an admin exists, further accounts require one.
    is_first_user = user_repository.count_users(db) == 0
    if not is_first_user and (requesting_user is None or not requesting_user.admin):
        raise ForbiddenError("Only an admin can create a user")
    try:
        user = user_repository.create_user(
            db,
            username=username,
            firstname=firstname,
            lastname=lastname,
            password=hash_password(password),
            admin=is_first_user,
            createdAt=now,
            updatedAt=now,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(f'Username "{username}" is already taken') from exc
    db.refresh(user)
    return user


def update_user(db: DBSession, user_id: int, requesting_user: User, **updates) -> None:
    if not requesting_user.admin and requesting_user.id != user_id:
        raise ForbiddenError("You can only update your own account")
    user = get_user(db, user_id)
    if "password" in updates and updates["password"]:
        updates["password"] = hash_password(updates["password"])
    elif "password" in updates:
        del updates["password"]

    updates["updatedAt"] = datetime.now(UTC)
    try:
        user_repository.update_user(db, user, **updates)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(f'Username "{updates.get("username")}" is already taken') from exc


def delete_user(db: DBSession, user_id: int, requesting_user: User) -> None:
    if not requesting_user.admin:
        raise ForbiddenError("Only an admin can delete a user")
    if requesting_user.id == user_id:
        raise ForbiddenError("You can't delete your own account")
    user = get_user(db, user_id)
    user_repository.delete_user(db, user)
    db.commit()

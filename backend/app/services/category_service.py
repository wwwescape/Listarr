from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from app.models import Category
from app.repositories import category_repository
from app.services.exceptions import ConflictError, NotFoundError


def list_categories(db: DBSession) -> list[Category]:
    return category_repository.list_categories(db)


def get_category(db: DBSession, category_id: int) -> Category:
    category = category_repository.get_category(db, category_id)
    if category is None:
        raise NotFoundError(f"Category {category_id} not found")
    return category


def create_category(db: DBSession, category_name: str, status: str | None = None) -> Category:
    now = datetime.now(UTC)
    category = category_repository.create_category(
        db, category_name=category_name, status=status or "active", createdAt=now, updatedAt=now
    )
    db.commit()
    return category


def update_category(db: DBSession, category_id: int, **updates) -> Category:
    category = get_category(db, category_id)
    updates["updatedAt"] = datetime.now(UTC)
    category_repository.update_category(db, category, **updates)
    db.commit()
    return category


def delete_category(db: DBSession, category_id: int) -> None:
    category = get_category(db, category_id)
    try:
        category_repository.delete_category(db, category)
        db.commit()
    except IntegrityError as exc:
        # Unlike a list item's category_id (ondelete=SET NULL), a catalog
        # Item's category_id is a required FK with no cascade — deleting a
        # category still referenced by a catalog item hits that constraint.
        db.rollback()
        raise ConflictError(
            f'"{category.category_name}" is still used by existing catalog items and can\'t be deleted'
        ) from exc

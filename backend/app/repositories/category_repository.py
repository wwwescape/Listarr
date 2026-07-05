from sqlalchemy.orm import Session as DBSession

from app.models import Category


def list_categories(db: DBSession) -> list[Category]:
    return db.query(Category).all()


def get_category(db: DBSession, category_id: int) -> Category | None:
    return db.get(Category, category_id)


def create_category(db: DBSession, **fields) -> Category:
    category = Category(**fields)
    db.add(category)
    db.flush()
    return category


def update_category(db: DBSession, category: Category, **fields) -> Category:
    for key, value in fields.items():
        setattr(category, key, value)
    db.flush()
    return category


def delete_category(db: DBSession, category: Category) -> None:
    db.delete(category)
    db.flush()

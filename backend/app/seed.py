from datetime import UTC, datetime

from sqlalchemy.orm import Session as DBSession

from app.models import Area, Category

DEFAULT_CATEGORIES = [
    "Produce", "Bakery", "Frozen", "Dairy", "Meat", "Seafood", "Household",
    "Cleaning", "Baby", "Pets", "Pharmacy", "Electronics", "Stationery",
    "Miscellaneous",
]

DEFAULT_AREAS = [
    "Entrance", "Vegetables", "Fruit", "Bakery", "Cold Storage", "Frozen", "Checkout",
]


def seed_defaults(db: DBSession) -> None:
    now = datetime.now(UTC)

    existing_categories = {c.category_name for c in db.query(Category.category_name).all()}
    for name in DEFAULT_CATEGORIES:
        if name not in existing_categories:
            db.add(Category(category_name=name, status="active", createdAt=now, updatedAt=now))

    existing_areas = {a.area_name for a in db.query(Area.area_name).all()}
    for name in DEFAULT_AREAS:
        if name not in existing_areas:
            db.add(Area(area_name=name, status="active", createdAt=now, updatedAt=now))

    db.commit()

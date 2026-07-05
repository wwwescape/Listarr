from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.models import Item, ListItem


def list_items(db: DBSession) -> list[Item]:
    return db.query(Item).all()


def purchase_counts(db: DBSession) -> dict[int, int]:
    return dict(
        db.query(ListItem.item_id, func.count(ListItem.id))
        .filter(ListItem.item_id.isnot(None), ListItem.checked.is_(True))
        .group_by(ListItem.item_id)
        .all()
    )


def get_item(db: DBSession, item_id: int) -> Item | None:
    return db.get(Item, item_id)


def create_item(db: DBSession, **fields) -> Item:
    item = Item(**fields)
    db.add(item)
    db.flush()
    return item


def update_item(db: DBSession, item: Item, **fields) -> Item:
    for key, value in fields.items():
        setattr(item, key, value)
    db.flush()
    return item


def delete_item(db: DBSession, item: Item) -> None:
    db.delete(item)
    db.flush()


def favourite_list_items(db: DBSession, limit: int) -> list[ListItem]:
    return (
        db.query(ListItem)
        .filter(ListItem.favourite.is_(True))
        .order_by(ListItem.updatedAt.desc())
        .limit(limit)
        .all()
    )


def recent_checked_list_items(db: DBSession, limit: int) -> list[ListItem]:
    return (
        db.query(ListItem)
        .filter(ListItem.checked.is_(True), ListItem.checked_at.isnot(None))
        .order_by(ListItem.checked_at.desc())
        .limit(limit)
        .all()
    )


def frequent_checked_names(db: DBSession, limit: int):
    return (
        db.query(func.lower(ListItem.name).label("name_lower"), func.count(ListItem.id).label("cnt"))
        .filter(ListItem.checked.is_(True))
        .group_by("name_lower")
        .order_by(func.count(ListItem.id).desc())
        .limit(limit)
        .all()
    )


def representative_list_item_by_name(db: DBSession, name_lower: str) -> ListItem | None:
    return (
        db.query(ListItem)
        .filter(func.lower(ListItem.name) == name_lower)
        .order_by(ListItem.updatedAt.desc())
        .first()
    )

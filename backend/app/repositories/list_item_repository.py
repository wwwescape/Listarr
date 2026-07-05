from sqlalchemy.orm import Session as DBSession

from app.models import ListItem


def get_item(db: DBSession, list_id: int, item_id: int) -> ListItem | None:
    return db.query(ListItem).filter(ListItem.id == item_id, ListItem.list_id == list_id).first()


def create_item(db: DBSession, **fields) -> ListItem:
    item = ListItem(**fields)
    db.add(item)
    db.flush()
    return item


def update_item(db: DBSession, item: ListItem, **fields) -> ListItem:
    for key, value in fields.items():
        setattr(item, key, value)
    db.flush()
    return item


def delete_item(db: DBSession, item: ListItem) -> None:
    db.delete(item)
    db.flush()

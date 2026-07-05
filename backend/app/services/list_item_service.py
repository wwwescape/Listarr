from datetime import UTC, datetime

from sqlalchemy.orm import Session as DBSession

from app.models import ListItem
from app.repositories import list_item_repository


def add_item(db: DBSession, list_id: int, **fields) -> ListItem:
    now = datetime.now(UTC)
    fields["name"] = fields["name"].strip()
    fields["quantity"] = fields.get("quantity") or 1
    fields["priority"] = fields.get("priority") or "normal"
    fields["favourite"] = bool(fields.get("favourite"))
    item = list_item_repository.create_item(db, list_id=list_id, createdAt=now, updatedAt=now, **fields)
    db.commit()
    return item


def update_item(db: DBSession, list_id: int, item_id: int, **updates) -> ListItem | None:
    item = list_item_repository.get_item(db, list_id, item_id)
    if not item:
        return None

    if "name" in updates and updates["name"] is not None:
        updates["name"] = updates["name"].strip()
    if "checked" in updates:
        item.checked_at = datetime.now(UTC) if updates["checked"] else None
    updates["updatedAt"] = datetime.now(UTC)
    list_item_repository.update_item(db, item, **updates)
    db.commit()
    return item


def delete_item(db: DBSession, list_id: int, item_id: int) -> bool:
    item = list_item_repository.get_item(db, list_id, item_id)
    if not item:
        return False
    list_item_repository.delete_item(db, item)
    db.commit()
    return True

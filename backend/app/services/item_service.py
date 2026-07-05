from datetime import UTC, datetime

from sqlalchemy.orm import Session as DBSession

from app.models import Item
from app.repositories import item_repository
from app.services.exceptions import NotFoundError


def list_items(db: DBSession) -> list[Item]:
    # "Purchased" = checked off at least once, not just added to a list —
    # this is what actually signals a real, repeated shopping habit.
    counts = item_repository.purchase_counts(db)
    items = item_repository.list_items(db)
    for item in items:
        item.purchase_count = counts.get(item.id, 0)
    return sorted(items, key=lambda i: -i.purchase_count)


def _dedupe_by_name(rows, limit):
    seen = set()
    result = []
    for row in rows:
        key = row.name.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(row)
        if len(result) >= limit:
            break
    return result


def get_suggestions(db: DBSession) -> dict:
    favourite_candidates = item_repository.favourite_list_items(db, limit=100)
    recent_candidates = item_repository.recent_checked_list_items(db, limit=100)
    frequent_names = item_repository.frequent_checked_names(db, limit=10)

    frequent_rows = []
    for name_lower, _count in frequent_names:
        representative = item_repository.representative_list_item_by_name(db, name_lower)
        if representative:
            frequent_rows.append(representative)

    return {
        "favourites": _dedupe_by_name(favourite_candidates, 10),
        "recent": _dedupe_by_name(recent_candidates, 10),
        "frequent": frequent_rows,
    }


def get_item(db: DBSession, item_id: int) -> Item:
    item = item_repository.get_item(db, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    return item


def create_item(db: DBSession, item_name: str, category_id: int, status: str | None = None) -> Item:
    now = datetime.now(UTC)
    item = item_repository.create_item(
        db, item_name=item_name, category_id=category_id, status=status or "active", createdAt=now, updatedAt=now
    )
    db.commit()
    return item


def update_item(db: DBSession, item_id: int, **updates) -> Item:
    item = get_item(db, item_id)
    updates["updatedAt"] = datetime.now(UTC)
    item_repository.update_item(db, item, **updates)
    db.commit()
    return item


def delete_item(db: DBSession, item_id: int) -> None:
    item = get_item(db, item_id)
    item_repository.delete_item(db, item)
    db.commit()

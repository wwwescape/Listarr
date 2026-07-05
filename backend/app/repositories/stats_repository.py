from sqlalchemy.orm import Session as DBSession

from app.models import ListItem


def list_items_for_lists(db: DBSession, list_ids: list[int]) -> list[ListItem]:
    if not list_ids:
        return []
    return db.query(ListItem).filter(ListItem.list_id.in_(list_ids)).all()

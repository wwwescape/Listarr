from sqlalchemy.orm import Session as DBSession

from app.models import Home, List


def list_all(db: DBSession) -> list[Home]:
    return db.query(Home).all()


def list_by_ids(db: DBSession, home_ids: list[int]) -> list[Home]:
    if not home_ids:
        return []
    return db.query(Home).filter(Home.id.in_(home_ids)).all()


def get_home(db: DBSession, home_id: int) -> Home | None:
    return db.get(Home, home_id)


def create_home(db: DBSession, **fields) -> Home:
    home = Home(**fields)
    db.add(home)
    db.flush()
    return home


def update_home(db: DBSession, home: Home, **fields) -> Home:
    for key, value in fields.items():
        setattr(home, key, value)
    db.flush()
    return home


def delete_home(db: DBSession, home: Home) -> None:
    db.delete(home)
    db.flush()


def clear_home_from_lists(db: DBSession, home_id: int) -> None:
    # Lists.home_id is a retrofitted column with no enforced DB-level FK
    # (SQLite can't add one via ALTER TABLE) — null it out explicitly rather
    # than relying on cascade. HomeMembers *does* have a real FK and cascades
    # automatically when the Home row is deleted.
    db.query(List).filter(List.home_id == home_id).update({"home_id": None})

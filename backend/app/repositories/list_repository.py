from sqlalchemy.orm import Session as DBSession

from app.models import List, User


def list_all(db: DBSession) -> list[List]:
    return db.query(List).all()


def get_list(db: DBSession, list_id: int) -> List | None:
    return db.get(List, list_id)


def create_list(db: DBSession, **fields) -> List:
    list_row = List(**fields)
    db.add(list_row)
    db.flush()
    return list_row


def update_list(db: DBSession, list_row: List, **fields) -> List:
    for key, value in fields.items():
        setattr(list_row, key, value)
    db.flush()
    return list_row


def delete_list(db: DBSession, list_row: List) -> None:
    db.delete(list_row)
    db.flush()


def list_other_users(db: DBSession, user_id: int) -> list[User]:
    return db.query(User).filter(User.id != user_id).all()

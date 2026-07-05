from sqlalchemy.orm import Session as DBSession

from app.models import User


def list_users(db: DBSession) -> list[User]:
    return db.query(User).all()


def count_users(db: DBSession) -> int:
    return db.query(User).count()


def get_user(db: DBSession, user_id: int) -> User | None:
    return db.get(User, user_id)


def create_user(db: DBSession, **fields) -> User:
    user = User(**fields)
    db.add(user)
    db.flush()
    return user


def update_user(db: DBSession, user: User, **fields) -> User:
    for key, value in fields.items():
        setattr(user, key, value)
    db.flush()
    return user


def delete_user(db: DBSession, user: User) -> None:
    db.delete(user)
    db.flush()

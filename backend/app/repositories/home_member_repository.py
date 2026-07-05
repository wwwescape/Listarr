from sqlalchemy.orm import Session as DBSession

from app.models import HomeMember


def get_membership(db: DBSession, home_id: int, user_id: int) -> HomeMember | None:
    return db.query(HomeMember).filter_by(home_id=home_id, user_id=user_id).first()


def get_owner(db: DBSession, home_id: int) -> HomeMember | None:
    return db.query(HomeMember).filter_by(home_id=home_id, role="owner").first()


def list_for_home(db: DBSession, home_id: int) -> list[HomeMember]:
    return db.query(HomeMember).filter_by(home_id=home_id).all()


def list_for_user(db: DBSession, user_id: int) -> list[HomeMember]:
    return db.query(HomeMember).filter_by(user_id=user_id).all()


def count_for_home(db: DBSession, home_id: int) -> int:
    return db.query(HomeMember).filter_by(home_id=home_id).count()


def add_member(db: DBSession, **fields) -> HomeMember:
    member = HomeMember(**fields)
    db.add(member)
    db.flush()
    return member


def delete_member(db: DBSession, member: HomeMember) -> None:
    db.delete(member)
    db.flush()

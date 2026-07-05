from sqlalchemy.orm import Session as DBSession

from app.models import HomeMember


def get_home_role(db: DBSession, home_id: int, user_id: int) -> "str | None":
    member = db.query(HomeMember).filter_by(home_id=home_id, user_id=user_id).first()
    return member.role if member else None

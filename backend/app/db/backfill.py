from sqlalchemy.orm import Session as DBSession

from app.models import Home, HomeMember, User


# Data (not schema) backfill: `POST /api/users` now makes the very first
# account admin automatically, but that only helps fresh installs — an
# existing database (created before that logic existed) can have users with
# no admin at all, permanently locking out the Users page's admin-gated
# actions. Idempotent: only touches anything if zero admins currently exist,
# and only ever promotes the earliest-created account.
def backfill_first_admin(db: DBSession) -> None:
    if db.query(User).filter(User.admin.is_(True)).first() is not None:
        return
    earliest = db.query(User).order_by(User.id.asc()).first()
    if earliest:
        earliest.admin = True
        db.commit()


# Data backfill for the household-roles model: every Home created before
# roles existed has its members defaulted to "member" (the column's DB
# default) with no owner. Promote whichever member matches Home.created_by
# to "owner" — idempotent, only touches rows that aren't already an owner.
def backfill_home_owners(db: DBSession) -> None:
    for home in db.query(Home).all():
        if db.query(HomeMember).filter_by(home_id=home.id, role="owner").first() is not None:
            continue
        creator_membership = db.query(HomeMember).filter_by(home_id=home.id, user_id=home.created_by).first()
        if creator_membership:
            creator_membership.role = "owner"
    db.commit()

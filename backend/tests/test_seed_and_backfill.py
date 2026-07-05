from datetime import UTC, datetime

from app.core.security import hash_password
from app.db.backfill import backfill_first_admin, backfill_home_owners
from app.models import Area, Category, Home, HomeMember, User
from app.seed import DEFAULT_AREAS, DEFAULT_CATEGORIES, seed_defaults


def test_seed_defaults_populates_categories_and_areas(db_session):
    seed_defaults(db_session)

    category_names = {c.category_name for c in db_session.query(Category).all()}
    area_names = {a.area_name for a in db_session.query(Area).all()}
    assert category_names == set(DEFAULT_CATEGORIES)
    assert area_names == set(DEFAULT_AREAS)


def test_seed_defaults_is_idempotent(db_session):
    seed_defaults(db_session)
    seed_defaults(db_session)

    assert db_session.query(Category).count() == len(DEFAULT_CATEGORIES)
    assert db_session.query(Area).count() == len(DEFAULT_AREAS)


def _make_user(db_session, username, admin=False):
    now = datetime.now(UTC)
    user = User(
        username=username,
        firstname=username.title(),
        lastname="Test",
        password=hash_password("pw"),
        admin=admin,
        status="active",
        createdAt=now,
        updatedAt=now,
    )
    db_session.add(user)
    db_session.commit()
    return user


def test_backfill_first_admin_promotes_earliest_user(db_session):
    first = _make_user(db_session, "first", admin=False)
    _make_user(db_session, "second", admin=False)

    backfill_first_admin(db_session)

    db_session.refresh(first)
    assert first.admin is True


def test_backfill_first_admin_noop_if_admin_exists(db_session):
    _make_user(db_session, "first", admin=False)
    already_admin = _make_user(db_session, "admin", admin=True)

    backfill_first_admin(db_session)

    db_session.refresh(already_admin)
    assert already_admin.admin is True
    first = db_session.query(User).filter_by(username="first").first()
    assert first.admin is False


def test_backfill_home_owners_promotes_creator(db_session):
    now = datetime.now(UTC)
    creator = _make_user(db_session, "creator")
    home = Home(name="Casa", created_by=creator.id, createdAt=now, updatedAt=now)
    db_session.add(home)
    db_session.flush()
    membership = HomeMember(home_id=home.id, user_id=creator.id, role="member", createdAt=now)
    db_session.add(membership)
    db_session.commit()

    backfill_home_owners(db_session)

    db_session.refresh(membership)
    assert membership.role == "owner"


def test_backfill_home_owners_skips_home_that_already_has_owner(db_session):
    now = datetime.now(UTC)
    creator = _make_user(db_session, "creator2")
    other = _make_user(db_session, "other")
    home = Home(name="Casa", created_by=creator.id, createdAt=now, updatedAt=now)
    db_session.add(home)
    db_session.flush()
    creator_membership = HomeMember(home_id=home.id, user_id=creator.id, role="member", createdAt=now)
    owner_membership = HomeMember(home_id=home.id, user_id=other.id, role="owner", createdAt=now)
    db_session.add_all([creator_membership, owner_membership])
    db_session.commit()

    backfill_home_owners(db_session)

    db_session.refresh(creator_membership)
    assert creator_membership.role == "member"

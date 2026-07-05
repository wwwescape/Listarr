from datetime import UTC, datetime

from sqlalchemy.orm import Session as DBSession

from app.auth import get_home_role
from app.models import Home, User
from app.repositories import home_member_repository, home_repository
from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError

MANAGE_ROLES = {"owner", "co_owner"}


def get_home(db: DBSession, home_id: int) -> Home:
    home = home_repository.get_home(db, home_id)
    if home is None:
        raise NotFoundError("Home not found")
    return home


def member_count(db: DBSession, home_id: int) -> int:
    return home_member_repository.count_for_home(db, home_id)


def require_membership(db: DBSession, home_id: int, user: User) -> str | None:
    """Any member, or Admin. Returns the caller's role (None for a
    non-member Admin)."""
    role = get_home_role(db, home_id, user.id)
    if role is None and not user.admin:
        raise ForbiddenError("You are not a member of this home")
    return role


def require_manager(db: DBSession, home_id: int, user: User) -> str | None:
    """Owner, co-owner, or Admin. Returns the caller's role (None for Admin
    acting on a household they don't belong to)."""
    role = get_home_role(db, home_id, user.id)
    if role not in MANAGE_ROLES and not user.admin:
        raise ForbiddenError("Only the home's owner or co-owner can do that")
    return role


def list_homes_for_user(db: DBSession, user: User) -> list[Home]:
    if user.admin:
        return home_repository.list_all(db)
    member_home_ids = [m.home_id for m in home_member_repository.list_for_user(db, user.id)]
    return home_repository.list_by_ids(db, member_home_ids)


def list_homes_for_member(db: DBSession, user_id: int) -> list[tuple[Home, str]]:
    """Every home a specific user belongs to, paired with their role there
    — backs the Homes tab on a user's own detail page (unlike
    list_homes_for_user, this is never widened to "everything" for an
    Admin caller; it's always that one user's actual memberships)."""
    memberships = home_member_repository.list_for_user(db, user_id)
    homes = []
    for membership in memberships:
        home = home_repository.get_home(db, membership.home_id)
        if home is not None:
            homes.append((home, membership.role))
    return homes


def create_home(db: DBSession, requesting_user: User, name: str, owner_user_id: int) -> Home:
    if not requesting_user.admin:
        raise ForbiddenError("Only an admin can create a home")
    owner = db.get(User, owner_user_id)
    if not owner:
        raise NotFoundError("Owner user not found")

    now = datetime.now(UTC)
    home = home_repository.create_home(db, name=name, created_by=requesting_user.id, createdAt=now, updatedAt=now)
    home_member_repository.add_member(db, home_id=home.id, user_id=owner.id, role="owner", createdAt=now)
    db.commit()
    return home


def update_home(db: DBSession, home_id: int, requesting_user: User, **updates) -> Home:
    home = get_home(db, home_id)
    require_manager(db, home_id, requesting_user)
    updates["updatedAt"] = datetime.now(UTC)
    home_repository.update_home(db, home, **updates)
    db.commit()
    return home


def delete_home(db: DBSession, home_id: int, requesting_user: User) -> None:
    home = get_home(db, home_id)
    if not requesting_user.admin and get_home_role(db, home_id, requesting_user.id) != "owner":
        raise ForbiddenError("Only the home's owner or an admin can delete this home")
    home_repository.clear_home_from_lists(db, home_id)
    home_repository.delete_home(db, home)
    db.commit()


def transfer_ownership(db: DBSession, home_id: int, requesting_user: User, target_user_id: int) -> None:
    if not requesting_user.admin:
        raise ForbiddenError("Only an admin can transfer ownership")
    get_home(db, home_id)
    target = db.get(User, target_user_id)
    if not target:
        raise NotFoundError("User not found")

    now = datetime.now(UTC)
    current_owner = home_member_repository.get_owner(db, home_id)
    if current_owner and current_owner.user_id == target.id:
        raise ConflictError(f'"{target.username}" is already the owner')
    if current_owner:
        current_owner.role = "co_owner"

    target_membership = home_member_repository.get_membership(db, home_id, target.id)
    if target_membership:
        target_membership.role = "owner"
    else:
        home_member_repository.add_member(db, home_id=home_id, user_id=target.id, role="owner", createdAt=now)

    db.commit()


def add_member(db: DBSession, home_id: int, requesting_user: User, target_user_id: int, role: str) -> Home:
    home = get_home(db, home_id)
    require_manager(db, home_id, requesting_user)
    target = db.get(User, target_user_id)
    if not target:
        raise NotFoundError("User not found")
    if home_member_repository.get_membership(db, home_id, target.id):
        raise ConflictError(f'"{target.username}" is already a member of this home')

    home_member_repository.add_member(
        db, home_id=home_id, user_id=target.id, role=role, createdAt=datetime.now(UTC)
    )
    db.commit()
    return home


def update_member_role(db: DBSession, home_id: int, requesting_user: User, target_user_id: int, role: str) -> None:
    get_home(db, home_id)
    caller_role = require_manager(db, home_id, requesting_user)
    member = home_member_repository.get_membership(db, home_id, target_user_id)
    if not member:
        raise NotFoundError("That user is not a member of this home")
    if member.role == "owner":
        raise ConflictError("Transfer ownership instead of changing the owner's role")
    # Same hierarchy as removal: a co-owner can adjust plain members, but not
    # another co-owner — only the owner or an Admin can do that.
    if caller_role == "co_owner" and member.role == "co_owner" and target_user_id != requesting_user.id:
        raise ForbiddenError("Only the home's owner can change a co-owner's role")

    member.role = role
    db.commit()


def remove_member(db: DBSession, home_id: int, requesting_user: User, target_user_id: int) -> None:
    get_home(db, home_id)
    caller_role = require_membership(db, home_id, requesting_user)

    member = home_member_repository.get_membership(db, home_id, target_user_id)
    if not member:
        raise NotFoundError("That user is not a member of this home")

    is_self = target_user_id == requesting_user.id

    if member.role == "owner":
        # Only an Admin or the owner themselves (stepping down) can remove
        # the owner — a co-owner can't unilaterally oust them. Unlike every
        # other role, there's no "transfer ownership instead" escape hatch
        # required here: removing the owner auto-promotes a successor below,
        # so the home is never left ownerless.
        if not (requesting_user.admin or is_self):
            raise ForbiddenError("Only an admin can remove the home's owner")
        home_member_repository.delete_member(db, member)
        _promote_successor(db, home_id)
        db.commit()
        return

    if not is_self:
        # Removing someone else: owner/admin can remove a co-owner or member;
        # a co-owner can only remove a plain member, not another co-owner.
        if requesting_user.admin or caller_role == "owner":
            pass
        elif caller_role == "co_owner" and member.role == "member":
            pass
        else:
            raise ForbiddenError("You don't have permission to remove that member")

    home_member_repository.delete_member(db, member)
    db.commit()


def _promote_successor(db: DBSession, home_id: int) -> None:
    """Called right after the owner's membership row is deleted — promotes
    a co-owner if one exists, otherwise any remaining member, so the home
    is never left without an owner. A no-op if no members remain."""
    remaining = home_member_repository.list_for_home(db, home_id)
    if not remaining:
        return
    successor = next((m for m in remaining if m.role == "co_owner"), remaining[0])
    successor.role = "owner"


def to_home_out_fields(db: DBSession, home: Home, user: User) -> dict:
    """Computed fields (not stored on Home) that every HomeOut response needs."""
    return {
        "member_count": member_count(db, home.id),
        "my_role": get_home_role(db, home.id, user.id),
    }

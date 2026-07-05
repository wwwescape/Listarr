from datetime import UTC, datetime

from sqlalchemy.orm import Session as DBSession

from app.auth import get_home_role
from app.models import List, User
from app.repositories import list_item_repository, list_repository
from app.services.exceptions import ForbiddenError, NotFoundError


def user_can_access_list(db: DBSession, list_row: List, user: User) -> bool:
    # "Admin can do everything" applies here too — otherwise an admin can't
    # even view/manage a list once it falls outside every other access path
    # (e.g. its household gets deleted and it was never the admin's own).
    if user.admin:
        return True
    # list_row.createdBy is physically a VARCHAR in the DB (confirmed via
    # PRAGMA table_info) even though it represents a user id. Node's
    # equivalent check used loose `==`, which silently coerced this; Python
    # has no such coercion, so compare as strings explicitly on both sides.
    if str(list_row.createdBy) == str(user.id):
        return True
    collaborators = list_row.collaborators or []
    if str(user.id) in [str(c) for c in collaborators]:
        return True
    if list_row.home_id is not None:
        # Viewing/editing a list already placed in a household is open to
        # every role — only *placing* a list into one is role-gated (see
        # check_home_write_access below).
        return get_home_role(db, list_row.home_id, user.id) is not None
    return False


def check_home_write_access(db: DBSession, home_id: int | None, user: User) -> None:
    # Placing a list into a household requires being that household's owner
    # or co-owner (or Admin) — narrower than just being any member, which is
    # enough to view/edit a list already there (see user_can_access_list).
    if home_id is None:
        return
    if user.admin:
        return
    if get_home_role(db, home_id, user.id) not in {"owner", "co_owner"}:
        raise ForbiddenError("Only that home's owner or co-owner can add lists to it")


def can_delete_list(db: DBSession, list_row: List, user: User) -> bool:
    # Narrower than user_can_access_list: deleting is limited to the list's
    # creator, the owner of the home it's assigned to, or an Admin — a plain
    # collaborator or a non-owner member of that home can still view/edit
    # the list but not delete it.
    if user.admin:
        return True
    if str(list_row.createdBy) == str(user.id):
        return True
    if list_row.home_id is not None and get_home_role(db, list_row.home_id, user.id) == "owner":
        return True
    return False


def get_owned_list(db: DBSession, list_id: int, user: User) -> List:
    list_row = list_repository.get_list(db, list_id)
    if not list_row:
        raise NotFoundError("List not found")
    if not user_can_access_list(db, list_row, user):
        raise ForbiddenError("You are not authorized to access this list")
    return list_row


def list_visible_lists(db: DBSession, user: User) -> list[List]:
    all_lists = list_repository.list_all(db)
    return [lst for lst in all_lists if user_can_access_list(db, lst, user)]


def list_direct_lists_for_user(db: DBSession, user_id: int) -> list[List]:
    # Deliberately narrower than list_visible_lists: only lists this user
    # created or is an explicit collaborator on, excluding ones they can
    # merely reach via a shared home. Backs the Lists tab on a user's detail
    # page, where every row optionally offers "Exit List" — that action only
    # makes sense for a direct membership, not an inherited one.
    all_lists = list_repository.list_all(db)
    direct = []
    for lst in all_lists:
        if str(lst.createdBy) == str(user_id):
            direct.append(lst)
            continue
        collaborators = lst.collaborators or []
        if str(user_id) in [str(c) for c in collaborators]:
            direct.append(lst)
    return direct


def create_list(db: DBSession, user: User, name: str, collaborators, home_id: int | None) -> List:
    check_home_write_access(db, home_id, user)
    now = datetime.now(UTC)
    list_row = list_repository.create_list(
        db,
        name=name,
        createdBy=str(user.id),
        collaborators=collaborators,
        home_id=home_id,
        createdAt=now,
        updatedAt=now,
    )
    db.commit()
    return list_row


def update_list(db: DBSession, list_id: int, user: User, **updates) -> None:
    list_row = get_owned_list(db, list_id, user)
    if "home_id" in updates:
        check_home_write_access(db, updates["home_id"], user)
    updates["updatedAt"] = datetime.now(UTC)
    list_repository.update_list(db, list_row, **updates)
    db.commit()


def delete_list(db: DBSession, list_id: int, user: User) -> None:
    list_row = list_repository.get_list(db, list_id)
    if not list_row:
        raise NotFoundError("List not found")
    if not can_delete_list(db, list_row, user):
        raise ForbiddenError("You don't have permission to delete this list")
    list_repository.delete_list(db, list_row)
    db.commit()


def duplicate_list(db: DBSession, list_id: int, user: User) -> List:
    source = get_owned_list(db, list_id, user)
    now = datetime.now(UTC)

    new_list = list_repository.create_list(
        db,
        name=f"{source.name} (copy)",
        createdBy=str(user.id),
        collaborators=None,
        status="active",
        favourite=False,
        createdAt=now,
        updatedAt=now,
    )

    # Items carry over, but freshly unchecked — duplicating is almost always
    # "I want to shop for this again", not "here's what I already bought".
    for item in source.listItems:
        list_item_repository.create_item(
            db,
            list_id=new_list.id,
            item_id=item.item_id,
            name=item.name,
            quantity=item.quantity,
            unit=item.unit,
            notes=item.notes,
            category_id=item.category_id,
            area_id=item.area_id,
            priority=item.priority,
            brand=item.brand,
            favourite=item.favourite,
            checked=False,
            checked_at=None,
            createdAt=now,
            updatedAt=now,
        )

    db.commit()
    return new_list


def get_collaborators(db: DBSession, user: User) -> list[User]:
    return list_repository.list_other_users(db, user.id)

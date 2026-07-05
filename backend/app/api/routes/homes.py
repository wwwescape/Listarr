from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_current_user, get_db
from app.models import Home, User
from app.schemas.home import (
    HomeCreate,
    HomeDetailOut,
    HomeMemberAdd,
    HomeMemberRoleUpdate,
    HomeOut,
    HomeOwnerTransfer,
    HomeUpdate,
)
from app.services import home_service

router = APIRouter(prefix="/api/homes", tags=["homes"])


def _to_home_out(db: DBSession, home: Home, user: User) -> HomeOut:
    return HomeOut(
        id=home.id,
        name=home.name,
        created_by=home.created_by,
        createdAt=home.createdAt,
        updatedAt=home.updatedAt,
        **home_service.to_home_out_fields(db, home, user),
    )


@router.get("", response_model=list[HomeOut])
def get_homes(db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    homes = home_service.list_homes_for_user(db, user)
    return [_to_home_out(db, h, user) for h in homes]


@router.post("", response_model=HomeOut, status_code=201)
def create_home(payload: HomeCreate, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    home = home_service.create_home(db, user, name=payload.name, owner_user_id=payload.owner_user_id)
    return _to_home_out(db, home, user)


@router.get("/{home_id}", response_model=HomeDetailOut)
def get_home(home_id: int, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    home = home_service.get_home(db, home_id)
    home_service.require_membership(db, home_id, user)
    return HomeDetailOut(
        id=home.id,
        name=home.name,
        created_by=home.created_by,
        createdAt=home.createdAt,
        updatedAt=home.updatedAt,
        members=home.members,
        **home_service.to_home_out_fields(db, home, user),
    )


@router.put("/{home_id}")
def update_home(
    home_id: int, payload: HomeUpdate, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)
):
    home_service.update_home(db, home_id, user, **payload.model_dump(exclude_unset=True))
    return {"message": "Home updated"}


@router.delete("/{home_id}")
def delete_home(home_id: int, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    home_service.delete_home(db, home_id, user)
    return {"message": "Home deleted"}


@router.put("/{home_id}/owner")
def transfer_ownership(
    home_id: int, payload: HomeOwnerTransfer, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)
):
    home_service.transfer_ownership(db, home_id, user, payload.user_id)
    return {"message": "Ownership transferred"}


@router.post("/{home_id}/members", response_model=HomeOut, status_code=201)
def add_home_member(
    home_id: int, payload: HomeMemberAdd, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)
):
    home = home_service.add_member(db, home_id, user, payload.user_id, payload.role)
    return _to_home_out(db, home, user)


@router.put("/{home_id}/members/{user_id}")
def update_member_role(
    home_id: int,
    user_id: int,
    payload: HomeMemberRoleUpdate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    home_service.update_member_role(db, home_id, user, user_id, payload.role)
    return {"message": "Member role updated"}


@router.delete("/{home_id}/members/{user_id}")
def remove_home_member(
    home_id: int, user_id: int, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)
):
    home_service.remove_member(db, home_id, user, user_id)
    return {"message": "Member removed"}

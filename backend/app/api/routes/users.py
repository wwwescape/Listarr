from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_current_user, get_current_user_optional, get_db
from app.models import User
from app.schemas.home import HomeMembershipOut
from app.schemas.list import ListOut
from app.schemas.user import UserCreate, UserExistsOut, UserOut, UserUpdate
from app.services import home_service, list_service, user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/exists", response_model=UserExistsOut)
def check_admin_exists(db: DBSession = Depends(get_db)):
    # Unauthenticated by design: Setup.tsx/Bootstrap.tsx need to tell "fresh
    # install" from "an admin already exists, go log in" before any login is
    # possible. Kept to a single boolean rather than exposing the full user
    # list (see get_users below, which does require auth).
    return {"admin_exists": user_service.admin_exists(db)}


@router.get("", response_model=list[UserOut])
def get_users(db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    return user_service.list_users(db)


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    db: DBSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    return user_service.create_user(
        db,
        requesting_user=user,
        username=payload.username,
        firstname=payload.firstname,
        lastname=payload.lastname,
        password=payload.password,
    )


@router.put("/{user_id}")
def update_user(
    user_id: int, payload: UserUpdate, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)
):
    user_service.update_user(db, user_id, requesting_user=user, **payload.model_dump(exclude_unset=True))
    return {"message": "User updated"}


@router.delete("/{user_id}")
def delete_user(user_id: int, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    user_service.delete_user(db, user_id, requesting_user=user)
    return {"message": "User deleted"}


@router.get("/{user_id}/homes", response_model=list[HomeMembershipOut])
def get_user_homes(user_id: int, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    user_service.get_user(db, user_id)
    user_service.ensure_admin_or_self(user, user_id)
    return [
        HomeMembershipOut(id=home.id, name=home.name, role=role, member_count=home_service.member_count(db, home.id))
        for home, role in home_service.list_homes_for_member(db, user_id)
    ]


@router.get("/{user_id}/lists", response_model=list[ListOut])
def get_user_lists(user_id: int, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    user_service.get_user(db, user_id)
    user_service.ensure_admin_or_self(user, user_id)
    return list_service.list_direct_lists_for_user(db, user_id)


from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session as DBSession
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user, get_db
from app.models import User
from app.schemas.list import ListCreate, ListDetailOut, ListOut, ListUpdate
from app.schemas.list_item import ListItemCreate, ListItemOut, ListItemUpdate
from app.schemas.user import UserOut
from app.services import list_item_service, list_service
from app.socket_manager import notify_item_added, notify_item_deleted, notify_item_updated

router = APIRouter(prefix="/api/lists", tags=["lists"])


@router.get("", response_model=list[ListOut])
def get_lists(db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    return list_service.list_visible_lists(db, user)


@router.post("", response_model=ListOut, status_code=201)
def create_list(payload: ListCreate, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    return list_service.create_list(
        db, user, name=payload.name, collaborators=payload.collaborators, home_id=payload.home_id
    )


@router.put("/{list_id}")
def update_list(
    list_id: int, payload: ListUpdate, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)
):
    list_service.update_list(db, list_id, user, **payload.model_dump(exclude_unset=True))
    return {"message": "List updated"}


@router.delete("/{list_id}")
def delete_list(list_id: int, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    list_service.delete_list(db, list_id, user)
    return {"message": "List deleted"}


@router.post("/{list_id}/duplicate", response_model=ListOut, status_code=201)
def duplicate_list(list_id: int, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    return list_service.duplicate_list(db, list_id, user)


@router.get("/collaborators", response_model=list[UserOut])
def get_collaborators(db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    return list_service.get_collaborators(db, user)


@router.get("/list/{list_id}", response_model=ListDetailOut)
def get_list(list_id: int, db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    return list_service.get_owned_list(db, list_id, user)


@router.post("/list/{list_id}/items", response_model=ListItemOut, status_code=201)
async def add_item_to_list(
    list_id: int,
    payload: ListItemCreate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
    x_socket_id: str | None = Header(None),
):
    list_service.get_owned_list(db, list_id, user)
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Item name is required")

    new_item = await run_in_threadpool(list_item_service.add_item, db, list_id, **payload.model_dump())
    await notify_item_added(list_id, new_item, skip_sid=x_socket_id)
    return new_item


@router.put("/list/{list_id}/items/{item_id}", response_model=ListItemOut)
async def update_item_on_list(
    list_id: int,
    item_id: int,
    payload: ListItemUpdate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
    x_socket_id: str | None = Header(None),
):
    list_service.get_owned_list(db, list_id, user)
    updated_item = await run_in_threadpool(
        list_item_service.update_item, db, list_id, item_id, **payload.model_dump(exclude_unset=True)
    )
    if updated_item is None:
        raise HTTPException(status_code=404, detail="Item not found on this list")

    await notify_item_updated(list_id, updated_item, skip_sid=x_socket_id)
    return updated_item


@router.delete("/list/{list_id}/items/{item_id}")
async def delete_item_from_list(
    list_id: int,
    item_id: int,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
    x_socket_id: str | None = Header(None),
):
    list_service.get_owned_list(db, list_id, user)
    deleted = await run_in_threadpool(list_item_service.delete_item, db, list_id, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found on this list")

    await notify_item_deleted(list_id, item_id, skip_sid=x_socket_id)
    return {"message": "Item deleted", "item_id": item_id}

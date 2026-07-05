from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_db
from app.schemas.item import ItemCreate, ItemOut, ItemUpdate
from app.schemas.list_item import SuggestionsOut
from app.services import item_service

router = APIRouter(prefix="/api/items", tags=["items"])


@router.get("", response_model=list[ItemOut])
def get_items(db: DBSession = Depends(get_db)):
    return item_service.list_items(db)


@router.get("/suggestions", response_model=SuggestionsOut)
def get_suggestions(db: DBSession = Depends(get_db)):
    return item_service.get_suggestions(db)


@router.post("", response_model=ItemOut, status_code=201)
def create_item(payload: ItemCreate, db: DBSession = Depends(get_db)):
    return item_service.create_item(
        db, item_name=payload.item_name, category_id=payload.category_id, status=payload.status
    )


@router.put("/{item_id}")
def update_item(item_id: int, payload: ItemUpdate, db: DBSession = Depends(get_db)):
    item_service.update_item(db, item_id, **payload.model_dump(exclude_unset=True))
    return {"message": "Item updated"}


@router.delete("/{item_id}")
def delete_item(item_id: int, db: DBSession = Depends(get_db)):
    item_service.delete_item(db, item_id)
    return {"message": "Item deleted"}

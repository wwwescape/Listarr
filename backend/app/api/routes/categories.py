from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_db
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.services import category_service

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def get_categories(db: DBSession = Depends(get_db)):
    return category_service.list_categories(db)


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryCreate, db: DBSession = Depends(get_db)):
    return category_service.create_category(db, category_name=payload.category_name, status=payload.status)


@router.put("/{category_id}")
def update_category(category_id: int, payload: CategoryUpdate, db: DBSession = Depends(get_db)):
    category_service.update_category(db, category_id, **payload.model_dump(exclude_unset=True))
    return {"message": "Category updated"}


@router.delete("/{category_id}")
def delete_category(category_id: int, db: DBSession = Depends(get_db)):
    category_service.delete_category(db, category_id)
    return {"message": "Category deleted"}

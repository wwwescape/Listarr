from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_db
from app.schemas.area import AreaCreate, AreaOut, AreaUpdate
from app.services import area_service

router = APIRouter(prefix="/api/areas", tags=["areas"])


@router.get("", response_model=list[AreaOut])
def get_areas(db: DBSession = Depends(get_db)):
    return area_service.list_areas(db)


@router.post("", response_model=AreaOut, status_code=201)
def create_area(payload: AreaCreate, db: DBSession = Depends(get_db)):
    return area_service.create_area(db, area_name=payload.area_name, status=payload.status)


@router.put("/{area_id}")
def update_area(area_id: int, payload: AreaUpdate, db: DBSession = Depends(get_db)):
    area_service.update_area(db, area_id, **payload.model_dump(exclude_unset=True))
    return {"message": "Area updated"}


@router.delete("/{area_id}")
def delete_area(area_id: int, db: DBSession = Depends(get_db)):
    area_service.delete_area(db, area_id)
    return {"message": "Area deleted"}

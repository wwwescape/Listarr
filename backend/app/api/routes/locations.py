from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_db
from app.schemas.location import LocationCreate, LocationOut, LocationUpdate
from app.services import location_service

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("", response_model=list[LocationOut])
def get_locations(db: DBSession = Depends(get_db)):
    return location_service.list_locations(db)


@router.post("", response_model=LocationOut, status_code=201)
def create_location(payload: LocationCreate, db: DBSession = Depends(get_db)):
    return location_service.create_location(db, location_name=payload.location_name, status=payload.status)


@router.put("/{location_id}")
def update_location(location_id: int, payload: LocationUpdate, db: DBSession = Depends(get_db)):
    location_service.update_location(db, location_id, **payload.model_dump(exclude_unset=True))
    return {"message": "Location updated"}


@router.delete("/{location_id}")
def delete_location(location_id: int, db: DBSession = Depends(get_db)):
    location_service.delete_location(db, location_id)
    return {"message": "Location deleted"}

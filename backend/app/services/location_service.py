from datetime import UTC, datetime

from sqlalchemy.orm import Session as DBSession

from app.models import Location
from app.repositories import location_repository
from app.services.exceptions import NotFoundError


def list_locations(db: DBSession) -> list[Location]:
    return location_repository.list_locations(db)


def get_location(db: DBSession, location_id: int) -> Location:
    location = location_repository.get_location(db, location_id)
    if location is None:
        raise NotFoundError(f"Location {location_id} not found")
    return location


def create_location(db: DBSession, location_name: str, status: str | None = None) -> Location:
    now = datetime.now(UTC)
    location = location_repository.create_location(
        db, location_name=location_name, status=status or "active", createdAt=now, updatedAt=now
    )
    db.commit()
    return location


def update_location(db: DBSession, location_id: int, **updates) -> Location:
    location = get_location(db, location_id)
    updates["updatedAt"] = datetime.now(UTC)
    location_repository.update_location(db, location, **updates)
    db.commit()
    return location


def delete_location(db: DBSession, location_id: int) -> None:
    location = get_location(db, location_id)
    location_repository.delete_location(db, location)
    db.commit()

from datetime import UTC, datetime

from sqlalchemy.orm import Session as DBSession

from app.models import Area
from app.repositories import area_repository
from app.services.exceptions import NotFoundError


def list_areas(db: DBSession) -> list[Area]:
    return area_repository.list_areas(db)


def get_area(db: DBSession, area_id: int) -> Area:
    area = area_repository.get_area(db, area_id)
    if area is None:
        raise NotFoundError(f"Area {area_id} not found")
    return area


def create_area(db: DBSession, area_name: str, status: str | None = None) -> Area:
    now = datetime.now(UTC)
    area = area_repository.create_area(
        db, area_name=area_name, status=status or "active", createdAt=now, updatedAt=now
    )
    db.commit()
    return area


def update_area(db: DBSession, area_id: int, **updates) -> Area:
    area = get_area(db, area_id)
    updates["updatedAt"] = datetime.now(UTC)
    area_repository.update_area(db, area, **updates)
    db.commit()
    return area


def delete_area(db: DBSession, area_id: int) -> None:
    area = get_area(db, area_id)
    area_repository.delete_area(db, area)
    db.commit()

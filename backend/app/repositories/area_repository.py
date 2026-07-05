from sqlalchemy.orm import Session as DBSession

from app.models import Area


def list_areas(db: DBSession) -> list[Area]:
    return db.query(Area).all()


def get_area(db: DBSession, area_id: int) -> Area | None:
    return db.get(Area, area_id)


def create_area(db: DBSession, **fields) -> Area:
    area = Area(**fields)
    db.add(area)
    db.flush()
    return area


def update_area(db: DBSession, area: Area, **fields) -> Area:
    for key, value in fields.items():
        setattr(area, key, value)
    db.flush()
    return area


def delete_area(db: DBSession, area: Area) -> None:
    db.delete(area)
    db.flush()

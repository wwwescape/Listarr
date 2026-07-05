from sqlalchemy.orm import Session as DBSession

from app.models import Location


def list_locations(db: DBSession) -> list[Location]:
    return db.query(Location).all()


def get_location(db: DBSession, location_id: int) -> Location | None:
    return db.get(Location, location_id)


def create_location(db: DBSession, **fields) -> Location:
    location = Location(**fields)
    db.add(location)
    db.flush()
    return location


def update_location(db: DBSession, location: Location, **fields) -> Location:
    for key, value in fields.items():
        setattr(location, key, value)
    db.flush()
    return location


def delete_location(db: DBSession, location: Location) -> None:
    db.delete(location)
    db.flush()

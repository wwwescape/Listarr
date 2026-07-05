from sqlalchemy import Column, Integer, String

from app.db.base import Base
from app.db.types import UTCDateTime


class Location(Base):
    __tablename__ = "Locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_name = Column(String(255), nullable=False)
    status = Column(String, default="active")
    createdAt = Column(UTCDateTime, nullable=False)
    updatedAt = Column(UTCDateTime, nullable=False)

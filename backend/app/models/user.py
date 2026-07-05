from sqlalchemy import Boolean, Column, Integer, String

from app.db.base import Base
from app.db.types import UTCDateTime


class User(Base):
    __tablename__ = "Users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(255), nullable=False, unique=True)
    firstname = Column(String(255), nullable=False)
    lastname = Column(String(255), nullable=False)
    password = Column(String(255), nullable=False)
    admin = Column(Boolean, default=False)
    status = Column(String, default="active")
    createdAt = Column(UTCDateTime, nullable=False)
    updatedAt = Column(UTCDateTime, nullable=False)

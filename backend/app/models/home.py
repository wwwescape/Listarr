from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.types import UTCDateTime


class Home(Base):
    __tablename__ = "Homes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    created_by = Column(Integer, ForeignKey("Users.id", ondelete="SET NULL"), nullable=True)
    createdAt = Column(UTCDateTime, nullable=False)
    updatedAt = Column(UTCDateTime, nullable=False)

    members = relationship("HomeMember", cascade="all, delete-orphan", passive_deletes=True)

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.types import UTCDateTime


class Item(Base):
    __tablename__ = "Items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    item_name = Column(String(255), nullable=False)
    category_id = Column(Integer, ForeignKey("Categories.id"), nullable=False)
    status = Column(String, default="active")
    createdAt = Column(UTCDateTime, nullable=False)
    updatedAt = Column(UTCDateTime, nullable=False)

    category = relationship("Category")

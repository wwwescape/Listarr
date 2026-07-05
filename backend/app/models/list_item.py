from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.types import UTCDateTime


class ListItem(Base):
    __tablename__ = "ListItems"

    id = Column(Integer, primary_key=True, autoincrement=True)
    list_id = Column(Integer, ForeignKey("Lists.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("Items.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False, default=1)
    unit = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("Categories.id", ondelete="SET NULL"), nullable=True)
    area_id = Column(Integer, ForeignKey("Areas.id", ondelete="SET NULL"), nullable=True)
    priority = Column(String, default="normal")
    brand = Column(String(255), nullable=True)
    favourite = Column(Boolean, default=False)
    checked = Column(Boolean, default=False)
    checked_at = Column(UTCDateTime, nullable=True)
    position = Column(Integer, default=0)
    createdAt = Column(UTCDateTime, nullable=False)
    updatedAt = Column(UTCDateTime, nullable=False)

    list = relationship("List", back_populates="listItems")
    category = relationship("Category")
    area = relationship("Area")

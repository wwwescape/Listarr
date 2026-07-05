from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.types import UTCDateTime


class HomeMember(Base):
    __tablename__ = "HomeMembers"
    __table_args__ = (UniqueConstraint("home_id", "user_id", name="uq_home_member"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    home_id = Column(Integer, ForeignKey("Homes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("Users.id", ondelete="CASCADE"), nullable=False)
    # "owner" | "co_owner" | "member" — plain String (not a DB enum), same
    # rationale as List.status/priority elsewhere in this codebase: avoids a
    # future migration fighting a CHECK constraint that was never really
    # needed; validated in Pydantic instead.
    role = Column(String, nullable=False, default="member")
    createdAt = Column(UTCDateTime, nullable=False)

    user = relationship("User")

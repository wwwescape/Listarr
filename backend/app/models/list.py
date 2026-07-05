from sqlalchemy import JSON, Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.types import UTCDateTime


class List(Base):
    __tablename__ = "Lists"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    # Physically VARCHAR in the live DB despite representing a user id
    # (confirmed via PRAGMA table_info) — kept as String, cast at the API
    # boundary where needed.
    createdBy = Column(String(255), nullable=False)
    collaborators = Column(JSON, nullable=True)
    status = Column(String, default="active")  # "active" | "archived"
    favourite = Column(Boolean, default=False)  # added in a Phase 6 migration, predates Alembic
    # Nullable, retrofitted via a guarded ALTER TABLE before Alembic existed —
    # SQLite can't add an enforced FK to an existing table this way, so
    # cascade/null-out behavior on Home deletion is handled in application
    # code (see routers/homes.py) rather than relied on at the DB level.
    home_id = Column(Integer, ForeignKey("Homes.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(UTCDateTime, nullable=True)
    updated_at = Column(UTCDateTime, nullable=True)
    createdAt = Column(UTCDateTime, nullable=False)
    updatedAt = Column(UTCDateTime, nullable=False)

    home = relationship("Home")

    # Named to match the JSON key the frontend already expects (`listItems`,
    # from the Node/Sequelize API) rather than Python's snake_case convention
    # — Pydantic's from_attributes looks up this exact attribute name.
    listItems = relationship(
        "ListItem", back_populates="list", cascade="all, delete-orphan", passive_deletes=True
    )

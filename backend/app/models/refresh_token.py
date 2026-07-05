from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import UTCDateTime
from app.models.mixins import TimestampMixin


class RefreshToken(TimestampMixin, Base):
    """Server-side record of issued refresh tokens, so they can be revoked before
    their natural expiry (logout) — access tokens are short-lived and stateless
    and never get a table; only refresh tokens are dangerous enough for long to
    need this. Rotated (single-use) on every /api/auth/refresh call — see
    app/services/auth_service.py::rotate_refresh_token."""

    __tablename__ = "RefreshTokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("Users.id", ondelete="CASCADE"), index=True, nullable=False)
    jti: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

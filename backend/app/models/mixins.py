from datetime import UTC, datetime

from sqlalchemy.orm import Mapped, mapped_column

from app.db.types import UTCDateTime


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=lambda: datetime.now(UTC)
    )

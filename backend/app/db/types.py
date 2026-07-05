import re
from datetime import UTC, datetime

from sqlalchemy import String, TypeDecorator


class UTCDateTime(TypeDecorator):
    """Reads/writes the timestamp format Sequelize left in this DB.

    Existing rows are stored as e.g. '2024-07-07 05:11:19.614 +00:00' (space
    before the UTC offset, which datetime.fromisoformat rejects) and some
    legacy rows have '' instead of NULL. New rows are written in clean
    ISO-8601. Verified against the live database before relying on this.
    """

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat(timespec="milliseconds")

    def process_result_value(self, value, dialect):
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            fixed = re.sub(r" ([+-]\d{2}:\d{2})$", r"\1", value)
            return datetime.fromisoformat(fixed)

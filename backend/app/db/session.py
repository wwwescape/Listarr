from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings

database_url = get_settings().database_url
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine = create_engine(database_url, connect_args=connect_args)


@event.listens_for(Engine, "connect")
def _enable_foreign_keys(dbapi_connection, connection_record):
    # SQLite disables FK enforcement per-connection by default. Several
    # ListItems rows rely on ON DELETE CASCADE when a List is deleted.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

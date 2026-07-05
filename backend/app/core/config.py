from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent
DEFAULT_SQLITE_PATH = BACKEND_DIR / "db" / "listarr.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(REPO_ROOT / ".env"), extra="ignore")

    app_name: str = "Listarr API"

    # No bare `str` default — an empty-string env var would otherwise silently
    # override the sqlite fallback below.
    database_url_: str | None = Field(default=None, alias="database_url")

    # No default: enforced lazily in core/security.py only when a token is
    # actually created/decoded, not at import time.
    jwt_secret_key: str | None = None
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    cors_origins: list[str] = ["http://localhost:3000"]

    @property
    def database_url(self) -> str:
        if self.database_url_:
            return self.database_url_
        return f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"


@lru_cache
def get_settings() -> Settings:
    return Settings()

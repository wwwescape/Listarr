from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    # Deliberately has no `password` field — matches the Phase 0 fix where
    # Node's getUsers/createUser/getCollaborators stopped leaking the hash.
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    firstname: str
    lastname: str
    admin: bool | None = None
    status: str | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class UserCreate(BaseModel):
    username: str
    firstname: str
    lastname: str
    password: str


class UserUpdate(BaseModel):
    # admin/status intentionally excluded — not client-settable via this
    # endpoint, matching the Phase 0 mass-assignment fix.
    username: str | None = None
    firstname: str | None = None
    lastname: str | None = None
    password: str | None = None


class UserExistsOut(BaseModel):
    admin_exists: bool

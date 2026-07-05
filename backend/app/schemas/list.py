from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.home import HomeSummaryOut
from app.schemas.list_item import ListItemOut


class ListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    createdBy: str
    collaborators: list | None = None
    status: str | None = None
    favourite: bool = False
    home_id: int | None = None
    home: HomeSummaryOut | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class ListDetailOut(ListOut):
    listItems: list[ListItemOut] = []


class ListCreate(BaseModel):
    name: str
    collaborators: list | None = None
    home_id: int | None = None


class ListUpdate(BaseModel):
    name: str | None = None
    collaborators: list | None = None
    status: str | None = None
    favourite: bool | None = None
    home_id: int | None = None

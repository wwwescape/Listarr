from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AreaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    area_name: str
    status: str | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class AreaCreate(BaseModel):
    area_name: str
    status: str | None = None


class AreaUpdate(BaseModel):
    area_name: str | None = None
    status: str | None = None

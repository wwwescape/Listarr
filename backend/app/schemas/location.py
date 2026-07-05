from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    location_name: str
    status: str | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class LocationCreate(BaseModel):
    location_name: str
    status: str | None = None


class LocationUpdate(BaseModel):
    location_name: str | None = None
    status: str | None = None

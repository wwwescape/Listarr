from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_name: str
    status: str | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class CategoryCreate(BaseModel):
    category_name: str
    status: str | None = None


class CategoryUpdate(BaseModel):
    category_name: str | None = None
    status: str | None = None

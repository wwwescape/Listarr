from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.area import AreaOut
from app.schemas.category import CategoryOut


class ListItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    list_id: int
    item_id: int | None = None
    name: str
    quantity: float
    unit: str | None = None
    notes: str | None = None
    category_id: int | None = None
    area_id: int | None = None
    priority: str | None = None
    brand: str | None = None
    favourite: bool
    checked: bool
    checked_at: datetime | None = None
    position: int | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None
    category: CategoryOut | None = None
    area: AreaOut | None = None


class ListItemCreate(BaseModel):
    item_id: int | None = None
    name: str
    quantity: float | None = 1
    unit: str | None = None
    notes: str | None = None
    category_id: int | None = None
    area_id: int | None = None
    priority: str | None = "normal"
    brand: str | None = None
    favourite: bool | None = False


class ListItemUpdate(BaseModel):
    name: str | None = None
    quantity: float | None = None
    unit: str | None = None
    notes: str | None = None
    category_id: int | None = None
    area_id: int | None = None
    priority: str | None = None
    brand: str | None = None
    favourite: bool | None = None
    checked: bool | None = None
    position: int | None = None


class SuggestionsOut(BaseModel):
    # Historical ListItem rows (from any list) used as quick-add templates —
    # each field reuses ListItemOut's shape so the frontend can pull the
    # same category/area/brand/unit info it already knows how to render.
    favourites: list[ListItemOut] = []
    recent: list[ListItemOut] = []
    frequent: list[ListItemOut] = []

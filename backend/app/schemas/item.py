from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_name: str
    category_id: int
    status: str | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None
    # Not a DB column — computed and attached in the router (count of times
    # this catalog item has been checked off across all lists), used to sort
    # autocomplete suggestions by how often it's actually bought.
    purchase_count: int = 0


class ItemCreate(BaseModel):
    item_name: str
    category_id: int
    status: str | None = None


class ItemUpdate(BaseModel):
    item_name: str | None = None
    category_id: int | None = None
    status: str | None = None

from pydantic import BaseModel


class CountEntry(BaseModel):
    label: str
    count: int


class StatsOut(BaseModel):
    total_lists: int
    total_items: int
    completed_items: int
    completion_rate: int
    most_purchased: list[CountEntry]
    category_breakdown: list[CountEntry]
    activity_by_week: list[CountEntry]

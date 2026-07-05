from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserOut


class HomeSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class HomeMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    home_id: int
    user: UserOut
    role: str
    createdAt: datetime | None = None


class HomeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_by: int | None = None
    member_count: int = 0
    # The requesting user's own role in this household — None if they're
    # not a member (only possible for an Admin viewing a household they
    # don't personally belong to). Computed per-request, not stored.
    my_role: str | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class HomeDetailOut(HomeOut):
    members: list[HomeMemberOut] = []


class HomeMembershipOut(BaseModel):
    """A specific user's membership in one home — the shape User.tsx's
    Homes tab needs (that user's role there), distinct from HomeOut's
    `my_role` (the *requester's* own role)."""

    id: int
    name: str
    role: str
    member_count: int = 0


class HomeCreate(BaseModel):
    name: str
    owner_user_id: int


class HomeUpdate(BaseModel):
    name: str | None = None


class HomeMemberAdd(BaseModel):
    user_id: int
    role: Literal["member", "co_owner"] = "member"


class HomeMemberRoleUpdate(BaseModel):
    role: Literal["member", "co_owner"]


class HomeOwnerTransfer(BaseModel):
    user_id: int

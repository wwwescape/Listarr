from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_current_user, get_db
from app.models import User
from app.schemas.stats import StatsOut
from app.services import stats_service

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsOut)
def get_stats(db: DBSession = Depends(get_db), user: User = Depends(get_current_user)):
    return stats_service.get_stats(db, user)

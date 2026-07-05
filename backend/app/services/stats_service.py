from collections import Counter
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session as DBSession

from app.models import User
from app.repositories import stats_repository
from app.schemas.stats import CountEntry, StatsOut
from app.services import list_service


def get_stats(db: DBSession, user: User) -> StatsOut:
    accessible_lists = list_service.list_visible_lists(db, user)
    list_ids = [lst.id for lst in accessible_lists]

    items = stats_repository.list_items_for_lists(db, list_ids)
    checked_items = [i for i in items if i.checked]

    name_counts = Counter(i.name.strip().lower() for i in checked_items)
    most_purchased = [CountEntry(label=name, count=count) for name, count in name_counts.most_common(10)]

    category_counts = Counter(i.category.category_name for i in checked_items if i.category)
    category_breakdown = [CountEntry(label=name, count=count) for name, count in category_counts.most_common()]

    # "Shopping frequency" proxy: how many items were checked off per of the
    # last 8 calendar weeks — there's no explicit "trip" concept in the data
    # model, so checked_at timestamps are the closest signal to when the
    # user actually went shopping.
    now = datetime.now(UTC)
    week_buckets = []
    for i in range(7, -1, -1):
        week_start = now - timedelta(weeks=i + 1)
        week_end = now - timedelta(weeks=i)
        count = sum(1 for it in checked_items if it.checked_at and week_start <= it.checked_at < week_end)
        week_buckets.append(CountEntry(label=week_end.strftime("%b %d"), count=count))

    total_items = len(items)
    completion_rate = round(len(checked_items) / total_items * 100) if total_items else 0

    return StatsOut(
        total_lists=len(accessible_lists),
        total_items=total_items,
        completed_items=len(checked_items),
        completion_rate=completion_rate,
        most_purchased=most_purchased,
        category_breakdown=category_breakdown,
        activity_by_week=week_buckets,
    )

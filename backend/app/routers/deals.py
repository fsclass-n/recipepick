from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Deal, User
from ..schemas import DealOut
from ..security import get_current_user

router = APIRouter(prefix="/api/deals", tags=["deals"])


@router.get("", response_model=list[DealOut])
def list_deals(
    mart: str | None = None,
    category: str | None = None,
    q: str | None = None,
    closing_only: bool = False,
    sort: str = Query(default="discount", pattern="^(discount|price|recent)$"),
    limit: int = Query(default=200, le=500),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Deal)
    if mart:
        stmt = stmt.where(Deal.mart == mart)
    if category:
        stmt = stmt.where(Deal.category == category)
    if q:
        stmt = stmt.where(Deal.name.contains(q))
    if closing_only:
        stmt = stmt.where(Deal.is_closing_sale.is_(True))
    order = {"discount": Deal.discount_rate.desc(), "price": Deal.sale_price, "recent": Deal.collected_at.desc()}[sort]
    return db.scalars(stmt.order_by(order).limit(limit)).all()


@router.get("/summary")
def summary(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(
            Deal.mart,
            func.count(Deal.id),
            func.avg(Deal.discount_rate),
            func.sum(Deal.original_price - Deal.sale_price),
        ).group_by(Deal.mart)
    ).all()
    total_saving = sum(int(r[3] or 0) for r in rows)
    return {
        "marts": [
            {"mart": r[0], "count": r[1], "avg_discount": round(float(r[2] or 0), 1), "total_saving": int(r[3] or 0)}
            for r in rows
        ],
        "total_deals": sum(r[1] for r in rows),
        "total_saving": total_saving,
        "closing_count": db.scalar(select(func.count(Deal.id)).where(Deal.is_closing_sale.is_(True))) or 0,
        "categories": sorted({c for c in db.scalars(select(Deal.category).distinct())}),
        "last_collected_at": db.scalar(select(func.max(Deal.collected_at))),
    }

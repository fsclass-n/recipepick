import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import db_backend_name, get_db
from ..models import CrawlJob, Deal, Notification, Recipe, User
from ..schemas import AdminUserUpdate, CrawlerSettingsIn, CrawlJobOut, UserOut
from ..security import require_admin
from ..services.crawler import crawler_service
from ..services.notifier import manager

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    count = lambda m: db.scalar(select(func.count(m.id))) or 0  # noqa: E731
    return {
        "users": count(User),
        "admins": db.scalar(select(func.count(User.id)).where(User.role == "admin")) or 0,
        "deals": count(Deal),
        "recipes": count(Recipe),
        "notifications": count(Notification),
        "jobs": count(CrawlJob),
        "online_users": manager.online_count,
        "database": db_backend_name(),
    }


@router.get("/crawler")
def crawler_status():
    return crawler_service.status()


@router.post("/crawler/run", status_code=202)
async def crawler_run():
    if not await crawler_service.run_in_background("manual"):
        raise HTTPException(409, "이미 크롤링이 실행 중입니다.")
    return {"started": True}


@router.patch("/crawler")
def crawler_update(body: CrawlerSettingsIn):
    crawler_service.update(body.interval_minutes, body.enabled, body.mode)
    return crawler_service.status()


@router.get("/crawler/jobs", response_model=list[CrawlJobOut])
def crawler_jobs(limit: int = 30, db: Session = Depends(get_db)):
    return db.scalars(select(CrawlJob).order_by(CrawlJob.id.desc()).limit(min(limit, 100))).all()


@router.get("/crawler/stats")
def crawler_stats(db: Session = Depends(get_db)):
    """pandas 로 수집 데이터를 집계하고 Plotly figure JSON 을 반환한다."""
    # 무료 인스턴스 메모리 절약을 위해 무거운 분석 라이브러리는 호출 시점에 로드한다.
    import numpy as np
    import pandas as pd
    import plotly.express as px
    from plotly.utils import PlotlyJSONEncoder

    deals = pd.read_sql(select(Deal.mart, Deal.category, Deal.discount_rate, Deal.original_price,
                               Deal.sale_price, Deal.is_closing_sale), db.bind)
    jobs = pd.read_sql(select(CrawlJob.id, CrawlJob.status, CrawlJob.items_collected, CrawlJob.started_at)
                       .order_by(CrawlJob.id.desc()).limit(30), db.bind)
    layout = dict(margin=dict(l=40, r=10, t=40, b=40), paper_bgcolor="rgba(0,0,0,0)",
                  plot_bgcolor="rgba(0,0,0,0)", font=dict(family="Pretendard, sans-serif"))
    figs = {}
    if not deals.empty:
        deals["saving"] = deals["original_price"] - deals["sale_price"]
        by_cat = deals.groupby(["category", "mart"], as_index=False)["discount_rate"].mean().round(1)
        figs["discount_by_category"] = px.bar(
            by_cat, x="category", y="discount_rate", color="mart", barmode="group",
            title="카테고리·마트별 평균 할인율(%)", labels={"discount_rate": "할인율", "category": "", "mart": "마트"},
            color_discrete_sequence=["#16a34a", "#f97316", "#0ea5e9"],
        ).update_layout(**layout).to_plotly_json()
        # plotly.js basic 번들에는 histogram 트레이스가 없으므로 NumPy 로 구간을 나눠 막대그래프로 전달
        bins = np.arange(0, 70, 5)
        hist = pd.concat(
            pd.DataFrame({
                "구간": [f"{int(a)}~{int(b)}%" for a, b in zip(bins[:-1], bins[1:])],
                "건수": np.histogram(grp["discount_rate"], bins=bins)[0],
                "유형": "마감세일" if closing else "일반 할인",
            })
            for closing, grp in deals.groupby("is_closing_sale")
        )
        figs["discount_hist"] = px.bar(
            hist, x="구간", y="건수", color="유형", title="할인율 분포", barmode="stack",
            labels={"구간": "할인율 구간", "유형": ""},
            color_discrete_map={"일반 할인": "#84cc16", "마감세일": "#ef4444"},
        ).update_layout(**layout).to_plotly_json()
    if not jobs.empty:
        jobs = jobs.sort_values("id")
        figs["jobs_timeline"] = px.line(
            jobs, x="started_at", y="items_collected", markers=True, title="크롤링 수집 건수 추이",
            labels={"started_at": "", "items_collected": "수집 건수"}, color_discrete_sequence=["#16a34a"],
        ).update_layout(**layout).to_plotly_json()
    summary = {
        "avg_discount": round(float(deals["discount_rate"].mean()), 1) if not deals.empty else 0,
        "median_sale_price": int(deals["sale_price"].median()) if not deals.empty else 0,
        "total_saving": int(deals["saving"].sum()) if not deals.empty else 0,
        "success_rate": round(float((jobs["status"] != "failed").mean() * 100), 1) if not jobs.empty else 0,
    }
    return json.loads(json.dumps({"summary": summary, "figures": figs}, cls=PlotlyJSONEncoder))


@router.get("/users", response_model=list[UserOut])
def list_users(q: str | None = None, db: Session = Depends(get_db)):
    stmt = select(User).order_by(User.id)
    if q:
        stmt = stmt.where(User.email.contains(q) | User.name.contains(q))
    return db.scalars(stmt).all()


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: int, body: AdminUserUpdate, admin: User = Depends(require_admin),
                      db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "회원을 찾을 수 없습니다.")
    if user.id == admin.id and (body.role == "user" or body.is_active is False):
        raise HTTPException(400, "자기 자신의 관리자 권한/활성 상태는 변경할 수 없습니다.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    db.commit()
    out = UserOut.model_validate(user)
    manager.set_admin(user.id, user.role == "admin")
    await manager.send_user(user.id, {"type": "profile_changed", "data": out.model_dump(mode="json")})
    return out

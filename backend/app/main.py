import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, update

from .config import get_settings
from .database import Base, SessionLocal, db_backend_name, engine
from .models import CrawlJob, Deal, Recipe, User
from .routers import admin, auth, deals, fridge, notifications, recipes, ws
from .seed import seed_test_accounts
from .services.crawler import crawler_service
from .services.notifier import manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.is_production and settings.secret_key in {"", "dev-secret-change-me", "change-me-to-a-long-random-string"}:
        raise RuntimeError("프로덕션 환경에서는 SECRET_KEY 를 반드시 설정해야 합니다.")
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.execute(
            update(CrawlJob).where(CrawlJob.status == "running")
            .values(status="failed", log=CrawlJob.log + "\n서버 재시작으로 중단됨")
        )
        db.commit()
        if settings.seed_test_accounts:
            seed_test_accounts(db)
    manager.loop = asyncio.get_running_loop()
    crawler_service.start(run_on_start=settings.crawl_on_startup)
    yield
    await crawler_service.stop()


app = FastAPI(title="RecipePick API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_urls,
    allow_origin_regex=r"https://([a-z0-9-]+--)?recipepick\.netlify\.app"
    + ("" if settings.is_production else r"|http://(localhost|127\.0\.0\.1)(:\d+)?"),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def head_as_get(request: Request, call_next):
    """UptimeRobot 등 HEAD 헬스체크 지원: FastAPI는 GET 라우트에 HEAD를 자동 제공하지 않아
    HEAD 요청이 405가 되므로, GET처럼 처리해 200을 돌려준다."""
    if request.method == "HEAD":
        request.scope["method"] = "GET"
    return await call_next(request)


for r in (auth, fridge, deals, recipes, notifications, admin, ws):
    app.include_router(r.router)


@app.get("/")
def root():
    return {"service": "RecipePick API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "database": db_backend_name(),
        "gemini": bool(settings.gemini_api_key),
        "rpa_mode": crawler_service.mode,
        "crawler_running": crawler_service.running,
    }


@app.get("/api/public/stats")
def public_stats():
    """로그인 화면 실시간 식비 절약 통계 (인증 불필요)."""
    with SessionLocal() as db:
        row = db.execute(
            select(func.count(Deal.id), func.avg(Deal.discount_rate), func.sum(Deal.original_price - Deal.sale_price))
        ).one()
        top = db.scalars(select(Deal).order_by(Deal.discount_rate.desc()).limit(8)).all()
        return {
            "deals": row[0] or 0,
            "avg_discount": round(float(row[1] or 0), 1),
            "total_saving": int(row[2] or 0),
            "closing": db.scalar(select(func.count(Deal.id)).where(Deal.is_closing_sale.is_(True))) or 0,
            "users": db.scalar(select(func.count(User.id))) or 0,
            "recipes": db.scalar(select(func.count(Recipe.id))) or 0,
            "top_deals": [
                {
                    "name": d.name, "mart": d.mart, "category": d.category, "sale_price": d.sale_price,
                    "original_price": d.original_price, "discount_rate": d.discount_rate,
                    "is_closing_sale": d.is_closing_sale, "image_url": d.image_url, "source": d.source,
                }
                for d in top
            ],
        }

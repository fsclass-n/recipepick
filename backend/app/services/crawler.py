"""RPA 크롤러 스케줄러: 주기 실행, 수동 실행, 수집 결과 저장, 할인 매칭 알림 트리거."""

import asyncio
import logging
import threading
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select

from ..config import get_settings
from ..database import SessionLocal
from ..models import CrawlJob, Deal, FridgeItem, utcnow
from .matcher import find_matches, notify_match
from .notifier import manager, send_webhooks
from .storage import mirror_image_to_s3

log = logging.getLogger("recipepick.crawler")
settings = get_settings()


class CrawlerService:
    def __init__(self) -> None:
        self.enabled = True
        self.interval_minutes = settings.crawl_interval_minutes
        self.mode = settings.rpa_mode
        self.next_run_at: datetime | None = None
        self.current_job_id: int | None = None
        self._lock = threading.Lock()
        self._task: asyncio.Task | None = None
        self._wake = asyncio.Event()

    @property
    def running(self) -> bool:
        return self._lock.locked()

    def status(self) -> dict:
        return {
            "enabled": self.enabled,
            "interval_minutes": self.interval_minutes,
            "mode": self.mode,
            "running": self.running,
            "current_job_id": self.current_job_id,
            "next_run_at": self.next_run_at.isoformat() if self.next_run_at else None,
            "online_users": manager.online_count,
        }

    def _emit_status(self, extra: dict | None = None) -> None:
        manager.emit(manager.send_admins({"type": "crawl_status", "data": {**self.status(), **(extra or {})}}))

    def run_once(self, trigger: str = "manual") -> int | None:
        """동기 실행(스레드에서 호출). 이미 실행 중이면 None 반환."""
        if not self._lock.acquire(blocking=False):
            return None
        db = SessionLocal()
        lines: list[str] = []

        def add_log(msg: str) -> None:
            line = f"{datetime.now():%H:%M:%S} {msg}"
            lines.append(line)
            log.info(msg)

        job = CrawlJob(trigger=trigger, mode=self.mode, status="running")
        try:
            db.add(job)
            db.commit()
            self.current_job_id = job.id
            self._emit_status({"event": "started", "job_id": job.id})
            add_log(f"크롤링 시작 (trigger={trigger}, mode={self.mode})")

            from rpa import run_all

            wish = db.scalars(
                select(FridgeItem.name).where(FridgeItem.is_wishlist.is_(True)).group_by(FridgeItem.name)
                .order_by(func.count(FridgeItem.id).desc()).limit(6)
            ).all()
            result = run_all(mode=self.mode, log=add_log, keywords=list(wish))
            raw = result["deals"]
            marts = {d.mart for d in raw}
            if marts:
                db.execute(delete(Deal).where(Deal.mart.in_(marts)))
            # 수집 대상에서 빠진 마트(예: 오이마켓 → 오아시스마켓 교체)의 이전 할인 정보 정리
            from rpa.marts import CRAWLERS

            db.execute(delete(Deal).where(Deal.mart.not_in([c.label for c in CRAWLERS])))
            # 외부 핫링크 이미지를 S3로 미러링 (S3_BUCKET 미설정/실패 시 원본 유지)
            mirrored = {u: mirror_image_to_s3(u) for u in {d.image_url for d in raw if d.image_url}}
            new_deals = [
                Deal(
                    job_id=job.id,
                    mart=d.mart,
                    name=d.name,
                    category=d.category,
                    original_price=d.original_price,
                    sale_price=d.sale_price,
                    discount_rate=d.discount_rate,
                    unit=d.unit,
                    store=d.store,
                    url=d.url,
                    image_url=mirrored.get(d.image_url, d.image_url),
                    is_closing_sale=d.is_closing_sale,
                    source=d.source,
                    valid_until=d.valid_until,
                )
                for d in raw
            ]
            db.add_all(new_deals)
            db.flush()
            add_log(f"할인 상품 {len(new_deals)}건 저장 (소스: {result['sources']})")

            matches = find_matches(db, new_deals)
            events = [(user.id, notify_match(user, item, deal, db)) for user, item, deal in matches]
            db.commit()
            for user_id, event in events:
                manager.emit(manager.send_user(user_id, event))
            add_log(f"냉장고·장바구니 매칭 알림 {len(matches)}건 발송")

            closing = [m for m in matches if m[2].is_closing_sale]
            if closing:
                body = "\n".join(
                    f"- {u.name}: {i.name} → {d.mart} {d.sale_price:,}원 ({d.discount_rate}%↓)" for u, i, d in closing[:10]
                )
                channels = send_webhooks(f"마감세일 매칭 {len(closing)}건", body)
                if channels:
                    add_log(f"웹훅 발송: {', '.join(channels)}")

            sources = set(result["sources"].values())
            job.status = "success" if sources == {"live"} else ("partial" if "live" in sources else "success")
            job.mode = "live" if sources == {"live"} else ("demo" if sources == {"demo"} else "mixed")
            job.items_collected = len(new_deals)
            job.matches = len(matches)
        except Exception as e:
            db.rollback()
            add_log(f"크롤링 실패: {e.__class__.__name__}: {e}")
            job = db.get(CrawlJob, job.id) or job
            job.status = "failed"
        finally:
            job.finished_at = utcnow()
            job.log = "\n".join(lines)[-60000:]
            db.merge(job)
            db.commit()
            db.close()
            self.current_job_id = None
            self._lock.release()
            self._emit_status({"event": "finished", "job_id": job.id, "job_status": job.status})
        return job.id

    async def run_in_background(self, trigger: str = "manual") -> bool:
        if self.running:
            return False
        asyncio.get_running_loop().run_in_executor(None, self.run_once, trigger)
        return True

    async def _loop(self, run_on_start: bool) -> None:
        if run_on_start:
            await asyncio.sleep(settings.crawl_startup_delay_seconds)
            await asyncio.to_thread(self.run_once, "startup")
        while True:
            self.next_run_at = datetime.now() + timedelta(minutes=self.interval_minutes)
            self._wake.clear()
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=self.interval_minutes * 60)
                continue  # 설정 변경으로 깨어남 → 다음 실행 시각 재계산
            except asyncio.TimeoutError:
                pass
            if self.enabled:
                await asyncio.to_thread(self.run_once, "schedule")

    def start(self, run_on_start: bool) -> None:
        self._wake = asyncio.Event()
        self._task = asyncio.create_task(self._loop(run_on_start))

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    def update(self, interval_minutes: int | None, enabled: bool | None, mode: str | None) -> None:
        if interval_minutes:
            self.interval_minutes = interval_minutes
        if enabled is not None:
            self.enabled = enabled
        if mode:
            self.mode = mode
        self._wake.set()
        self._emit_status({"event": "settings"})

    def latest_job(self) -> CrawlJob | None:
        with SessionLocal() as db:
            return db.scalars(select(CrawlJob).order_by(CrawlJob.id.desc()).limit(1)).first()


crawler_service = CrawlerService()

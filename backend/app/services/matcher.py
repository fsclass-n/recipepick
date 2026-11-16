"""수집된 할인 상품과 사용자 냉장고/장바구니 재료를 매칭한다."""

import json
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Deal, FridgeItem, Notification, User

_TOKEN_SPLIT = re.compile(r"[\s()/·,]+")
_STOPWORDS = {"국내산", "국산", "친환경", "유기농", "무항생제", "동물복지", "1등급", "냉장", "냉동", "손질", "생", "혼합", "모둠"}


def deal_terms(name: str) -> set[str]:
    return {t for t in _TOKEN_SPLIT.split(name.lower()) if t and t not in _STOPWORDS}


def names_match(item_name: str, deal_name: str) -> bool:
    a, b = item_name.lower(), deal_name.lower()
    if (len(a) >= 2 and a in b) or (len(b) >= 2 and b in a):
        return True
    common = deal_terms(a) & deal_terms(b)
    return bool(common)


def best_deal_for_name(db: Session, name: str) -> Deal | None:
    deals = db.scalars(select(Deal).order_by(Deal.discount_rate.desc())).all()
    return next((d for d in deals if names_match(name, d.name)), None)


def cheapest_deal(db: Session, name: str) -> Deal | None:
    deals = [d for d in db.scalars(select(Deal).order_by(Deal.sale_price)).all() if names_match(name, d.name)]
    return deals[0] if deals else None


def find_matches(db: Session, deals: list[Deal]) -> list[tuple[User, FridgeItem, Deal]]:
    """새 할인 상품 x 모든 사용자의 냉장고/위시리스트 재료 매칭 결과를 반환한다.

    최근 24시간 내 같은 재료·마트·가격으로 이미 알림을 보냈다면 재알림하지 않는다.
    """
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
    matches: list[tuple[User, FridgeItem, Deal]] = []
    users = db.scalars(select(User).where(User.is_active.is_(True))).all()
    for user in users:
        items = db.scalars(select(FridgeItem).where(FridgeItem.user_id == user.id)).all()
        if not items:
            continue
        recent = db.scalars(
            select(Notification.payload).where(
                Notification.user_id == user.id,
                Notification.type == "deal_match",
                Notification.created_at >= since,
            )
        ).all()
        sent = set()
        for raw in recent:
            p = json.loads(raw or "{}")
            sent.add((p.get("item_name"), p.get("mart"), p.get("sale_price")))
        for item in items:
            candidates = [d for d in deals if names_match(item.name, d.name)]
            if not candidates:
                continue
            best = max(candidates, key=lambda d: (d.discount_rate, -d.sale_price))
            if (item.name, best.mart, best.sale_price) in sent:
                continue
            matches.append((user, item, best))
    return matches


def notify_match(user: User, item: FridgeItem, deal: Deal, db: Session) -> dict:
    title = "마감세일 매칭!" if deal.is_closing_sale else "할인가 매칭"
    tag = "⏰ 마감세일" if deal.is_closing_sale else "🏷️ 할인"
    message = (
        f"{item.name}이(가) {deal.mart}에서 {deal.sale_price:,}원 "
        f"(정가 {deal.original_price:,}원 대비 {deal.discount_rate}%↓, {deal.unit or deal.category}) — {tag}"
    )
    payload = {
        "item_name": item.name,
        "deal_id": deal.id,
        "mart": deal.mart,
        "sale_price": deal.sale_price,
        "is_wishlist": item.is_wishlist,
    }
    n = Notification(user_id=user.id, type="deal_match", title=title, message=message, payload=json.dumps(payload))
    db.add(n)
    db.flush()
    return {"id": n.id, "type": "notification", "notification": {
        "id": n.id, "type": n.type, "title": n.title, "message": n.message,
        "payload": payload, "is_read": False, "created_at": n.created_at.isoformat(),
    }}

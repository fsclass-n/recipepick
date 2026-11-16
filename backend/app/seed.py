from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import FridgeItem, User
from .security import hash_password

TEST_ACCOUNTS = {
    "user": {
        "email": "user@recipepick.dev",
        "password": "Recipe!2026",
        "name": "김건강(당뇨 관리)",
        "role": "user",
        "health_type": "diabetes",
        "allergies": "땅콩",
        "daily_kcal": 1800,
    },
    "admin": {
        "email": "admin@recipepick.dev",
        "password": "Admin!2026",
        "name": "시스템 관리자",
        "role": "admin",
        "health_type": "general",
        "allergies": "",
        "daily_kcal": 2200,
    },
}

SAMPLE_FRIDGE = [
    ("두부", "두부·콩", 1, "모", 3, False),
    ("양파", "채소", 2, "개", 10, False),
    ("계란", "유제품·계란", 6, "개", 12, False),
    ("시금치", "채소", 1, "단", 2, False),
    ("현미", "곡류", 1, "kg", 90, False),
    ("닭가슴살", "육류", 0, "팩", None, True),
    ("브로콜리", "채소", 0, "개", None, True),
    ("고등어", "수산", 0, "손", None, True),
]


def seed_test_accounts(db: Session) -> None:
    for acc in TEST_ACCOUNTS.values():
        if db.scalar(select(User).where(User.email == acc["email"])):
            continue
        data = {k: v for k, v in acc.items() if k != "password"}
        user = User(**data, password_hash=hash_password(acc["password"]))
        db.add(user)
        db.flush()
        if acc["role"] == "user":
            today = date.today()
            for name, cat, qty, unit, days, wish in SAMPLE_FRIDGE:
                db.add(FridgeItem(
                    user_id=user.id, name=name, category=cat, quantity=qty, unit=unit,
                    expires_at=today + timedelta(days=days) if days else None, is_wishlist=wish,
                ))
    db.commit()

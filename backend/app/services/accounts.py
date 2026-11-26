"""회원 탈퇴 · 관리자 강퇴 공통 처리."""

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..models import FridgeItem, Notification, Recipe, User
from ..seed import TEST_ACCOUNTS

PROTECTED_EMAILS = {acc["email"] for acc in TEST_ACCOUNTS.values()}


def ensure_deletable(db: Session, user: User) -> None:
    if user.email in PROTECTED_EMAILS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "데모용 테스트 계정은 탈퇴·강퇴할 수 없습니다.")
    if user.role == "admin":
        admins = db.scalar(select(func.count(User.id)).where(User.role == "admin", User.is_active.is_(True))) or 0
        if admins <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "마지막 관리자 계정은 삭제할 수 없습니다.")


def delete_account(db: Session, user: User) -> None:
    """회원과 냉장고·레시피·알림 데이터를 함께 삭제한다(SQLite 는 FK CASCADE 가 꺼져 있어 명시 삭제)."""
    for model in (FridgeItem, Recipe, Notification):
        db.execute(delete(model).where(model.user_id == user.id))
    db.delete(user)
    db.commit()

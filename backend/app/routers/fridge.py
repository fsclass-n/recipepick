from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Deal, FridgeItem, User
from ..schemas import DealOut, FridgeItemIn, FridgeItemOut, FridgeItemUpdate, FridgeScanIn
from ..security import get_current_user
from ..services.matcher import names_match
from ..services.vision import decode_image, scan_fridge

router = APIRouter(prefix="/api/fridge", tags=["fridge"])


def _with_deals(items: list[FridgeItem], deals: list[Deal]) -> list[FridgeItemOut]:
    out = []
    for item in items:
        cands = [d for d in deals if names_match(item.name, d.name)]
        best = max(cands, key=lambda d: (d.discount_rate, -d.sale_price)) if cands else None
        o = FridgeItemOut.model_validate(item)
        o.matched_deal = DealOut.model_validate(best) if best else None
        out.append(o)
    return out


def _get_item(db: Session, user: User, item_id: int) -> FridgeItem:
    item = db.get(FridgeItem, item_id)
    if not item or item.user_id != user.id:
        raise HTTPException(404, "재료를 찾을 수 없습니다.")
    return item


@router.get("", response_model=list[FridgeItemOut])
def list_items(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.scalars(
        select(FridgeItem).where(FridgeItem.user_id == user.id).order_by(FridgeItem.is_wishlist, FridgeItem.expires_at)
    ).all()
    return _with_deals(list(items), list(db.scalars(select(Deal)).all()))


@router.post("/scan")
def scan(body: FridgeScanIn, user: User = Depends(get_current_user)):
    """냉장고 사진을 Gemini 로 분석해 식재료 후보를 반환한다(저장하지 않음)."""
    return scan_fridge(decode_image(body.image, body.mime), body.mime)


@router.post("", response_model=FridgeItemOut, status_code=201)
def add_item(body: FridgeItemIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = FridgeItem(user_id=user.id, **body.model_dump())
    db.add(item)
    db.commit()
    return _with_deals([item], list(db.scalars(select(Deal)).all()))[0]


@router.patch("/{item_id}", response_model=FridgeItemOut)
def update_item(
    item_id: int, body: FridgeItemUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    item = _get_item(db, user, item_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    return _with_deals([item], list(db.scalars(select(Deal)).all()))[0]


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_get_item(db, user, item_id))
    db.commit()

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Deal, FridgeItem, Recipe, User
from ..schemas import HEALTH_TYPES, RecipeOut, RecipeRequest
from ..security import get_current_user
from ..services.gemini import create_recipe
from ..services.matcher import names_match

router = APIRouter(prefix="/api/recipes", tags=["recipes"])

HEALTHY_CATEGORIES = {"채소", "두부·콩", "수산", "육류", "곡류", "유제품·계란", "과일"}


def _deal_dict(d: Deal) -> dict:
    return {
        "id": d.id, "name": d.name, "mart": d.mart, "category": d.category, "unit": d.unit,
        "sale_price": d.sale_price, "original_price": d.original_price,
        "discount_rate": d.discount_rate, "is_closing_sale": d.is_closing_sale,
    }


def _to_out(r: Recipe) -> RecipeOut:
    return RecipeOut(id=r.id, title=r.title, health_type=r.health_type, source=r.source,
                     data=json.loads(r.data), created_at=r.created_at)


@router.get("/health-types")
def health_types():
    return HEALTH_TYPES


@router.post("/generate", response_model=RecipeOut)
def generate(body: RecipeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.scalars(select(FridgeItem).where(FridgeItem.user_id == user.id)).all()
    if body.fridge_item_ids:
        fridge = [i for i in items if i.id in body.fridge_item_ids]
    else:
        fridge = [i for i in items if not i.is_wishlist and i.quantity > 0]
    fridge_names = [i.name for i in fridge] + [x.strip() for x in body.extra_ingredients if x.strip()]

    all_deals = db.scalars(select(Deal).order_by(Deal.discount_rate.desc())).all()
    chosen: dict[int, Deal] = {d.id: d for d in all_deals if d.id in body.deal_ids}
    if body.use_top_deals:
        wish = [i.name for i in items if i.is_wishlist]
        for d in all_deals:
            if any(names_match(n, d.name) for n in wish + fridge_names):
                chosen.setdefault(d.id, d)
        for d in all_deals:
            if len(chosen) >= 8:
                break
            if d.category in HEALTHY_CATEGORIES:
                chosen.setdefault(d.id, d)
    deals = [_deal_dict(d) for d in list(chosen.values())[:10]]

    health_type = body.health_type or user.health_type
    allergy_note = f"알레르기: {user.allergies} (절대 사용 금지)" if user.allergies else ""
    notes = " / ".join(x for x in (body.notes, allergy_note) if x)
    data, source = create_recipe(
        fridge_names, deals, health_type, body.servings, body.max_minutes, notes, user.daily_kcal
    )
    data["used_deals"] = deals
    data["fridge_ingredients"] = fridge_names
    recipe = Recipe(user_id=user.id, title=str(data.get("title", "맞춤 레시피"))[:200],
                    health_type=health_type, source=source, data=json.dumps(data, ensure_ascii=False))
    db.add(recipe)
    db.commit()
    return _to_out(recipe)


@router.get("", response_model=list[RecipeOut])
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Recipe).where(Recipe.user_id == user.id).order_by(Recipe.id.desc()).limit(30)).all()
    return [_to_out(r) for r in rows]


@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id)
    if not r or r.user_id != user.id:
        raise HTTPException(404, "레시피를 찾을 수 없습니다.")
    db.delete(r)
    db.commit()

"""Google Gemini 기반 맞춤형 레시피 창작.

GEMINI_API_KEY 가 없거나 API 호출이 실패하면 규칙 기반 템플릿 레시피로 대체한다(source=fallback).
"""

import json
import logging
import re

from ..config import get_settings
from ..schemas import HEALTH_TYPES

log = logging.getLogger("recipepick.gemini")
settings = get_settings()

RECIPE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "servings": {"type": "integer"},
        "cook_minutes": {"type": "integer"},
        "difficulty": {"type": "string", "enum": ["쉬움", "보통", "어려움"]},
        "ingredients": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "amount": {"type": "string"},
                    "from_deal": {"type": "boolean"},
                },
                "required": ["name", "amount"],
            },
        },
        "steps": {"type": "array", "items": {"type": "string"}},
        "nutrition_per_serving": {
            "type": "object",
            "properties": {
                "kcal": {"type": "integer"},
                "carbs_g": {"type": "integer"},
                "protein_g": {"type": "integer"},
                "fat_g": {"type": "integer"},
                "sodium_mg": {"type": "integer"},
            },
            "required": ["kcal", "carbs_g", "protein_g", "fat_g", "sodium_mg"],
        },
        "substitutions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"original": {"type": "string"}, "alternative": {"type": "string"}},
                "required": ["original", "alternative"],
            },
        },
        "health_tips": {"type": "array", "items": {"type": "string"}},
        "estimated_cost": {"type": "integer"},
    },
    "required": [
        "title",
        "summary",
        "servings",
        "cook_minutes",
        "difficulty",
        "ingredients",
        "steps",
        "nutrition_per_serving",
        "health_tips",
    ],
}


def _build_prompt(
    fridge: list[str], deals: list[dict], health_type: str, servings: int, max_minutes: int, notes: str, daily_kcal: int
) -> str:
    health = HEALTH_TYPES.get(health_type, HEALTH_TYPES["general"])
    deal_lines = "\n".join(
        f"- {d['name']} ({d['mart']}): {d['sale_price']:,}원 ({d['discount_rate']}% 할인, "
        f"{d['unit'] or d['category']}{' 마감세일' if d.get('is_closing_sale') else ''})"
        for d in deals
    )
    fridge_lines = "\n".join(f"- {n}" for n in fridge) or "- (냉장고 비어있음)"
    return f"""당신은 임상영양사이자 요리 전문가입니다. 아래 조건으로 한국 가정식 레시피 1개를 창작하세요.

[사용자 건강 상태] {health['label']} — {health['guide']} (1일 목표 {daily_kcal}kcal)

[냉장고 보유 재료]
{fridge_lines}

[마트 할인 식재료 — 가급적 주재료로 활용]
{deal_lines or '- (할인 정보 없음)'}

[조건]
- {servings}인분, 조리시간 {max_minutes}분 이내
- 할인 재료를 최대한 활용하고, 냉장고 재료와 조합
- ingredients 에서 마트 할인 재료는 from_deal: true 로 표시
- 영양 성분은 1인분 기준 합리적으로 추정
- substitutions 에는 없는 재료 대신 쓸 수 있는 대체 식재료 제시
- 모든 텍스트는 자연스러운 한국어로 작성
- health_tips 에는 {health['label']} 관점의 주의점/꿀팁 2~3개
{notes and f'- 추가 요청사항: {notes}'}
"""


# 설정 모델이 단종(404)·과부하(503)·시간 초과일 때 순서대로 시도하는 대체 모델
FALLBACK_MODELS = ("gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash")


def _model_chain() -> list[str]:
    return list(dict.fromkeys([settings.gemini_model, *settings.gemini_fallback_models, *FALLBACK_MODELS]))


def _call_gemini(prompt: str, model: str) -> dict:
    from google import genai
    from google.genai import types

    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(timeout=settings.gemini_timeout_seconds * 1000),
    )
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RECIPE_SCHEMA,
            temperature=0.7,
            thinking_config=types.ThinkingConfig(thinking_level="low"),
        ),
    )
    text = response.text or ""
    return json.loads(re.sub(r"^```json|```$", "", text.strip(), flags=re.MULTILINE))


def _short_name(name: str) -> str:
    """'씨제이 행복한콩 국산콩 작은 연두부 140G' → '연두부' (브랜드·중량 제거)"""
    cleaned = re.sub(r"\(.*?\)|\[.*?\]", " ", name)
    tokens = [t for t in re.split(r"[\s/,]+", cleaned) if t and not re.search(r"\d", t)]
    return tokens[-1] if tokens else name


def _fallback_recipe(
    fridge: list[str], deals: list[dict], health_type: str, servings: int, max_minutes: int
) -> dict:
    """API 키가 없거나 호출 실패 시 규칙 기반 레시피를 생성한다."""
    health = HEALTH_TYPES.get(health_type, HEALTH_TYPES["general"])
    mains = [d for d in deals if d["category"] in {"육류", "수산", "두부·콩"}][:2] or deals[:1]
    veggies = [d for d in deals if d["category"] in {"채소", "과일"}][:3]
    carbs = [d for d in deals if d["category"] == "곡류"][:1]
    used = mains + veggies + carbs
    names = [_short_name(d["name"]) for d in used] or fridge[:3] or ["냉장고 재료"]

    title = f"{health['label']} {names[0]} 한끼 볶음" if health_type != "diet" else f"저칼로리 {names[0]} 샐러드볼"
    ingredients = [
        {"name": d["name"], "amount": f"{d['unit'] or '1개'} ({d['mart']} {d['discount_rate']}% 할인)", "from_deal": True}
        for d in used
    ] + [{"name": n, "amount": "냉장고 보유분", "from_deal": False} for n in fridge[:4]]
    steps = [
        "재료를 먹기 좋은 크기로 썰어 준비합니다.",
        f"팬에 기름을 두르고 {names[0]}를 먼저 익힙니다." if health_type != "diet" else "재료를 볼에 담고 드레싱을 준비합니다.",
        "채소류를 넣고 중불에서 함께 조리합니다.",
        ("소금 대신 후추·허브로 간을 맞춥니다." if health_type == "hypertension" else "간장·다진 마늘로 간을 맞춥니다."),
        "접시에 담고 바로 제공합니다.",
    ]
    tips = {
        "general": ["가공식품 대신 신선한 할인 채소를 사용해 나트륨 섭취를 줄였습니다.", "단백질·채소·곡물을 한 접시에 균형 있게 담으세요."],
        "diabetes": ["혈당 곡선을 완만하게 하려면 채소부터 먼저 드세요.", "현미·잡곡밥은 흰쌀밥 대비 GI가 낮아 혈당 관리에 유리합니다.", "1회 탄수화물 섭취량을 45~60g으로 유지하세요."],
        "diet": ["포만감이 높은 채소를 먼저 먹으면 자연스럽게 과식을 방지할 수 있습니다.", "소스는 별도 그릇에 담아 찍어 드세요."],
        "hypertension": ["간장·된장 대신 식초·레몬즙·허브로 풍미를 더하면 나트륨을 크게 줄일 수 있습니다.", "칼륨이 많은 채소는 나트륨 배출을 돕습니다."],
        "cholesterol": ["붉은 육류 대신 두부·흰살 생선을 단백질원으로 선택하세요.", "조리 시 버터 대신 소량의 올리브유를 사용하세요."],
    }
    return {
        "title": title,
        "summary": f"마트 할인 식재료 {len(used)}종으로 만드는 {health['label']} 맞춤 한끼입니다.",
        "servings": servings,
        "cook_minutes": min(max_minutes, 25),
        "difficulty": "쉬움",
        "ingredients": ingredients,
        "steps": steps,
        "nutrition_per_serving": {"kcal": 450 if health_type != "diet" else 320, "carbs_g": 40, "protein_g": 30, "fat_g": 12, "sodium_mg": 480 if health_type == "hypertension" else 800},
        "substitutions": [
            {"original": names[0], "alternative": "두부" if "닭" in names[0] else "닭가슴살 또는 두부"},
            {"original": "간장", "alternative": "코코넛 아미노스"},
        ],
        "health_tips": tips.get(health_type, tips["general"]),
        "estimated_cost": sum(d["sale_price"] for d in used) or 8000,
    }


def create_recipe(
    fridge: list[str],
    deals: list[dict],
    health_type: str = "general",
    servings: int = 2,
    max_minutes: int = 30,
    notes: str = "",
    daily_kcal: int = 2000,
) -> tuple[dict, str]:
    """return: (recipe_dict, source) — source 는 'gemini' 또는 'fallback'"""
    if not settings.gemini_api_key:
        log.info("GEMINI_API_KEY 미설정 → fallback 레시피 사용")
        data = _fallback_recipe(fridge, deals, health_type, servings, max_minutes)
        return {**data, "fallback_reason": "no_api_key"}, "fallback"
    prompt = _build_prompt(fridge, deals, health_type, servings, max_minutes, notes, daily_kcal)
    for model in _model_chain():
        try:
            data = _call_gemini(prompt, model)
            data.setdefault("servings", servings)
            data["model"] = model
            return data, "gemini"
        except Exception as e:
            log.warning("Gemini(%s) 호출 실패 → 다음 모델 시도: %s", model, str(e)[:200])
    data = _fallback_recipe(fridge, deals, health_type, servings, max_minutes)
    return {**data, "fallback_reason": "ai_error"}, "fallback"

"""냉장고 사진 → 식재료 목록 인식 (Gemini 멀티모달).

이미지는 저장하지 않고 인식 결과만 돌려준다. 사용자가 확인한 항목만 프런트엔드가 냉장고에 등록한다.
"""

import base64
import binascii
import json
import logging
import re

from fastapi import HTTPException, status

from ..config import get_settings
from .gemini import _model_chain

log = logging.getLogger("recipepick.vision")
settings = get_settings()

CATEGORIES = ["채소", "과일", "육류", "수산", "유제품·계란", "두부·콩", "곡류", "베이커리·간편식", "기타"]
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024

SCAN_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "category": {"type": "string", "enum": CATEGORIES},
                    "quantity": {"type": "number"},
                    "unit": {"type": "string"},
                    "confidence": {"type": "number"},
                },
                "required": ["name", "category", "quantity", "unit"],
            },
        },
        "note": {"type": "string"},
    },
    "required": ["items"],
}

PROMPT = """사진은 사용자의 냉장고(또는 식재료) 내부입니다. 보이는 식재료를 모두 찾아 목록으로 만드세요.
- name: 한국 가정에서 부르는 짧은 식재료명(브랜드·용량 제외, 예: "계란", "대파", "우유")
- category: 주어진 분류 중 하나
- quantity/unit: 눈으로 셀 수 있으면 개수와 단위(개, 팩, 병, 봉, 단, 모 등), 어려우면 1과 가장 자연스러운 단위
- confidence: 0~1 사이 확신도
- 식재료가 아닌 물건(그릇, 용기, 냉장고 부품)은 제외하고, 같은 재료는 하나로 합치세요.
- note: 사진이 흐리거나 식재료가 없으면 그 이유를 한 문장으로."""


def decode_image(data: str, mime: str) -> bytes:
    if mime not in ALLOWED_MIME:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "JPEG·PNG·WEBP 이미지만 업로드할 수 있습니다.")
    try:
        raw = base64.b64decode(re.sub(r"^data:[^,]+,", "", data), validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미지 데이터를 해석할 수 없습니다.")
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "빈 이미지입니다.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "이미지는 5MB 이하만 업로드할 수 있습니다.")
    return raw


def _call_vision(image: bytes, mime: str, model: str) -> dict:
    from google import genai
    from google.genai import types

    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(timeout=settings.gemini_timeout_seconds * 1000),
    )
    response = client.models.generate_content(
        model=model,
        contents=[types.Part.from_bytes(data=image, mime_type=mime), PROMPT],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SCAN_SCHEMA,
            temperature=0.2,
        ),
    )
    return json.loads(re.sub(r"^```json|```$", "", (response.text or "").strip(), flags=re.MULTILINE))


def scan_fridge(image: bytes, mime: str) -> dict:
    if not settings.gemini_api_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI 사진 인식을 사용하려면 서버에 GEMINI_API_KEY 가 필요합니다.")
    for model in _model_chain():
        try:
            data = _call_vision(image, mime, model)
            break
        except Exception as e:
            log.warning("Gemini vision(%s) 실패 → 다음 모델: %s", model, str(e)[:200])
    else:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "AI 사진 인식에 실패했습니다. 잠시 후 다시 시도해 주세요.")
    items, seen = [], set()
    for it in data.get("items", []):
        name = str(it.get("name", "")).strip()[:100]
        if not name or name in seen:
            continue
        seen.add(name)
        items.append({
            "name": name,
            "category": it.get("category") if it.get("category") in CATEGORIES else "기타",
            "quantity": max(0.0, min(float(it.get("quantity") or 1), 999)),
            "unit": str(it.get("unit") or "개").strip()[:20] or "개",
            "confidence": round(float(it.get("confidence") or 0), 2),
        })
    return {"items": items, "note": str(data.get("note") or ""), "model": model}

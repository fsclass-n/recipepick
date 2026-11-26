from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

HealthType = Literal["general", "diabetes", "diet", "hypertension", "cholesterol"]
ChefStyle = Literal["", "baek", "ahn", "lee", "choi", "shim"]

# 셰프 스타일: 각 셰프가 공개적으로 알려진 요리 철학에서 영감을 받은 조리 방향(공식 레시피·제휴 아님)
CHEF_STYLES: dict[str, dict] = {
    "baek": {"chef": "백종원", "label": "대중 집밥", "guide": "누구나 따라 하는 실패 없는 집밥. 구하기 쉬운 재료, 숟가락·컵 계량, 간장·다진 마늘·설탕의 단짠 균형(건강 기준 안에서 당·나트륨은 줄여서), 응용 팁 제시"},
    "ahn": {"chef": "안성재", "label": "파인다이닝", "guide": "재료 본연의 맛을 살리는 절제된 간, 정확한 온도·시간, 한식 재료의 현대적 재해석, 마지막 단계에 플레이팅 방법 포함"},
    "lee": {"chef": "이연복", "label": "정통 중식", "guide": "센 불 웍 요리, 파기름·생강·굴소스 활용, 기름 온도와 불 조절, 전분물로 농도를 맞추는 빠른 중식 조리법"},
    "choi": {"chef": "최현석", "label": "창작 퓨전", "guide": "의외의 재료 조합과 소스 아이디어로 창의적인 퓨전 요리, 시각적 포인트와 재치 있는 요리명"},
    "shim": {"chef": "심영순", "label": "전통 한식", "guide": "전통 한식·궁중음식 방식. 양념장 비율과 밑간, 제철 재료와 장(醬) 활용, 고명과 정갈한 조리 순서"},
}

HEALTH_TYPES: dict[str, dict] = {
    "general": {"label": "일반 건강식", "guide": "균형 잡힌 영양소 구성, 가공식품 최소화"},
    "diabetes": {
        "label": "당뇨 관리",
        "guide": "저GI 식재료, 정제 탄수화물·설탕 최소화, 식이섬유와 단백질 강화, 1회 탄수화물 45~60g 이하",
    },
    "diet": {
        "label": "다이어트",
        "guide": "1인분 500kcal 이하, 고단백·고식이섬유, 튀김·당류 배제, 포만감 높은 채소 활용",
    },
    "hypertension": {
        "label": "고혈압 관리",
        "guide": "1인분 나트륨 600mg 이하(DASH 식단), 칼륨 풍부 채소, 젓갈·장류 사용 최소화",
    },
    "cholesterol": {
        "label": "고지혈증 관리",
        "guide": "포화지방·트랜스지방 최소화, 오메가-3 및 식이섬유 강화, 붉은 육류 대신 생선·두부",
    },
}


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORM):
    id: int
    email: str
    name: str
    role: str
    provider: str
    health_type: str
    allergies: str
    daily_kcal: int
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str = Field(min_length=1, max_length=100)
    health_type: HealthType = "general"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class WithdrawIn(BaseModel):
    password: str | None = Field(default=None, max_length=128)
    confirm: str = Field(default="", max_length=20)


class AdminKeyIn(BaseModel):
    access_key: str = Field(min_length=1, max_length=256)


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    health_type: HealthType | None = None
    allergies: str | None = Field(default=None, max_length=500)
    daily_kcal: int | None = Field(default=None, ge=800, le=5000)


class AdminUserUpdate(BaseModel):
    role: Literal["user", "admin"] | None = None
    health_type: HealthType | None = None
    is_active: bool | None = None


class FridgeItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: str = "기타"
    quantity: float = Field(default=1, ge=0)
    unit: str = "개"
    expires_at: date | None = None
    is_wishlist: bool = False


class FridgeScanIn(BaseModel):
    image: str = Field(min_length=10, max_length=7_500_000)  # base64 (data URL 허용), 디코딩 후 5MB 이하
    mime: str = "image/jpeg"


class FridgeItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    category: str | None = None
    quantity: float | None = Field(default=None, ge=0)
    unit: str | None = None
    expires_at: date | None = None
    is_wishlist: bool | None = None


class DealOut(ORM):
    id: int
    mart: str
    name: str
    category: str
    original_price: int
    sale_price: int
    discount_rate: float
    unit: str
    store: str
    url: str
    image_url: str
    is_closing_sale: bool
    source: str
    valid_until: datetime | None = None
    collected_at: datetime


class FridgeItemOut(ORM):
    id: int
    name: str
    category: str
    quantity: float
    unit: str
    expires_at: date | None = None
    is_wishlist: bool
    created_at: datetime
    matched_deal: DealOut | None = None


class RecipeRequest(BaseModel):
    fridge_item_ids: list[int] = []
    deal_ids: list[int] = []
    extra_ingredients: list[str] = []
    use_top_deals: bool = True
    health_type: HealthType | None = None
    servings: int = Field(default=2, ge=1, le=8)
    max_minutes: int = Field(default=30, ge=5, le=180)
    notes: str = Field(default="", max_length=500)
    style: ChefStyle = ""


class RecipeOut(ORM):
    id: int
    title: str
    health_type: str
    source: str
    data: dict
    created_at: datetime


class NotificationOut(ORM):
    id: int
    type: str
    title: str
    message: str
    payload: dict
    is_read: bool
    created_at: datetime


class CrawlJobOut(ORM):
    id: int
    trigger: str
    mode: str
    status: str
    items_collected: int
    matches: int
    log: str
    started_at: datetime
    finished_at: datetime | None = None


class CrawlerSettingsIn(BaseModel):
    interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    enabled: bool | None = None
    mode: Literal["live", "demo", "auto"] | None = None

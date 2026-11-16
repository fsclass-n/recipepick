"""대형마트 할인 식재료 크롤러 공통 모듈 (Playwright 렌더링 + BeautifulSoup 파싱)."""

from __future__ import annotations

import hashlib
import random
import re
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from urllib.parse import quote, urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "채소": ("양파", "대파", "배추", "양배추", "브로콜리", "시금치", "애호박", "오이", "당근", "버섯", "파프리카", "상추", "감자", "고구마", "토마토", "무"),
    "과일": ("사과", "바나나", "딸기", "블루베리", "귤", "배", "포도", "키위", "아보카도"),
    "육류": ("돼지", "삼겹", "목살", "앞다리", "소고기", "한우", "우둔", "닭", "닭가슴살", "닭다리", "닭고기", "안심", "등심", "오리"),
    "수산": ("고등어", "연어", "오징어", "새우", "갈치", "조개", "전복", "참치", "명태"),
    "유제품·계란": ("우유", "요거트", "치즈", "계란", "달걀", "두유"),
    "두부·콩": ("두부", "콩나물", "숙주", "낫토", "병아리콩"),
    "곡류": ("현미", "귀리", "쌀", "잡곡", "퀴노아", "통밀"),
    "베이커리·간편식": ("빵", "샐러드", "도시락", "김밥", "초밥", "만두"),
}

NON_FOOD_RE = re.compile(
    r"찜기|냄비|프라이팬|용기|보관함|밀폐|트레이|커터|슬라이서|조리기|에어프라이어|전자레인지|그릇|접시|도마|"
    r"수세미|세제|장난감|사료|간식\s*펫|강아지|고양이|화분|씨앗|모종|비료|스티커|키링|인형"
)

PRICE_RE = re.compile(r"(\d{1,3}(?:,\d{3})+|\d+)\s*원?")


def guess_category(name: str) -> str:
    """가장 긴 키워드가 일치하는 카테고리를 선택한다. 1글자 키워드는 단어 단위로만 비교한다."""
    tokens = set(re.split(r"[\s()\[\]/·,]+", name))
    best, best_len = "기타", 0
    for cat, words in CATEGORY_KEYWORDS.items():
        for w in words:
            hit = (w in tokens) if len(w) == 1 else (w in name)
            if hit and len(w) > best_len:
                best, best_len = cat, len(w)
    return best


def parse_price(text: str | None) -> int | None:
    if not text:
        return None
    m = PRICE_RE.search(text.replace(" ", ""))
    return int(m.group(1).replace(",", "")) if m else None


@dataclass
class RawDeal:
    mart: str
    name: str
    original_price: int
    sale_price: int
    category: str = "기타"
    unit: str = ""
    store: str = "온라인몰"
    url: str = ""
    image_url: str = ""
    is_closing_sale: bool = False
    source: str = "live"
    valid_until: datetime | None = None
    discount_rate: float = field(init=False)

    def __post_init__(self) -> None:
        self.original_price = max(self.original_price, self.sale_price)
        self.discount_rate = (
            round((1 - self.sale_price / self.original_price) * 100, 1) if self.original_price else 0.0
        )
        if self.category == "기타":
            self.category = guess_category(self.name)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Selectors:
    card: str
    name: str
    sale_price: str
    original_price: str
    link: str = "a"
    image: str = "img"


class BaseMartCrawler:
    """마트별 크롤러는 key/label/search_url/selectors 만 정의하면 된다.

    - robots.txt 를 확인해 허용된 경로만 수집한다.
    - 요청 사이에 crawl_delay 초 만큼 대기해 대상 서버 부하를 최소화한다.
    - live_enabled=False 인 마트는 접근 정책(봇 차단·robots 비허용) 때문에 라이브 수집을 하지 않는다.
    """

    key: str = ""
    label: str = ""
    base_url: str = ""
    search_url: str = ""
    selectors: Selectors
    wait_selector: str | None = None
    live_enabled: bool = True
    disabled_reason: str = ""
    crawl_delay: float = 2.0
    user_agent: str = "Mozilla/5.0 (compatible; RecipePickBot/1.0; +https://github.com/fsclass-n/recipepick)"
    closing_keywords: tuple[str, ...] = ("마감", "타임", "오늘만", "반짝")
    _robots: dict[str, RobotFileParser] = {}

    def build_urls(self, keywords: list[str]) -> list[str]:
        return [self.search_url.format(q=quote(k)) for k in keywords]

    def allowed_by_robots(self, url: str) -> bool:
        parts = urlsplit(url)
        root = f"{parts.scheme}://{parts.netloc}"
        rp = self._robots.get(root)
        if rp is None:
            rp = RobotFileParser()
            try:
                res = requests.get(f"{root}/robots.txt", timeout=10, headers={"User-Agent": self.user_agent})
                rp.parse(res.text.splitlines() if res.status_code == 200 else [])
            except requests.RequestException:
                rp.parse([])
            self._robots[root] = rp
        return rp.can_fetch(self.user_agent, url)

    def fetch_html(self, page, url: str, timeout_ms: int) -> str:
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        try:
            page.wait_for_selector(self.wait_selector or self.selectors.card, timeout=timeout_ms // 2)
        except Exception:
            pass
        for _ in range(2):
            page.mouse.wheel(0, 2500)
            page.wait_for_timeout(600)
        return page.content()

    def parse(self, html: str, page_url: str) -> list[RawDeal]:
        soup = BeautifulSoup(html, "html.parser")
        s = self.selectors
        deals: list[RawDeal] = []
        for card in soup.select(s.card):
            name_el = card.select_one(s.name)
            sale = parse_price(getattr(card.select_one(s.sale_price), "text", None))
            orig = parse_price(getattr(card.select_one(s.original_price), "text", None))
            if not name_el or not sale or not orig or orig <= sale or sale < orig * 0.1:
                continue
            name = " ".join(name_el.get_text(" ").split())
            if NON_FOOD_RE.search(name):
                continue
            link = card.select_one(s.link)
            img = card.select_one(s.image)
            deals.append(
                RawDeal(
                    mart=self.label,
                    name=name[:200],
                    original_price=orig,
                    sale_price=sale,
                    url=urljoin(page_url, link.get("href", "")) if link else page_url,
                    image_url=(img.get("src") or img.get("data-src") or "") if img else "",
                    is_closing_sale=any(k in card.get_text() for k in self.closing_keywords),
                    valid_until=datetime.now().replace(hour=23, minute=59, second=0, microsecond=0),
                )
            )
        return deals

    def crawl_live(self, browser, timeout_ms: int, log, keywords: list[str]) -> list[RawDeal]:
        context = browser.new_context(
            locale="ko-KR",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/130.0 Safari/537.36 RecipePickBot/1.0"
            ),
            viewport={"width": 1366, "height": 900},
        )
        context.route(
            "**/*",
            lambda route: route.abort()
            if route.request.resource_type in {"media", "font"}
            else route.continue_(),
        )
        page = context.new_page()
        results: list[RawDeal] = []
        try:
            for i, url in enumerate(self.build_urls(keywords)):
                if not self.allowed_by_robots(url):
                    log(f"[{self.label}] robots.txt 비허용 → 건너뜀: {url}")
                    continue
                if i:
                    time.sleep(self.crawl_delay)
                html = self.fetch_html(page, url, timeout_ms)
                found = self.parse(html, page.url)
                log(f"[{self.label}] '{keywords[i]}' → 할인 상품 {len(found)}건")
                results.extend(found)
        finally:
            context.close()
        unique = {d.name: d for d in results}
        return list(unique.values())

    def demo_deals(self, now: datetime | None = None) -> list[RawDeal]:
        """라이브 수집이 불가한 환경(방화벽/봇 차단/로컬 데모)을 위한 시뮬레이션 데이터."""
        now = now or datetime.now()
        seed = int(hashlib.md5(f"{self.key}-{now:%Y%m%d%H}".encode()).hexdigest()[:8], 16)
        rng = random.Random(seed)
        items = rng.sample(DEMO_CATALOG, k=min(len(DEMO_CATALOG), rng.randint(14, 20)))
        evening = now.hour >= 17
        deals = []
        for name, unit, price in items:
            closing = evening and rng.random() < 0.45 or rng.random() < 0.12
            rate = rng.uniform(0.3, 0.55) if closing else rng.uniform(0.08, 0.35)
            orig = int(price * rng.uniform(0.92, 1.12) / 10) * 10
            sale = int(orig * (1 - rate) / 10) * 10
            deals.append(
                RawDeal(
                    mart=self.label,
                    name=name,
                    original_price=orig,
                    sale_price=sale,
                    unit=unit,
                    store=rng.choice(self.demo_stores),
                    url=self.base_url,
                    is_closing_sale=closing,
                    source="demo",
                    valid_until=(now + timedelta(hours=3 if closing else 48)).replace(microsecond=0),
                )
            )
        return deals

    demo_stores: tuple[str, ...] = ("온라인몰",)


DEMO_CATALOG: list[tuple[str, str, int]] = [
    ("국내산 양파", "1.5kg", 4980),
    ("대파", "1단", 3480),
    ("친환경 시금치", "300g", 2980),
    ("브로콜리", "1입", 2580),
    ("애호박", "1입", 1980),
    ("다다기 오이", "3입", 3280),
    ("흙당근", "1kg", 3980),
    ("새송이버섯", "400g", 2980),
    ("파프리카 혼합", "2입", 3980),
    ("양배추", "1통", 3480),
    ("방울토마토", "750g", 7980),
    ("꿀고구마", "1.5kg", 7980),
    ("수미감자", "1kg", 4480),
    ("부사 사과", "1.5kg", 12900),
    ("블루베리", "200g", 6980),
    ("바나나", "1송이", 3980),
    ("아보카도", "2입", 4980),
    ("한돈 앞다리살", "600g", 10800),
    ("한돈 목살", "500g", 13900),
    ("1등급 한우 우둔", "300g", 18900),
    ("닭가슴살", "1kg", 9980),
    ("무항생제 닭다리살", "800g", 8980),
    ("노르웨이 고등어", "2손", 7980),
    ("생연어 필렛", "300g", 14900),
    ("손질 오징어", "2마리", 8980),
    ("칵테일 새우", "300g", 9980),
    ("동물복지 유정란", "15구", 7980),
    ("1등급 우유", "900ml", 2980),
    ("무가당 그릭요거트", "450g", 5980),
    ("국산콩 두부", "300g", 2480),
    ("유기농 콩나물", "300g", 1680),
    ("현미", "4kg", 16900),
    ("국산 귀리", "1kg", 8980),
    ("통밀 식빵", "1봉", 3980),
    ("닭가슴살 샐러드", "1팩", 5980),
    ("모둠 초밥", "12입", 12900),
    ("두부면", "100g", 1980),
    ("저당 두유", "190ml x 16", 9980),
]

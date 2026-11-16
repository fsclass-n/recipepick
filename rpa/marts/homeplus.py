from ..base import BaseMartCrawler, Selectors


class HomeplusCrawler(BaseMartCrawler):
    """홈플러스 몰 검색 결과에서 정상가 대비 할인 중인 상품을 수집한다.

    robots.txt(mfront.homeplus.co.kr)는 /favorite, /mypage 외 경로를 허용한다.
    셀렉터는 2026-11 기준 DOM 구조로 검증되었으며, 사이트 개편 시 조정이 필요하다.
    """

    key = "homeplus"
    label = "홈플러스"
    base_url = "https://mfront.homeplus.co.kr"
    search_url = "https://mfront.homeplus.co.kr/search?entry=direct&keyword={q}"
    selectors = Selectors(
        card="article.unitItem",
        name="a.linkArea, h3",
        sale_price="div.price strong:not(.discountRate)",
        original_price="span.orgPriceValue",
        link="a.linkArea, a",
        image="img",
    )
    wait_selector = "article.unitItem"
    demo_stores = ("홈플러스 온라인몰", "홈플러스 강서점", "홈플러스 합정점", "홈플러스 월드컵점")

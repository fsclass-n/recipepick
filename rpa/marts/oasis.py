from ..base import BaseMartCrawler, Selectors


class OasisCrawler(BaseMartCrawler):
    """오아시스마켓(oasis.co.kr) 검색 결과 파서.

    검색 결과가 서버 렌더링 HTML 로 제공되고 robots.txt 가 없어(404) 표준상 수집 제한이 없다.
    crawl_delay 로 요청 간격을 두고, 키워드 검색 결과 첫 페이지만 수집한다.
    """

    key = "oasis"
    label = "오아시스마켓"
    base_url = "https://www.oasis.co.kr"
    search_url = "https://www.oasis.co.kr/product/search?keyword={q}"
    selectors = Selectors(
        card="li.pListItem",
        name="a.listTit",
        sale_price="div.info_price span.price_discount",
        original_price="div.info_price span.price_original",
        link="a.listTit",
        image="div.wrapImg img",
    )
    wait_selector = "li.pListItem"
    closing_keywords = ("마감", "타임", "오늘만", "반짝", "지금할인")
    max_per_keyword = 12
    demo_stores = ("오아시스마켓 온라인몰", "오아시스마켓 성수점", "오아시스마켓 목동점")

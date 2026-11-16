from ..base import BaseMartCrawler, Selectors


class LotteMartCrawler(BaseMartCrawler):
    """롯데마트(롯데ON) 검색 결과 파서.

    롯데ON robots.txt 는 일반 크롤러(User-agent: *)에 대해 'Disallow: /' 를 명시하므로
    기본적으로 라이브 수집을 비활성화하고 데모 데이터를 사용한다.
    제휴/공식 API 승인 시 live_enabled=True 로 전환하면 아래 검증된 셀렉터로 수집한다.
    """

    key = "lottemart"
    label = "롯데마트"
    base_url = "https://www.lotteon.com"
    search_url = "https://www.lotteon.com/csearch/search/search?render=search&platform=pc&mallId=4&q={q}"
    selectors = Selectors(
        card="li.c-product-list__item",
        name="p.c-product-title__title",
        sale_price="span.c-product-price__final",
        original_price="span.c-product-price__real",
        link="a",
        image="div.c-product-thumbnail img",
    )
    wait_selector = "li.c-product-list__item"
    live_enabled = False
    disabled_reason = "robots.txt 에서 일반 크롤러 수집 비허용"
    demo_stores = ("롯데마트 온라인몰", "롯데마트 서울역점", "롯데마트 제타플렉스점", "롯데마트 잠실점")

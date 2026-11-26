from ..base import BaseMartCrawler, Selectors


class OimarketCrawler(BaseMartCrawler):
    """오이마켓(oimarket.net) 식품 카테고리.

    2026-11 점검 시 도메인이 DNS 에서 조회되지 않아(NXDOMAIN) 라이브 수집이 불가능하므로
    데모 데이터로 서비스 흐름만 제공한다. 사이트가 복구되면 robots.txt 확인 후 셀렉터를 검증해
    live_enabled=True 로 전환한다(영카트 기본 상품 목록 마크업 기준 셀렉터).
    """

    key = "oimarket"
    label = "오이마켓"
    base_url = "https://www.oimarket.net"
    search_url = "https://www.oimarket.net/shop/search.php?q={q}"
    selectors = Selectors(
        card="li.sct_li",
        name="div.sct_txt a",
        sale_price="div.sct_cost",
        original_price="div.sct_cost s",
        link="div.sct_txt a",
        image="div.sct_img img",
    )
    live_enabled = False
    disabled_reason = "사이트 도메인 조회 불가(NXDOMAIN)로 라이브 수집 중단"
    demo_stores = ("오이마켓 온라인몰",)

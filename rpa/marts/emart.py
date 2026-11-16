from ..base import BaseMartCrawler, Selectors


class EmartCrawler(BaseMartCrawler):
    """이마트몰(SSG.COM) 파서.

    SSG.COM 은 Akamai 봇 차단으로 자동화 브라우저 접근을 거부하므로 기본적으로 라이브 수집을
    비활성화하고 데모 데이터를 사용한다. 공식 제휴 API 확보 시 live_enabled=True 로 전환한다.
    """

    key = "emart"
    label = "이마트"
    base_url = "https://emart.ssg.com"
    search_url = "https://emart.ssg.com/search.ssg?query={q}"
    selectors = Selectors(
        card="li.cunit_t232",
        name="em.tx_kor",
        sale_price="em.ssg_price",
        original_price="em.ssg_price_none",
        link="a",
        image="img",
    )
    wait_selector = "li.cunit_t232"
    live_enabled = False
    disabled_reason = "SSG.COM 봇 차단 정책(Akamai)으로 자동 수집 불가"
    demo_stores = ("이마트 온라인몰", "이마트 성수점", "이마트 용산점", "이마트 월계점")

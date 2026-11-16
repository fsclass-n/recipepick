from rpa.base import guess_category, parse_price
from rpa.marts import HomeplusCrawler
from rpa.runner import run_all

HOMEPLUS_HTML = """
<div class="infinite-scroll-component">
  <article class="unitItem"><div class="unitItemInner">
    <a class="linkArea" href="/item?itemNo=1"><h3>풀무원 특등급 국산콩 두부 부침용 380G</h3></a>
    <div class="orgPrice"><button class="btnTooltip"><span class="orgPriceValue">5,490원</span></button></div>
    <div class="price"><strong class="discountRate">50%</strong><strong>2,740</strong><span>원</span></div>
    <img src="https://image.homeplus.kr/it/1" />
  </div></article>
  <article class="unitItem"><div class="unitItemInner">
    <a class="linkArea" href="/item?itemNo=2"><h3>할인 없는 상품</h3></a>
    <div class="price"><strong>3,000</strong><span>원</span></div>
  </div></article>
</div>
"""


def test_homeplus_parser():
    deals = HomeplusCrawler().parse(HOMEPLUS_HTML, "https://mfront.homeplus.co.kr/search?keyword=x")
    assert len(deals) == 1
    d = deals[0]
    assert (d.original_price, d.sale_price) == (5490, 2740)
    assert d.category == "두부·콩"
    assert d.url == "https://mfront.homeplus.co.kr/item?itemNo=1"


def test_helpers():
    assert parse_price("정상가18,800") == 18800
    assert guess_category("제주 무 1개") == "채소"
    assert guess_category("풀무원 두부") == "두부·콩"


def test_demo_mode_all_marts():
    result = run_all(mode="demo", log=lambda m: None)
    assert set(result["sources"].values()) == {"demo"}
    assert len(result["sources"]) == 3 and result["deals"]

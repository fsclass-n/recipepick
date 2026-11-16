"""모든 마트 크롤러를 순차 실행하고 수집 결과를 합산한다.

mode:
  live - Playwright(Chromium)로 실제 마트 사이트를 크롤링한다(live_enabled 마트만). 실패 시 예외 전달.
  demo - 마트 사이트 접속 없이 시뮬레이션 할인 데이터를 생성한다.
  auto - live_enabled 마트는 라이브 수집을 시도하고, 비활성 마트·브라우저 미설치·0건 수집 시 demo로 대체한다.
"""

from __future__ import annotations

import os
from typing import Callable

from .base import RawDeal
from .marts import CRAWLERS

LogFn = Callable[[str], None]

DEFAULT_KEYWORDS = ["두부", "양파", "닭가슴살", "브로콜리", "고등어", "계란"]


def _default_log(msg: str) -> None:
    print(msg, flush=True)


def _keywords(extra: list[str] | None) -> list[str]:
    env = [k.strip() for k in os.getenv("RPA_KEYWORDS", "").split(",") if k.strip()]
    merged = list(dict.fromkeys([*(extra or []), *env, *DEFAULT_KEYWORDS]))
    return merged[: int(os.getenv("RPA_MAX_KEYWORDS", "8"))]


def run_all(
    mode: str = "auto",
    log: LogFn = _default_log,
    timeout_seconds: int = 30,
    keywords: list[str] | None = None,
) -> dict:
    """return: {"deals": [RawDeal], "status": str, "mode": str, "sources": {mart: "live"|"demo"}}"""
    mode = (mode or "auto").lower()
    headless = os.getenv("PLAYWRIGHT_HEADLESS", "true").lower() != "false"
    timeout_ms = int(os.getenv("CRAWL_TIMEOUT_SECONDS", str(timeout_seconds)) or timeout_seconds) * 1000
    kws = _keywords(keywords)

    results: list[RawDeal] = []
    sources: dict[str, str] = {}

    def use_demo(crawler, reason: str) -> None:
        demo = crawler.demo_deals()
        sources[crawler.label] = "demo"
        results.extend(demo)
        log(f"[{crawler.label}] {reason} → 데모 {len(demo)}건")

    live_targets = [c for c in CRAWLERS if c.live_enabled] if mode in {"live", "auto"} else []
    for c in CRAWLERS:
        if c not in live_targets and mode != "live":
            use_demo(c, "데모 모드" if mode == "demo" else f"라이브 비활성({c.disabled_reason})")
        elif c not in live_targets:
            log(f"[{c.label}] 라이브 비활성({c.disabled_reason}) → 건너뜀")

    if live_targets:
        log(f"[rpa] 검색 키워드: {', '.join(kws)}")
        pw = browser = None
        try:
            from playwright.sync_api import sync_playwright

            pw = sync_playwright().start()
            browser = pw.chromium.launch(
                headless=headless,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--disable-extensions", "--no-zygote"],
            )
            for crawler in live_targets:
                try:
                    deals = crawler.crawl_live(browser, timeout_ms, log, kws)
                    if deals:
                        sources[crawler.label] = "live"
                        results.extend(deals)
                        log(f"[{crawler.label}] 라이브 수집 {len(deals)}건")
                    elif mode == "auto":
                        use_demo(crawler, "라이브 0건(셀렉터 확인 필요)")
                    else:
                        log(f"[{crawler.label}] 라이브 0건 (셀렉터 확인 필요)")
                except Exception as e:
                    if mode == "live":
                        raise
                    use_demo(crawler, f"라이브 실패({e.__class__.__name__}: {str(e)[:120]})")
        except Exception as e:
            if mode == "live":
                raise
            log(f"[rpa] 브라우저 구동 실패({e.__class__.__name__}: {str(e)[:120]})")
            for crawler in live_targets:
                if crawler.label not in sources:
                    use_demo(crawler, "브라우저 미구동")
        finally:
            if browser:
                browser.close()
            if pw:
                pw.stop()

    return {
        "deals": results,
        "status": "success" if results else "failed",
        "mode": mode,
        "sources": sources,
    }

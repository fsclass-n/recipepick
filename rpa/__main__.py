"""CLI: python -m rpa [--mode live|demo|auto] [--json]"""

import argparse
import json
from dataclasses import asdict
from datetime import datetime

from .runner import run_all


def main() -> None:
    ap = argparse.ArgumentParser(description="RecipePick 대형마트 할인 식재료 크롤러")
    ap.add_argument("--mode", choices=["live", "demo", "auto"], default="auto")
    ap.add_argument("--json", action="store_true", help="수집 결과를 JSON으로 출력")
    ap.add_argument("--timeout", type=int, default=30)
    args = ap.parse_args()

    result = run_all(mode=args.mode, timeout_seconds=args.timeout)
    deals = [d.to_dict() if hasattr(d, "to_dict") else asdict(d) for d in result["deals"]]

    if args.json:
        print(json.dumps(
            {**result, "deals": deals},
            default=lambda o: o.isoformat() if isinstance(o, datetime) else str(o),
            ensure_ascii=False,
            indent=2,
        ))
    else:
        print(f"수집 완료: {len(deals)}건 (모드={result['mode']}, 마트별 소스={result['sources']})")


if __name__ == "__main__":
    main()

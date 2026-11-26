"""운영 사이트(recipepick.onrender.com) 시연 자동 녹화.

- 앱 내부 이동만 사용(전체 새로고침 없음) → 흰 화면 번쩍임 방지
- 커서·클릭 링·강조 테두리·주소 표시줄·결과 카드는 페이지 위에 덧씌운 요소(화면 전체 딤 없음)
- 장면 시작 시각을 marks.json 에 기록 → compose.py 가 프레임 단위로 자른다
- 운영 데이터 변경은 테스트 계정 건강 타입 1건뿐이며, 녹화 직후 원래대로 복구한다

python record_demo.py            # 전체
python record_demo.py main       # 메인 흐름만 (D01~A04)
python record_demo.py split ext  # 두 계정 비교 / 외부 페이지
"""
import math
import sys
import time

import os
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright

from common import API, RAW, SITE, TTS, load_json, save_json
from scenes import timeline

SC = {s["id"]: s for s in timeline()}
MARKS = RAW / "marks.json"
USER = ("user@recipepick.dev", "Recipe!2026")
ADMIN = ("admin@recipepick.dev", "Admin!2026")
SYNC_GAP = 0.35

OVERLAY_JS = r"""
(() => {
  if (window.__rpOverlay) return; window.__rpOverlay = true;
  const css = `
    main{min-height:100vh}
    #__cur{position:fixed;left:-100px;top:-100px;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;
      background:rgba(250,204,21,.32);border:2px solid rgba(234,179,8,.95);box-shadow:0 0 10px rgba(234,179,8,.45);
      pointer-events:none;z-index:2147483647;transition:transform .12s ease}
    #__cur.down{transform:scale(.8)}
    .__ring{position:fixed;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:3px solid rgba(234,179,8,.9);
      pointer-events:none;z-index:2147483646;animation:__ring .55s ease-out forwards}
    @keyframes __ring{from{transform:scale(.6);opacity:1}to{transform:scale(2.1);opacity:0}}
    .__hl{position:absolute;border:3px solid #22d3ee;border-radius:14px;pointer-events:none;z-index:2147483640;
      box-shadow:0 0 0 4px rgba(34,211,238,.22),0 0 22px rgba(34,211,238,.55);opacity:0;transition:opacity .3s ease}
    #__addr{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483645;min-width:520px;
      background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:999px;padding:9px 20px;
      font:600 17px/1.2 Consolas,monospace;box-shadow:0 10px 30px rgba(15,23,42,.25);opacity:0;transition:opacity .3s}
    #__addr b{color:#16a34a}
    #__card{position:fixed;top:86px;right:28px;z-index:2147483645;width:440px;background:#0c1410;color:#e2e8f0;
      border-radius:16px;padding:16px 20px;font:15px/1.5 Consolas,monospace;box-shadow:0 18px 40px rgba(0,0,0,.35);
      border:2px solid #ef4444;opacity:0;transition:opacity .3s}
    #__card .k{color:#86efac}#__card .e{color:#fca5a5;font-weight:700;font-size:20px}
  `;
  const boot = () => {
    if (document.getElementById('__cur')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement('div'); c.id = '__cur'; document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', e => {
      c.classList.add('down');
      const r = document.createElement('div'); r.className = '__ring';
      r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 700);
    }, true);
    addEventListener('mouseup', () => c.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.__hl = (x, y, w, h, ms) => {
    const d = document.createElement('div'); d.className = '__hl';
    const pad = 6;
    Object.assign(d.style, {left: (x - pad + scrollX) + 'px', top: (y - pad + scrollY) + 'px',
      width: (w + pad * 2) + 'px', height: (h + pad * 2) + 'px'});
    document.body.appendChild(d); requestAnimationFrame(() => d.style.opacity = 1);
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 350); }, ms);
  };
  window.__sync = () => {
    const d = document.createElement('div');
    Object.assign(d.style, {position:'fixed', right:'0', bottom:'0', width:'30px', height:'30px',
      background:'#ff00ff', zIndex:2147483647, pointerEvents:'none'});
    document.body.appendChild(d); setTimeout(() => d.remove(), 260);
  };
  window.__addr = (host, path, show) => {
    let a = document.getElementById('__addr');
    if (!a) { a = document.createElement('div'); a.id = '__addr'; document.body.appendChild(a); }
    a.innerHTML = '🔒 ' + host + '<b>' + path + '</b>';
    a.style.opacity = show ? 1 : 0;
  };
  window.__card = (html, show) => {
    let a = document.getElementById('__card');
    if (!a) { a = document.createElement('div'); a.id = '__card'; document.body.appendChild(a); }
    if (html) a.innerHTML = html;
    a.style.opacity = show ? 1 : 0;
  };
})();
"""


class Rec:
    """한 페이지의 녹화 타임라인과 사람 같은 마우스 조작."""

    def __init__(self, page, name: str):
        self.page, self.name = page, name
        self.t0 = time.monotonic()
        self.mx, self.my = page.viewport_size["width"] * 0.6, page.viewport_size["height"] * 0.55
        self.scene_t = None

    # ---- 타임라인
    def now(self) -> float:
        return time.monotonic() - self.t0

    def mark(self, sid: str, marks: dict, key: str | None = None) -> None:
        """장면 시작: 오른쪽 아래에 0.26초 동기화 표식을 띄우고(compose 가 프레임에서 찾아 정확히 자름),
        표식이 사라진 뒤를 장면 0초로 삼는다."""
        self.page.evaluate("() => window.__sync()")
        time.sleep(SYNC_GAP)
        self.scene_t = time.monotonic()
        entry = marks.setdefault(sid, {})
        entry[key or "video"] = {"page": self.name, "start": round(self.now(), 3)}
        print(f"  ▶ {sid} @ {self.now():.2f}s ({self.name})", flush=True)

    def until(self, t: float) -> None:
        left = self.scene_t + t - time.monotonic()
        if left > 0:
            time.sleep(left)
        elif left < -0.4:
            print(f"    ⚠ {self.name}: {t:.1f}s 지점에 {-left:.1f}s 늦음", flush=True)

    def at(self, t: float) -> None:
        self.until(t)

    # ---- 동작
    def _box(self, target):
        loc = self.page.locator(target) if isinstance(target, str) else target
        loc = loc.first
        loc.wait_for(state="visible", timeout=30000)
        return loc.bounding_box()

    def move(self, x: float, y: float, dur: float = 0.7) -> None:
        """경과 시간 기준 이동: 녹화 부하로 이벤트가 느려져도 전체 시간은 dur 를 넘지 않는다."""
        sx, sy = self.mx, self.my
        start = time.monotonic()
        while True:
            k = min(1.0, (time.monotonic() - start) / dur)
            e = 0.5 - math.cos(math.pi * k) / 2
            self.page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e)
            if k >= 1.0:
                break
            time.sleep(1 / 60)
        self.mx, self.my = x, y

    def move_to(self, target, dur: float = 0.7, dx: float = 0.5, dy: float = 0.5) -> dict:
        b = self._box(target)
        self.move(b["x"] + b["width"] * dx, b["y"] + b["height"] * dy, dur)
        return b

    def rest_near(self, target) -> None:
        """설명하는 동안 커서를 대상의 오른쪽 아래 여백으로 비켜 둔다."""
        b = self._box(target)
        vw, vh = self.page.viewport_size["width"], self.page.viewport_size["height"]
        self.move(min(b["x"] + b["width"] + 30, vw - 40), min(b["y"] + b["height"] + 24, vh - 40), 0.6)

    def click(self, target, pause: float = 0.45, dx: float = 0.5, dy: float = 0.5) -> None:
        self.ensure_visible(target)
        self.move_to(target, dx=dx, dy=dy)
        time.sleep(pause)
        self.page.mouse.down()
        time.sleep(0.08)
        self.page.mouse.up()

    def hl(self, target, ms: int = 2500, rest: bool = True) -> None:
        self.ensure_visible(target)
        b = self._box(target)
        self.page.evaluate("([x,y,w,h,ms]) => window.__hl(x,y,w,h,ms)", [b["x"], b["y"], b["width"], b["height"], ms])
        if rest:
            self.rest_near(target)

    def ensure_visible(self, target) -> None:
        b = self._box(target)
        vh = self.page.viewport_size["height"]
        if b["y"] < 70 or b["y"] + min(b["height"], vh * 0.6) > vh - 40:
            self.scroll_by(b["y"] - vh * 0.28)

    def scroll_by(self, dy: float, wait: float = 1.0) -> None:
        self.page.evaluate("dy => window.scrollBy({top: dy, behavior: 'smooth'})", dy)
        time.sleep(wait)

    def scroll_top(self) -> None:
        self.page.evaluate("() => window.scrollTo({top: 0, behavior: 'smooth'})")
        time.sleep(0.9)

    def nav(self, label: str) -> None:
        """헤더 메뉴(React Router NavLink) 클릭 = 앱 내부 이동."""
        self.click(self.page.locator("header nav a", has_text=label))
        time.sleep(0.4)


def new_ctx(browser, w=1920, h=1080):
    ctx = browser.new_context(viewport={"width": w, "height": h}, locale="ko-KR",
                              record_video_dir=str(RAW), record_video_size={"width": w, "height": h},
                              color_scheme="light")
    ctx.add_init_script(OVERLAY_JS)
    ctx.add_init_script("try{localStorage.setItem('rp-theme','light')}catch(e){}")
    return ctx


def warm_up() -> None:
    for url in (f"{API}/api/health", f"{API}/api/public/stats", SITE):
        for _ in range(6):
            try:
                if requests.get(url, timeout=90).status_code == 200:
                    break
            except requests.RequestException:
                time.sleep(5)
    print("운영 서버 준비 완료", flush=True)


def api_token(email: str, pw: str) -> str:
    r = requests.post(f"{API}/api/auth/login", json={"email": email, "password": pw}, timeout=60)
    r.raise_for_status()
    return r.json()["access_token"]


def admin_key() -> str:
    """실제 관리자 권한은 ADMIN_ACCESS_KEY 로그인으로만 발급된다(환경 변수 또는 루트 .env)."""
    key = os.getenv("ADMIN_ACCESS_KEY", "")
    if not key:
        env = Path(__file__).resolve().parents[3] / ".env"
        for line in env.read_text(encoding="utf-8").splitlines() if env.exists() else []:
            if line.startswith("ADMIN_ACCESS_KEY="):
                key = line.split("=", 1)[1].strip()
    if not key:
        raise SystemExit("ADMIN_ACCESS_KEY 가 필요합니다 (.env 또는 환경 변수)")
    return key


def admin_api_token() -> str:
    r = requests.post(f"{API}/api/auth/admin-login", json={"access_key": admin_key()}, timeout=60)
    r.raise_for_status()
    return r.json()["access_token"]


def ensure_test_user(health: str = "diabetes") -> None:
    """테스트 일반 회원을 시연 기준 상태(일반·활성·당뇨)로 맞춘다."""
    h = {"Authorization": f"Bearer {admin_api_token()}"}
    users = requests.get(f"{API}/api/admin/users", headers=h, timeout=60).json()
    u = next(x for x in users if x["email"] == USER[0])
    if (u["role"], u["is_active"], u["health_type"]) != ("user", True, health):
        requests.patch(f"{API}/api/admin/users/{u['id']}", headers=h, timeout=60,
                       json={"role": "user", "is_active": True, "health_type": health}).raise_for_status()
        print(f"테스트 회원 상태 복구: user · active · {health}", flush=True)


def login_via_button(r: Rec, label: str) -> None:
    r.click(r.page.locator("button", has_text=label))


# ====================================================================== 메인 흐름
def record_main(browser, marks: dict) -> None:
    ctx = new_ctx(browser)
    page = ctx.new_page()
    r = Rec(page, "main")
    page.goto(SITE + "/", wait_until="networkidle")
    page.wait_for_selector("dl .card", timeout=60000)
    page.wait_for_timeout(2500)

    # D01 메인 히어로 + 통계
    r.mark("D01", marks)
    r.move(900, 520, 0.8)
    r.at(1.2); r.hl("main h1", 3200)
    r.at(5.5); r.hl("main dl", 5500)
    r.at(12); r.move(1300, 600, 0.8)
    r.until(SC["D01"]["dur"])

    # D02 오늘의 할인
    r.mark("D02", marks)
    r.click(page.locator("header nav a", has_text="오늘의 할인"))
    page.wait_for_timeout(1600)
    demo = page.locator("#deals article", has_text="DEMO")
    r.at(3.5); r.hl(page.locator("#deals article").first, 3000)
    r.at(7); r.hl(demo.first.locator("span", has_text="DEMO"), 3500) if demo.count() else None
    r.at(10.0); r.move(1500, 300, 0.8)
    r.at(12.6); r.click(page.locator("header a", has_text="로그인").first)
    page.wait_for_selector("text=다시 만나서 반가워요", timeout=30000)
    r.until(SC["D02"]["dur"])

    # U01 로그인 → 일반 회원
    r.mark("U01", marks)
    r.at(1.5); r.hl(page.locator("button", has_text="일반 회원").locator(".."), 4000)
    r.at(7.5); login_via_button(r, "일반 회원")
    page.wait_for_url("**/dashboard", timeout=30000)
    r.until(SC["U01"]["dur"])

    # U02 대시보드
    r.mark("U02", marks)
    page.wait_for_selector("text=실시간 알림 현황판", timeout=30000)
    r.at(1.0); r.hl(page.locator("header span.chip", has_text="당뇨"), 3500)
    r.at(5.0); r.hl("header nav", 3500)
    r.at(11.0); r.hl(page.locator("span.chip", has_text="LIVE"), 3000)
    r.at(15.0); r.hl(page.locator("section", has_text="실시간 알림 현황판").first, 7000)
    r.until(SC["U02"]["dur"])

    # U03 냉장고 파먹기 + 장바구니 맵
    r.mark("U03", marks)
    r.nav("냉장고 파먹기")
    page.wait_for_selector(".card:has(.fa-bolt)", timeout=30000)
    page.wait_for_timeout(600)
    r.at(3.0); r.hl(page.locator(".card:has(.fa-bolt)").first, 4000)
    r.at(8.0); r.hl(page.locator(".card:has(.fa-bolt)").nth(1), 3500)
    r.at(14.0); r.click(page.locator("button:has(i.fa-cart-shopping)").first)
    page.wait_for_selector("text=장바구니 맵", timeout=15000)
    r.at(17.5); r.hl(page.locator("section", has_text="장바구니 맵").first, 9000)
    r.until(SC["U03"]["dur"])

    # U04 마트 할인
    r.mark("U04", marks)
    r.nav("마트 할인")
    page.wait_for_selector("article", timeout=30000)
    r.at(3.0); r.click(page.locator("button", has_text="마감세일만"))
    page.wait_for_timeout(1200)
    r.at(6.5); r.click(page.locator("button", has_text="마감세일만"))
    r.at(9.5); r.click(page.locator("button", has_text="홈플러스").first)
    page.wait_for_timeout(1500)
    r.at(12.0); r.hl(page.locator("article").first, 4500)
    r.at(17.5); r.hl(page.locator("button", has_text="홈플러스").first.locator(".."), 5000, rest=False)
    r.until(SC["U04"]["dur"])

    # U05 AI 레시피 요청
    r.mark("U05", marks)
    r.nav("AI 레시피")
    page.wait_for_selector("text=AI 레시피 창작하기", timeout=30000)
    r.at(3.5); r.hl(page.locator("label", has_text="건강 관리 목표").locator(".."), 4000)
    deal_chip = page.locator("div:has(> label:has-text('마트 할인 재료')) button.chip").first
    r.at(9.0); r.click(deal_chip)
    r.at(12.5); r.click(page.locator("button", has_text="AI 레시피 창작하기"))
    r.until(SC["U05"]["dur"])

    # U06 결과 (생성 완료까지의 대기 구간은 편집에서 잘린다)
    page.wait_for_selector("#recipe-result article", timeout=120000)
    if "기본 템플릿" in page.locator("#recipe-result article header").inner_text():
        print("  ! fallback 결과 → 다시 생성", flush=True)
        r.scroll_top()
        page.locator("button", has_text="AI 레시피 창작하기").click()
        page.wait_for_selector("#recipe-result article header:has-text('Gemini')", timeout=120000)
    page.locator("#recipe-result").scroll_into_view_if_needed()
    page.wait_for_timeout(1200)
    r.mark("U06", marks)
    art = page.locator("#recipe-result article")
    r.at(1.0); r.hl(art.locator("header span.chip").nth(1), 3500)
    r.at(5.0); r.hl(art.locator("header h2"), 2500)
    r.at(8.5); r.hl(art.locator("li:has(.fa-tag)").first, 3500)
    r.at(14.0); r.hl(art.locator("section", has_text="1인분 영양 성분"), 8000)
    r.until(SC["U06"]["dur"])

    # U07 조리 단계 체크 · 대체 식재료 · 팁
    r.mark("U07", marks)
    steps = art.locator("ol li button")
    r.at(0.8); r.click(steps.nth(0))
    r.at(2.6); r.click(steps.nth(1))
    r.at(4.8); r.hl(art.locator("section", has_text="조리 순서").first.locator(":scope > div").nth(1), 2500)
    r.at(9.5); r.hl(art.locator("section", has_text="대체 식재료"), 3500) if art.locator("section", has_text="대체 식재료").count() else None
    r.at(14.0); r.hl(art.locator("section", has_text="꿀팁"), 4500)
    r.until(SC["U07"]["dur"])

    # U08 일반 회원의 관리자 화면 접근 → 차단
    r.mark("U08", marks)
    r.scroll_top()
    host = "recipepick.onrender.com"
    r.at(1.0)
    page.evaluate("([h]) => window.__addr(h, '', true)", [host])
    for i in range(1, len("/admin") + 1):
        page.evaluate("([h,p]) => window.__addr(h, p, true)", [host, "/admin"[:i]])
        time.sleep(0.16)
    r.at(4.5)
    page.evaluate("() => { history.pushState({}, '', '/admin'); dispatchEvent(new PopStateEvent('popstate')); }")
    page.wait_for_url("**/dashboard", timeout=10000)
    page.evaluate("([h]) => window.__addr(h, '/dashboard', true)", [host])
    r.at(6.5); r.hl("header nav", 3500)
    r.at(11.5)
    res = page.evaluate("""async (api) => {
        const t = localStorage.getItem('rp-token');
        const r = await fetch(api + '/api/admin/users', {headers: {Authorization: 'Bearer ' + t}});
        const j = await r.json().catch(() => ({}));
        return [r.status, j.detail || ''];
    }""", API)
    page.evaluate("([s, d]) => window.__card(`<div class='k'>GET /api/admin/users</div>"
                  "<div class='e'>${s} Forbidden</div><div>${d}</div>`, true)", res)
    print(f"  관리자 API 응답(일반 회원): {res}", flush=True)
    r.at(18.8)
    page.evaluate("() => { window.__card(null, false); window.__addr('', '', false); }")
    r.until(SC["U08"]["dur"])

    # A01 로그아웃 → 관리자 로그인
    r.mark("A01", marks)
    r.click(page.locator("header button[aria-label='로그아웃']"))
    page.wait_for_selector("text=다시 만나서 반가워요", timeout=30000)
    r.at(4.0); r.click(page.get_by_role("tab", name="실제 관리자"))
    page.fill("#admin-key", admin_key())
    login_via_button(r, "실제 관리자로 로그인")
    page.wait_for_url("**/admin", timeout=30000)
    r.at(8.0); r.hl(page.locator("header nav a", has_text="관리자"), 4000)
    r.until(SC["A01"]["dur"])

    # A02 지표 카드 · 크롤러 패널
    r.mark("A02", marks)
    page.wait_for_selector("text=Playwright RPA 크롤러", timeout=30000)
    cards = page.locator("div.grid:has(> div.card:has-text('전체 회원'))")
    r.at(1.0); r.hl(cards, 5000)
    r.at(7.0); r.hl(page.locator("div.card", has_text="데이터베이스").first, 4500)
    r.at(16.0); r.hl(page.locator("section", has_text="Playwright RPA 크롤러").first, 7000)
    r.until(SC["A02"]["dur"])

    # A03 Plotly 차트
    r.mark("A03", marks)
    page.wait_for_selector(".js-plotly-plot .main-svg", timeout=60000)
    first = page.locator(".js-plotly-plot").first
    r.at(0.5); r.ensure_visible(first)
    r.at(2.0); r.hl(first, 4000, rest=False)
    b = first.bounding_box()
    r.at(6.5)
    for fx in (0.35, 0.5, 0.62):
        r.move(b["x"] + b["width"] * fx, b["y"] + b["height"] * 0.5, 0.7)
        time.sleep(1.1)
    r.at(11.5); r.hl(page.locator(".js-plotly-plot").nth(1), 3500, rest=False)
    r.at(16.0); r.scroll_by(420)
    r.at(17.5); r.hl(page.locator(".js-plotly-plot").nth(2), 5500, rest=False)
    r.until(SC["A03"]["dur"])

    # A04 작업 로그
    r.mark("A04", marks)
    job = page.locator("section", has_text="작업 로그").locator("li button").first
    r.at(0.5); r.ensure_visible(page.locator("section", has_text="작업 로그").first)
    r.at(2.5); r.click(job)
    page.wait_for_timeout(700)
    r.at(4.5); r.hl(page.locator("section", has_text="작업 로그").locator("pre").first, 9000)
    r.until(SC["A04"]["dur"])

    ctx.close()
    marks["_videos"] = marks.get("_videos", {}) | {"main": str(page.video.path())}


# ====================================================================== 두 계정 비교
def record_split(browser, marks: dict) -> None:
    ensure_test_user("diabetes")
    lc, rc = new_ctx(browser, 1280, 1440), new_ctx(browser, 1280, 1440)
    lp, rp = lc.new_page(), rc.new_page()
    L, R = Rec(lp, "left"), Rec(rp, "right")
    lp.goto(SITE + "/login", wait_until="networkidle")
    lp.locator("button", has_text="테스트 회원으로 체험하기").click()
    lp.wait_for_url("**/dashboard", timeout=30000)
    # 로그인 유형 분리: 실제 관리자는 '실제 관리자' 탭에서 관리자 키로 로그인
    rp.goto(SITE + "/login?type=admin", wait_until="networkidle")
    rp.fill("#admin-key", admin_key())
    rp.locator("button", has_text="실제 관리자로 로그인").click()
    rp.wait_for_url("**/admin", timeout=30000)
    rp.locator("button", has_text="회원 관리").click()
    rp.wait_for_selector("table tbody tr", timeout=30000)
    lp.wait_for_selector("text=실시간 알림 현황판", timeout=30000)
    time.sleep(2.5)
    row = rp.locator("table tbody tr", has_text=USER[0])
    me = rp.locator("table tbody tr", has_text=ADMIN[0])
    sel = row.locator("select")
    T = load_json(TTS / "timings.json")["A05"]["lines"]
    st = lambda i: T[i - 1]["start"]  # noqa: E731
    en = lambda i: T[i - 1]["end"]  # noqa: E731
    try:
        lp.evaluate("() => window.__sync()"); rp.evaluate("() => window.__sync()")
        time.sleep(SYNC_GAP)
        t0 = time.monotonic()
        for rec, key in ((L, "left"), (R, "right")):
            rec.scene_t = t0
            marks.setdefault("A05", {})[key] = {"page": rec.name, "start": round(rec.now(), 3)}
        print(f"  ▶ A05 @ {L.now():.2f}s (left) / {R.now():.2f}s (right)", flush=True)
        L.at(st(1) + 2.6); L.hl(lp.locator("header span.chip", has_text="당뇨"), 3200)
        R.at(st(1) + 5.6); R.hl(row, 3000)
        R.at(st(2) + 1.0); R.move_to(sel)
        R.at(st(2) + 2.6); R.click(sel)
        R.at(st(2) + 4.2); sel.select_option("diet")
        lp.wait_for_selector("text=회원 정보 변경", timeout=15000)
        L.at(st(2) + 5.2); L.hl(lp.locator("div.animate-pop", has_text="회원 정보 변경").first, 4000)
        L.at(en(2) - 0.8); L.hl(lp.locator("header span.chip", has_text="다이어트"), 4200)
        R.at(st(4) + 0.4); R.hl(me.locator("td").nth(4), 3000, rest=False)
        R.at(st(4) + 3.6); R.hl(me.locator("td").nth(5), 3000, rest=False)
        R.at(st(4) + 4.2); R.move_to(me.locator("td").nth(4).locator("button"))
        R.at(st(5) + 1.0); R.move_to(sel)
        R.at(st(5) + 2.2); R.click(sel)
        R.at(st(5) + 3.0); sel.select_option("diabetes")
        L.at(st(5) + 4.0); L.hl(lp.locator("header span.chip", has_text="당뇨"), 3500)
        L.at(st(6) + 0.6); L.hl("header nav", 4500, rest=False); R.hl("header nav", 4500, rest=False)
        L.until(SC["A05"]["dur"] + 0.5)
    finally:
        try:
            sel.select_option("diabetes")
            time.sleep(1.5)
        finally:
            ensure_test_user("diabetes")
    lc.close(); rc.close()
    marks["_videos"] = marks.get("_videos", {}) | {"left": str(lp.video.path()), "right": str(rp.video.path())}


# ====================================================================== 외부 페이지
def record_ext(browser, marks: dict) -> None:
    ctx = new_ctx(browser)
    page = ctx.new_page()
    r = Rec(page, "docs")
    page.goto(API + "/docs", wait_until="networkidle")
    page.wait_for_selector(".opblock", timeout=60000)
    page.wait_for_timeout(1500)
    r.mark("A06", marks)
    r.at(0.8); r.hl(".opblock-tag-section >> nth=0", 2500, rest=False)
    r.at(3.5); r.scroll_by(520, 1.2)
    r.at(5.5); r.hl(page.locator(".opblock-tag-section", has_text="recipes").first, 3000, rest=False)
    r.until(SC["A06"]["dur"])
    ctx.close()
    marks["_videos"] = marks.get("_videos", {}) | {"docs": str(page.video.path())}

    ctx = new_ctx(browser)
    page = ctx.new_page()
    r = Rec(page, "gh")
    page.goto("https://github.com/fsclass-n/recipepick/actions", wait_until="networkidle")
    page.wait_for_timeout(2000)
    r.mark("A07", marks)
    runs = page.locator("[id^='check_suite_'], .Box-row").first
    r.at(1.0); r.hl(runs, 3500) if runs.count() else r.move(900, 500)
    r.at(5.5); r.scroll_by(240, 1.0)
    r.until(SC["A07"]["dur"])
    ctx.close()
    marks["_videos"] = marks.get("_videos", {}) | {"gh": str(page.video.path())}


def main(parts: list[str]) -> None:
    marks = load_json(MARKS, {}) or {}
    warm_up()
    ensure_test_user("diabetes")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge") if "--edge" in sys.argv else p.chromium.launch()
        if "main" in parts:
            print("[main] D01~A04", flush=True); record_main(browser, marks); save_json(MARKS, marks)
        if "split" in parts:
            print("[split] A05", flush=True); record_split(browser, marks); save_json(MARKS, marks)
        if "ext" in parts:
            print("[ext] A06~A07", flush=True); record_ext(browser, marks); save_json(MARKS, marks)
        browser.close()
    print("녹화 완료 →", MARKS)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    main(args or ["main", "split", "ext"])

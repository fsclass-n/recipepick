import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import Footer from "../components/Footer";
import PublicHeader from "../components/PublicHeader";
import { useAuth } from "../context/AuthContext";
import { api, CATEGORY_ICONS, HEALTH_LABELS, won } from "../lib/api";

const FEATURES = [
  { icon: "fa-robot", title: "RPA 마트 할인 자동 수집", desc: "Playwright 헤드리스 브라우저가 대형마트 할인·마감세일 정보를 주기적으로 수집해 한곳에 모아드려요.", tone: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  { icon: "fa-snowflake", title: "냉장고 파먹기 관리", desc: "냉장고 재고와 유통기한을 관리하고, 할인 중인 재료는 자동으로 하이라이트해 알려드려요.", tone: "bg-leaf-100 text-leaf-700 dark:bg-leaf-900/50 dark:text-leaf-300" },
  { icon: "fa-wand-magic-sparkles", title: "Gemini AI 맞춤 레시피", desc: "할인 재료 + 냉장고 재료 + 건강 상태를 조합해 조리법·영양 성분·대체 식재료까지 창작해요.", tone: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  { icon: "fa-bell", title: "마감세일 실시간 알림", desc: "장바구니에 담아둔 재료가 할인되면 WebSocket 푸시와 메신저 알림으로 바로 알려드려요.", tone: "bg-tomato-100 text-tomato-600 dark:bg-tomato-500/20 dark:text-tomato-400" },
];

const HEALTH_DESC = {
  general: "균형 잡힌 영양, 가공식품 최소화",
  diabetes: "저GI 식재료, 탄수화물 1회 45~60g",
  diet: "1인분 500kcal 이하, 고단백·고식이섬유",
  hypertension: "1인분 나트륨 600mg 이하 (DASH)",
  cholesterol: "포화지방↓, 오메가-3·식이섬유↑",
};

const STEPS = [
  { icon: "fa-user-plus", title: "가입하고 건강 목표 선택", desc: "당뇨·다이어트·고혈압 등 나에게 맞는 건강 목표를 고르세요." },
  { icon: "fa-basket-shopping", title: "냉장고·장바구니 등록", desc: "가진 재료와 사고 싶은 재료를 등록하면 할인과 자동 매칭돼요." },
  { icon: "fa-utensils", title: "AI 레시피로 요리 시작", desc: "버튼 한 번으로 할인 재료를 활용한 건강 레시피를 받아보세요." },
];

const MARTS = [
  { name: "홈플러스", badge: "실시간 수집", cls: "bg-rose-500 text-white", note: "공개 검색 페이지 기준 자동 수집" },
  { name: "이마트", badge: "데모 데이터", cls: "bg-yellow-400 text-slate-900", note: "공식 제휴·API 연동 준비 중" },
  { name: "롯데마트", badge: "데모 데이터", cls: "bg-red-600 text-white", note: "공식 제휴·API 연동 준비 중" },
];

const FAQ = [
  { q: "RecipePick은 무료인가요?", a: "네. 회원가입 후 냉장고 관리, 마트 할인 조회, AI 레시피 창작 등 모든 기능을 무료로 이용할 수 있어요." },
  { q: "마트 할인 정보는 얼마나 자주 갱신되나요?", a: "RPA 크롤러가 기본 1시간 주기로 수집합니다. 각 마트의 공개 페이지 기준이므로 실제 매장 가격과 다를 수 있어요." },
  { q: "AI 레시피는 의학적 처방을 대체하나요?", a: "아니요. 건강 상태에 맞춘 일반적인 식단 가이드를 제공하며, 질환 관리는 반드시 의료진과 상담해 주세요." },
  { q: "알레르기 식재료를 제외할 수 있나요?", a: "건강 프로필에 알레르기 식품을 등록하면 AI가 레시피 창작 시 해당 재료를 사용하지 않도록 반영해요." },
  { q: "DEMO 표시는 무엇인가요?", a: "공식 제휴 전인 마트는 시뮬레이션 데이터로 서비스 흐름을 보여드리며, 화면에 DEMO 배지로 구분해 표시합니다." },
];

function useCountUp(target, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function SectionTitle({ eyebrow, title, desc }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-bold tracking-wide text-leaf-600 dark:text-leaf-400">{eyebrow}</p>
      <h2 className="mt-2 text-3xl text-leaf-950 sm:text-4xl dark:text-leaf-50">{title}</h2>
      {desc && <p className="mt-3 text-slate-500 dark:text-slate-400">{desc}</p>}
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute -top-10 -right-6 size-64 rounded-full bg-tomato-400/25 blur-3xl" />
      <div className="absolute -bottom-10 -left-6 size-64 rounded-full bg-leaf-400/30 blur-3xl" />
      <div className="card relative animate-fade-up overflow-hidden p-0 shadow-xl shadow-leaf-900/10">
        <div className="bg-gradient-to-br from-leaf-600 to-leaf-800 p-5 text-white">
          <div className="flex gap-1.5">
            <span className="chip bg-white/20"><i className="fa-solid fa-droplet" />당뇨 관리</span>
            <span className="chip bg-sky-400/30"><i className="fa-solid fa-wand-magic-sparkles" />Gemini AI</span>
          </div>
          <p className="font-display mt-3 text-2xl">두부 브로콜리 현미 볶음밥</p>
          <p className="mt-1 text-sm text-leaf-100">마감세일 두부 + 냉장고 브로콜리로 만드는 저GI 한끼</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <span className="rounded-lg bg-white/10 px-2 py-1.5"><i className="fa-regular fa-clock mr-1" />20분</span>
            <span className="rounded-lg bg-white/10 px-2 py-1.5"><i className="fa-solid fa-fire mr-1" />420kcal</span>
            <span className="rounded-lg bg-white/10 px-2 py-1.5"><i className="fa-solid fa-coins mr-1" />4,980원</span>
          </div>
        </div>
        <div className="space-y-2 p-5">
          {[
            ["국산콩 두부", "홈플러스 -50%", true],
            ["브로콜리", "냉장고 보유", false],
            ["현미밥", "냉장고 보유", false],
          ].map(([n, s, deal]) => (
            <div key={n} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${deal ? "bg-tomato-50 dark:bg-tomato-500/10" : "bg-slate-50 dark:bg-ink/60"}`}>
              <span>{deal && <i className="fa-solid fa-tag mr-1.5 text-tomato-500" />}{n}</span>
              <span className="text-xs text-slate-500">{s}</span>
            </div>
          ))}
          <div className="pt-1">
            <div className="flex justify-between text-xs"><span className="font-semibold">탄수화물</span><span className="text-slate-500">48g / 권장 60g</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-ink-line"><div className="h-full w-4/5 rounded-full bg-leaf-500" /></div>
          </div>
        </div>
      </div>
      <div className="card absolute -bottom-14 -left-4 hidden animate-float items-center gap-3 p-3 shadow-lg sm:flex">
        <span className="grid size-10 place-items-center rounded-xl bg-tomato-500 text-white"><i className="fa-solid fa-bell" /></span>
        <div className="text-xs">
          <p className="font-bold">마감세일 매칭!</p>
          <p className="text-slate-500">고등어 2손 7,980원 → 4,710원</p>
        </div>
      </div>
      <div className="card absolute -top-5 -right-3 hidden animate-float items-center gap-2 px-3 py-2 shadow-lg sm:flex" style={{ animationDelay: "1.5s" }}>
        <i className="fa-solid fa-piggy-bank text-leaf-600" />
        <span className="text-xs font-bold">이번 주 12,400원 절약</span>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [faq, setFaq] = useState(0);
  const saving = useCountUp(stats?.total_saving || 0);
  const deals = useCountUp(stats?.deals || 0);

  useEffect(() => {
    api("/api/public/stats").then(setStats).catch(() => setStats(false));
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const t = setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth" }), 50);
    return () => clearTimeout(t);
  }, [location.hash]);

  const startTo = user ? "/dashboard" : "/login?mode=register";

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,var(--color-leaf-100),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.15),transparent_55%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div className="animate-fade-up text-center lg:text-left">
              <p className="chip bg-leaf-100 text-leaf-800 dark:bg-leaf-900/50 dark:text-leaf-200">
                <span className="size-1.5 animate-pulse rounded-full bg-tomato-500" />RPA × Gemini AI 푸드테크 짠테크
              </p>
              <h1 className="mt-5 text-4xl leading-tight text-leaf-950 sm:text-5xl lg:text-6xl dark:text-leaf-50">
                냉장고 속 재료와<br />오늘의 <span className="text-tomato-500">마감세일</span>로<br />건강한 한끼를.
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600 lg:mx-0 dark:text-slate-300">
                대형마트 할인가 식재료를 자동으로 찾고, 당뇨·다이어트·고혈압 등 내 건강 상태에 맞춘 레시피를 AI가 창작해 드려요.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link to={startTo} className="btn-primary px-6 py-3.5 text-base"><i className="fa-solid fa-leaf" />{user ? "대시보드로 이동" : "무료로 시작하기"}</Link>
                {!user && <Link to="/login" className="btn-ghost px-6 py-3.5 text-base"><i className="fa-solid fa-play" />테스트 계정으로 체험</Link>}
              </div>
              <dl className="mt-10 grid grid-cols-3 gap-3">
                {[
                  ["오늘 수집된 할인", stats ? `${deals.toLocaleString()}개` : "—"],
                  ["평균 할인율", stats ? `${stats.avg_discount}%` : "—"],
                  ["할인 합산 절약액", stats ? won(saving) : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="card p-3 sm:p-4">
                    <dt className="text-[11px] text-slate-500 sm:text-xs">{k}</dt>
                    <dd className="font-display mt-1 truncate text-lg text-leaf-800 sm:text-2xl dark:text-leaf-200">{v}</dd>
                  </div>
                ))}
              </dl>
              {stats === false && <p className="mt-2 text-xs text-slate-400">실시간 통계 서버가 깨어나는 중이에요. 잠시 후 새로고침해 주세요.</p>}
            </div>
            <HeroVisual />
          </div>
        </section>

        <section id="features" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionTitle eyebrow="FEATURES" title="장보기부터 요리까지, 한 번에" desc="흩어진 마트 할인 정보와 냉장고 재고, 건강 관리를 하나의 흐름으로 연결했어요." />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <article key={f.title} className="card animate-fade-up p-6 transition hover:-translate-y-1 hover:shadow-md" style={{ animationDelay: `${i * 80}ms` }}>
                  <span className={`grid size-12 place-items-center rounded-2xl text-lg ${f.tone}`}><i className={`fa-solid ${f.icon}`} /></span>
                  <h3 className="mt-4 text-xl">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="health" className="scroll-mt-20 bg-white/60 py-20 dark:bg-ink-soft/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionTitle eyebrow="HEALTH" title="내 몸에 맞춘 건강 레시피" desc="건강 목표에 따라 영양 기준을 다르게 적용해 레시피를 창작합니다." />
            <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-5">
              {Object.entries(HEALTH_LABELS).map(([k, h]) => (
                <div key={k} className="card p-5 text-center">
                  <span className={`mx-auto grid size-12 place-items-center rounded-full text-lg ${h.color}`}><i className={`fa-solid ${h.icon}`} /></span>
                  <p className="font-display mt-3 text-lg">{h.label}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{HEALTH_DESC[k]}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-slate-400">* 일반적인 식단 가이드이며 의학적 진단·처방을 대체하지 않습니다.</p>
          </div>
        </section>

        <section id="how" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <SectionTitle eyebrow="HOW IT WORKS" title="3단계로 시작하는 냉장고 파먹기" />
            <ol className="relative mt-12 grid gap-6 md:grid-cols-3">
              <span className="absolute top-8 right-[16%] left-[16%] hidden h-0.5 bg-gradient-to-r from-leaf-200 via-leaf-400 to-leaf-200 md:block dark:from-ink-line dark:via-leaf-700 dark:to-ink-line" />
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative text-center">
                  <span className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-leaf-600 text-2xl text-white shadow-lg shadow-leaf-600/30">
                    <i className={`fa-solid ${s.icon}`} />
                    <span className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-tomato-500 text-xs font-bold">{i + 1}</span>
                  </span>
                  <h3 className="mt-5 text-xl">{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="deals" className="scroll-mt-20 bg-white/60 py-20 dark:bg-ink-soft/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionTitle eyebrow="TODAY'S DEALS" title="지금 가장 많이 할인 중인 식재료" desc="RPA가 수집한 할인율 상위 상품이에요. 로그인하면 내 냉장고와 자동으로 매칭해 드려요." />
            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats === null && Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-48" />)}
              {stats === false && (
                <div className="card col-span-full p-10 text-center text-sm text-slate-500">
                  <i className="fa-solid fa-mug-hot mb-2 block text-3xl text-leaf-400" />할인 정보 서버가 깨어나는 중이에요. 잠시 후 다시 확인해 주세요.
                </div>
              )}
              {stats?.top_deals?.map((d) => (
                <article key={d.name + d.mart} className="card flex flex-col overflow-hidden p-0">
                  <div className="relative grid h-28 place-items-center bg-gradient-to-br from-leaf-50 to-leaf-100 dark:from-ink-line dark:to-ink">
                    {d.image_url ? <img src={d.image_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <i className={`fa-solid ${CATEGORY_ICONS[d.category] || CATEGORY_ICONS.기타} text-4xl text-leaf-500/70`} />}
                    <span className="absolute top-2 left-2 chip bg-black/55 text-white">{d.mart}</span>
                    {d.is_closing_sale && <span className="absolute top-2 right-2 chip bg-tomato-500 text-white"><i className="fa-solid fa-clock" />마감</span>}
                    {d.source === "demo" && <span className="absolute right-2 bottom-2 chip bg-black/40 text-[10px] text-white">DEMO</span>}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="line-clamp-2 text-sm font-semibold">{d.name}</p>
                    <p className="mt-auto pt-2 text-xs text-slate-400"><s>{won(d.original_price)}</s></p>
                    <p className="flex items-baseline gap-1.5">
                      <span className="font-display text-lg text-tomato-600 dark:text-tomato-400">{Math.round(d.discount_rate)}%</span>
                      <span className="font-bold">{won(d.sale_price)}</span>
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {MARTS.map((m) => (
                <div key={m.name} className="card flex items-center gap-3 p-4">
                  <span className={`grid size-12 shrink-0 place-items-center rounded-xl font-display text-sm ${m.cls}`}>{m.name.slice(0, 2)}</span>
                  <div>
                    <p className="font-semibold">{m.name} <span className={`chip ml-1 ${m.badge === "실시간 수집" ? "bg-leaf-100 text-leaf-800 dark:bg-leaf-900/50 dark:text-leaf-200" : "bg-slate-100 text-slate-500 dark:bg-ink-line"}`}>{m.badge}</span></p>
                    <p className="text-xs text-slate-500">{m.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionTitle eyebrow="FAQ" title="자주 묻는 질문" />
            <div className="mt-10 space-y-3">
              {FAQ.map((f, i) => (
                <div key={f.q} className="card overflow-hidden p-0">
                  <button onClick={() => setFaq(faq === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold" aria-expanded={faq === i}>
                    <span><span className="mr-2 text-leaf-600">Q.</span>{f.q}</span>
                    <i className={`fa-solid fa-chevron-down text-sm text-slate-400 transition-transform ${faq === i ? "rotate-180" : ""}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ${faq === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <p className="overflow-hidden px-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      <span className="block pb-4">{f.a}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-4 sm:px-6">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-br from-leaf-600 to-leaf-900 px-6 py-14 text-center text-white sm:px-12">
            <i className="fa-solid fa-carrot absolute top-6 left-8 rotate-12 text-6xl text-white/10" />
            <i className="fa-solid fa-fish absolute right-10 bottom-6 -rotate-12 text-7xl text-white/10" />
            <h2 className="text-3xl sm:text-4xl">오늘 저녁, 냉장고부터 열어볼까요?</h2>
            <p className="mx-auto mt-3 max-w-xl text-leaf-100">가입 1분이면 할인 매칭과 AI 레시피를 바로 받아볼 수 있어요.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to={startTo} className="btn bg-white px-6 py-3.5 text-base text-leaf-800 hover:bg-leaf-50"><i className="fa-solid fa-leaf" />{user ? "대시보드로 이동" : "무료로 시작하기"}</Link>
              {!user && <Link to="/login" className="btn bg-white/15 px-6 py-3.5 text-base text-white hover:bg-white/25">로그인</Link>}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

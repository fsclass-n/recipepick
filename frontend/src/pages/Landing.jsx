import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import { api, CATEGORY_ICONS, HEALTH_LABELS, won } from "../lib/api";
import { IMG, unsplash } from "../lib/images";
import MartLogo from "../components/MartLogo";

// 건강 목표별 "식단 룩북" 컬렉션 — 각 컬렉션은 AI 레시피 창작 시 적용되는 영양 기준과 1:1 대응한다.
const LOOKBOOK = [
  { key: "general", no: "01", title: "균형 한식 밥상", en: "Balanced Table", img: IMG.bibimbap, rule: "균형 잡힌 영양 · 가공식품 최소화", copy: "제철 채소와 단백질을 고르게 담은, 매일 먹어도 질리지 않는 한 그릇." },
  { key: "diabetes", no: "02", title: "저GI 그레인 볼", en: "Low-GI Bowl", img: IMG.grainBowl, rule: "탄수화물 1회 45~60g · 저GI 곡물", copy: "혈당이 천천히 오르도록 통곡물과 식이섬유를 먼저." },
  { key: "diet", no: "03", title: "500kcal 라이트 플레이트", en: "Light Plate", img: IMG.greenSalad, rule: "1인분 500kcal 이하 · 고단백", copy: "포만감은 그대로, 칼로리만 가볍게." },
  { key: "hypertension", no: "04", title: "저염 DASH 테이블", en: "Low-Sodium", img: IMG.greensPlate, rule: "1인분 나트륨 600mg 이하", copy: "소금 대신 허브와 산미로 맛을 채운 식탁." },
  { key: "cholesterol", no: "05", title: "오메가-3 시푸드", en: "Omega Seafood", img: IMG.salmonPlate, rule: "포화지방↓ · 오메가-3·식이섬유↑", copy: "등푸른 생선과 견과로 혈관을 가볍게." },
];

const PILLARS = [
  { icon: "fa-piggy-bank", en: "Save", title: "식비를 아끼고", desc: "RPA가 대형마트 할인·마감세일을 매시간 수집해 가장 싼 재료부터 제안해요." },
  { icon: "fa-heart-pulse", en: "Health", title: "건강을 지키고", desc: "당뇨·다이어트·고혈압·고지혈 기준을 프롬프트에 적용해 영양 성분까지 계산해요." },
  { icon: "fa-earth-asia", en: "Planet", title: "버려질 재료를 구하고", desc: "유통기한 임박 재료와 마감세일 상품을 먼저 쓰는 레시피로 음식물 쓰레기를 줄여요." },
];

const FLOW = [
  { icon: "fa-tags", title: "마감세일 + 임박 재료", desc: "할인 식재료와 내 냉장고 재고를 자동 매칭" },
  { icon: "fa-wand-magic-sparkles", title: "Gemini AI 큐레이션", desc: "건강 기준·알레르기·조리 시간을 반영해 창작" },
  { icon: "fa-utensils", title: "건강한 한 끼", desc: "조리 단계·영양 성분·절약 금액까지 한 화면에" },
];

const STEPS = [
  { no: "01", img: IMG.cooking, title: "건강 목표를 고르세요", desc: "가입할 때 당뇨·다이어트·고혈압 등 나에게 맞는 식단 기준을 선택합니다." },
  { no: "02", img: IMG.retroFridge, title: "냉장고를 채워두세요", desc: "가진 재료와 사고 싶은 재료를 등록하면 할인 상품과 자동으로 매칭돼요." },
  { no: "03", img: IMG.mealPrep, title: "AI 레시피로 구출하세요", desc: "버튼 한 번이면 할인·임박 재료를 활용한 건강 레시피가 완성됩니다." },
];

const MARTS = [
  { name: "홈플러스", badge: "실시간 수집", live: true, note: "공개 검색 페이지 기준 자동 수집" },
  { name: "이마트", badge: "데모 데이터", note: "공식 제휴·API 연동 준비 중" },
  { name: "롯데마트", badge: "데모 데이터", note: "공식 제휴·API 연동 준비 중" },
  { name: "오이마켓", badge: "데모 데이터", note: "사이트 점검 중 · 복구 시 자동 수집 전환" },
];

const FAQ = [
  { q: "RecipePick은 무료인가요?", a: "네. 회원가입 후 냉장고 관리, 마트 할인 조회, AI 레시피 창작 등 모든 기능을 무료로 이용할 수 있어요." },
  { q: "'레스큐 키친'은 무슨 뜻인가요?", a: "곧 버려질 수 있는 마감세일 상품과 냉장고 속 유통기한 임박 재료를 먼저 활용하는 레시피를 추천한다는 RecipePick의 큐레이션 원칙이에요." },
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

function SectionHead({ eyebrow, title, desc, align = "left", action }) {
  return (
    <div className={`flex flex-col gap-5 ${align === "center" ? "items-center text-center" : "md:flex-row md:items-end md:justify-between"}`}>
      <div className={align === "center" ? "max-w-2xl" : "max-w-2xl"}>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 text-3xl leading-tight text-leaf-950 sm:text-[40px] dark:text-stone-50">{title}</h2>
        {desc && <p className="mt-4 text-[15px] leading-relaxed text-stone-500 dark:text-stone-400">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function RotatingBadge() {
  return (
    <svg viewBox="0 0 120 120" className="size-28 animate-[spin_22s_linear_infinite]" aria-hidden="true">
      <defs><path id="rp-circle" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" /></defs>
      <circle cx="60" cy="60" r="58" className="fill-tomato-500" />
      <text className="fill-white text-[11px] font-semibold tracking-[0.3em] uppercase"><textPath href="#rp-circle">Rescue Kitchen · AI Meal Curation ·</textPath></text>
    </svg>
  );
}

function Hero({ stats, startTo, user }) {
  const saving = useCountUp(stats?.total_saving || 0);
  const deals = useCountUp(stats?.deals || 0);
  return (
    <section className="relative overflow-hidden">
      <div className="absolute top-0 right-0 -z-10 h-full w-1/2 bg-paper/70 max-lg:hidden dark:bg-ink-soft/50" />
      <div className="container-x grid items-center gap-14 py-14 sm:py-20 lg:grid-cols-12 lg:py-24">
        <div className="animate-fade-up lg:col-span-6">
          <p className="eyebrow flex items-center gap-2"><span className="h-px w-8 bg-current" />Rescue Kitchen · AI Meal Curation</p>
          <h1 className="mt-6 text-[42px] leading-[1.15] text-leaf-950 sm:text-6xl lg:text-[68px] dark:text-stone-50">
            버려질 재료를,<br />가장 <span className="relative whitespace-nowrap text-tomato-500">건강한<svg viewBox="0 0 200 12" className="absolute -bottom-1 left-0 w-full" aria-hidden="true"><path d="M2 9C50 3 150 3 198 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".45" /></svg></span><br />한 끼로.
          </h1>
          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-stone-600 dark:text-stone-300">
            대형마트 <b className="font-semibold text-stone-900 dark:text-white">마감세일</b>과 냉장고 속 <b className="font-semibold text-stone-900 dark:text-white">임박 재료</b>를 한 번에 찾아, 당뇨·다이어트·고혈압 등 내 건강 기준에 맞춘 레시피를 AI가 큐레이션합니다.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to={startTo} className="btn-primary px-7 py-3.5 text-[15px]">{user ? "마이 키친으로" : "무료로 시작하기"}<i className="fa-solid fa-arrow-right text-xs" /></Link>
            <Link to="/#lookbook" className="btn-ghost px-7 py-3.5 text-[15px]"><i className="fa-solid fa-book-open text-xs" />식단 룩북 보기</Link>
          </div>
          <dl className="mt-12 grid max-w-lg grid-cols-3 divide-x divide-stone-200 border-y border-stone-200 dark:divide-ink-line dark:border-ink-line">
            {[
              ["오늘의 할인 식재료", stats ? `${deals.toLocaleString()}` : "—", "개"],
              ["평균 할인율", stats ? `${stats.avg_discount}` : "—", "%"],
              ["할인 합산 절약액", stats ? won(saving).replace("원", "") : "—", "원"],
            ].map(([k, v, unit]) => (
              <div key={k} className="px-4 py-4 first:pl-0">
                <dt className="text-[11px] text-stone-500">{k}</dt>
                <dd className="mt-1 truncate font-display text-xl text-leaf-900 sm:text-2xl dark:text-stone-100">{v}<span className="ml-0.5 text-sm text-stone-400">{stats ? unit : ""}</span></dd>
              </div>
            ))}
          </dl>
          {stats === false && <p className="mt-3 text-xs text-stone-400">실시간 통계 서버가 깨어나는 중이에요. 잠시 후 새로고침해 주세요.</p>}
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:col-span-6 lg:max-w-none lg:pl-10">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl shadow-leaf-950/20">
            <img src={unsplash(IMG.bibimbap, 1000, 1250)} alt="제철 채소와 달걀을 올린 비빔밥" className="size-full animate-ken-burns object-cover" fetchPriority="high" />
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent p-6 pb-16 text-white sm:pt-8 sm:pl-24 lg:pl-28">
              <p className="serif-en text-sm text-white/80">Today's Rescue Pick</p>
              <p className="font-display text-2xl">마감세일 두부 · 시금치 비빔밥</p>
            </div>
          </div>
          <div className="absolute -bottom-8 -left-2 hidden w-40 overflow-hidden rounded-3xl border-[6px] border-cream shadow-xl sm:block lg:-left-4 lg:w-48 dark:border-ink">
            <img src={unsplash(IMG.salmonBowl, 400, 400)} alt="" className="aspect-square w-full object-cover" loading="lazy" />
          </div>
          <div className="card absolute top-[38%] -right-2 hidden w-56 animate-float p-4 shadow-xl shadow-stone-900/10 sm:block lg:-right-6">
            <p className="flex items-center gap-2 text-xs font-semibold text-stone-500"><i className="fa-solid fa-wand-magic-sparkles text-violet-500" />AI 영양 분석 · 당뇨 관리</p>
            {[["탄수화물", 48, 60, "bg-leaf-500"], ["나트륨", 420, 600, "bg-tomato-400"]].map(([k, v, max, c]) => (
              <div key={k} className="mt-3">
                <div className="flex justify-between text-[11px]"><span className="font-semibold">{k}</span><span className="text-stone-400">{v} / {max}{k === "나트륨" ? "mg" : "g"}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-ink-line"><div className={`h-full rounded-full ${c}`} style={{ width: `${(v / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="card absolute right-4 -bottom-6 hidden animate-float items-center gap-3 p-3 pr-4 shadow-xl shadow-stone-900/10 sm:flex" style={{ animationDelay: "1.4s" }}>
            <span className="grid size-10 place-items-center rounded-full bg-tomato-500 text-white"><i className="fa-solid fa-bell" /></span>
            <div className="text-xs">
              <p className="font-bold">장바구니 재료 마감세일!</p>
              <p className="text-stone-500">고등어 2손 <s>7,980원</s> → <b className="text-tomato-600">4,710원</b></p>
            </div>
          </div>
          <div className="absolute -top-6 left-2 hidden lg:block"><RotatingBadge /></div>
        </div>
      </div>
    </section>
  );
}

function Marquee({ deals }) {
  const items = deals?.length
    ? deals.map((d) => [d.name, `-${Math.round(d.discount_rate)}%`, d.mart])
    : [["매시간 할인 수집", "RPA", "홈플러스"], ["건강 맞춤 레시피", "AI", "Gemini"], ["임박 재료 우선", "Rescue", "냉장고"]];
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-leaf-950 bg-leaf-900 py-4 text-white dark:border-ink-deep dark:bg-ink-deep" aria-label="오늘의 할인 식재료">
      <div className="flex w-max animate-marquee gap-10 hover:[animation-play-state:paused]">
        {row.map(([name, rate, mart], i) => (
          <span key={i} className="flex shrink-0 items-center gap-3 text-sm">
            <i className="fa-solid fa-asterisk text-[10px] text-tomato-400" />
            <span className="max-w-[260px] truncate text-white/85">{name}</span>
            <b className="font-display text-tomato-300">{rate}</b>
            <span className="serif-en text-white/45">{mart}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function RescueSection({ stats }) {
  return (
    <section id="rescue" className="section-y scroll-mt-24">
      <div className="container-x grid items-center gap-14 lg:grid-cols-12">
        <div className="relative lg:col-span-5">
          <div className="group overflow-hidden rounded-[2rem]">
            <img src={unsplash(IMG.market, 900, 1100)} alt="채소와 과일이 가득한 시장 매대" className="img-zoom aspect-[4/5] w-full object-cover" loading="lazy" />
          </div>
          <div className="card absolute right-4 bottom-6 w-56 p-5 shadow-xl shadow-stone-900/10 sm:-right-8 sm:bottom-10 sm:w-60">
            <p className="serif-en text-sm text-stone-400">Rescue Index</p>
            <p className="mt-1 font-display text-3xl text-tomato-600">{stats ? `${stats.closing + stats.deals}` : "—"}<span className="ml-1 text-base text-stone-400">개</span></p>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">오늘 구출을 기다리는 할인·마감세일 식재료</p>
          </div>
        </div>
        <div className="lg:col-span-7 lg:pl-8">
          <SectionHead
            eyebrow="Why RecipePick"
            title={<>할인 앱도, 레시피 앱도 아닌<br /><span className="text-tomato-500">레스큐 키친</span></>}
            desc="마감세일은 '곧 버려질 재료'이고, 냉장고 속 임박 재료도 마찬가지예요. RecipePick은 이 둘을 동시에 찾아 내 건강 기준에 맞는 한 끼로 구출합니다. 아끼는 것, 건강한 것, 버리지 않는 것 — 세 가지를 한 번에."
          />
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-200 sm:grid-cols-3 dark:border-ink-line dark:bg-ink-line">
            {PILLARS.map((p) => (
              <div key={p.en} className="bg-cream p-6 dark:bg-ink">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-full bg-leaf-800 text-white dark:bg-honey-300 dark:text-ink"><i className={`fa-solid ${p.icon}`} /></span>
                  <span className="serif-en text-lg text-stone-300 dark:text-stone-600">{p.en}</span>
                </div>
                <h3 className="mt-5 text-lg">{p.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-stone-500 dark:text-stone-400">{p.desc}</p>
              </div>
            ))}
          </div>
          <ol className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            {FLOW.map((f, i) => (
              <li key={f.title} className="flex flex-1 items-center gap-3">
                <div className="flex flex-1 items-center gap-3 rounded-2xl bg-paper px-4 py-3.5 dark:bg-ink-soft">
                  <i className={`fa-solid ${f.icon} text-tomato-500`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-[11px] text-stone-500">{f.desc}</p>
                  </div>
                </div>
                {i < FLOW.length - 1 && <i className="fa-solid fa-arrow-right hidden text-xs text-stone-300 sm:block" />}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function LookbookSection({ startTo }) {
  return (
    <section id="lookbook" className="section-y scroll-mt-24 bg-paper/60 dark:bg-ink-soft/40">
      <div className="container-x">
        <SectionHead
          eyebrow="Meal Lookbook · Vol. 01"
          title="내 몸에 맞춘 식단 룩북"
          desc="건강 목표별로 큐레이션한 다섯 가지 컬렉션. 각 컬렉션의 영양 기준이 그대로 AI 레시피 창작에 적용됩니다."
          action={<Link to={startTo} className="btn-ghost shrink-0">내 컬렉션으로 레시피 받기<i className="fa-solid fa-arrow-right text-xs" /></Link>}
        />
        <div className="mt-12 grid auto-rows-[260px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LOOKBOOK.map((c, i) => {
            const h = HEALTH_LABELS[c.key];
            return (
              <Link key={c.key} to={startTo}
                className={`group relative isolate flex flex-col justify-end overflow-hidden rounded-3xl p-6 text-white ${i === 0 ? "sm:col-span-2 sm:row-span-2" : ""}`}>
                <img src={unsplash(c.img, i === 0 ? 1200 : 700, i === 0 ? 1100 : 600)} alt="" loading="lazy" className="img-zoom absolute inset-0 -z-10 size-full object-cover" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/20 to-black/35" />
                <div className="absolute top-5 left-6 flex items-center gap-2 text-xs">
                  <span className="font-display text-white/90">No.{c.no}</span>
                  <span className="h-px w-6 bg-white/50" />
                  <span className="serif-en text-white/80">{c.en}</span>
                </div>
                <span className="chip w-fit bg-white/15 text-white backdrop-blur"><i className={`fa-solid ${h.icon}`} />{h.label}</span>
                <h3 className={`mt-3 leading-tight ${i === 0 ? "text-3xl sm:text-4xl" : "text-2xl"}`}>{c.title}</h3>
                {i === 0 && <p className="mt-2 max-w-md text-sm text-white/80">{c.copy}</p>}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/20 pt-3 text-xs text-white/75">
                  <span>{c.rule}</span>
                  <i className="fa-solid fa-arrow-right -translate-x-2 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mt-6 text-xs text-stone-400">* 일반적인 식단 가이드이며 의학적 진단·처방을 대체하지 않습니다.</p>
      </div>
    </section>
  );
}

function DealsSection({ stats, startTo }) {
  return (
    <section id="deals" className="section-y scroll-mt-24">
      <div className="container-x">
        <SectionHead
          eyebrow="Today's Rescue Deals"
          title="지금 가장 많이 할인 중인 식재료"
          desc="RPA가 수집한 할인율 상위 상품이에요. 로그인하면 내 냉장고·장바구니와 자동으로 매칭해 알림을 보내드려요."
          action={<Link to="/deals" className="link-underline shrink-0 text-sm font-semibold">마감세일 전체 보기 <i className="fa-solid fa-arrow-right ml-1 text-xs" /></Link>}
        />
        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-4">
          {stats === null && Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton aspect-[4/5]" />)}
          {stats === false && (
            <div className="col-span-full rounded-3xl bg-paper p-12 text-center text-sm text-stone-500 dark:bg-ink-soft">
              <i className="fa-solid fa-mug-hot mb-3 block text-3xl text-leaf-400" />할인 정보 서버가 깨어나는 중이에요. 잠시 후 다시 확인해 주세요.
            </div>
          )}
          {stats?.top_deals?.map((d) => (
            <Link to={startTo} key={d.name + d.mart} className="group block">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-white dark:bg-ink-soft">
                {d.image_url ? (
                  <img src={d.image_url} alt={d.name} loading="lazy" className={`img-zoom size-full ${d.source === "demo" ? "object-cover" : "object-contain p-5"}`} />
                ) : (
                  <div className="grid size-full place-items-center bg-gradient-to-br from-leaf-50 to-paper dark:from-ink-line dark:to-ink">
                    <i className={`fa-solid ${CATEGORY_ICONS[d.category] || CATEGORY_ICONS.기타} text-5xl text-leaf-400/70 transition group-hover:scale-110`} />
                  </div>
                )}
                <span className="absolute top-3 left-3 chip bg-white/90 text-stone-700 shadow-sm dark:bg-black/60 dark:text-white">{d.mart}</span>
                {d.is_closing_sale && <span className="absolute top-3 right-3 chip bg-tomato-500 text-white"><i className="fa-solid fa-clock" />마감</span>}
                {d.source === "demo" && <span className="absolute right-3 bottom-3 chip bg-black/45 text-[10px] text-white">DEMO</span>}
              </div>
              <p className="mt-3 text-[11px] text-stone-400">{d.category}</p>
              <p className="mt-0.5 line-clamp-2 min-h-[2.6em] text-sm leading-snug text-stone-800 dark:text-stone-200">{d.name}</p>
              <p className="mt-1.5 flex items-baseline gap-2">
                <span className="font-display text-lg text-tomato-600 dark:text-tomato-400">{Math.round(d.discount_rate)}%</span>
                <span className="text-[15px] font-bold">{won(d.sale_price)}</span>
              </p>
              <p className="text-xs text-stone-400"><s>{won(d.original_price)}</s></p>
            </Link>
          ))}
        </div>
        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MARTS.map((m) => (
            <div key={m.name} className="flex items-center gap-4 rounded-2xl border border-stone-200 p-4 dark:border-ink-line">
              <MartLogo mart={m.name} className="h-12 w-24" />
              <div>
                <p className="font-semibold">
                  {m.name}
                  <span className={`chip ml-2 ${m.live ? "bg-leaf-100 text-leaf-800 dark:bg-leaf-900/50 dark:text-leaf-200" : "bg-stone-100 text-stone-500 dark:bg-ink-line"}`}>{m.badge}</span>
                </p>
                <p className="text-xs text-stone-500">{m.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowSection() {
  return (
    <section id="how" className="section-y scroll-mt-24 border-t border-stone-200 dark:border-ink-line">
      <div className="container-x">
        <SectionHead align="center" eyebrow="How it works" title="세 단계로 시작하는 냉장고 구출" />
        <ol className="mt-14 grid gap-10 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.no} className="group">
              <div className="overflow-hidden rounded-3xl">
                <img src={unsplash(s.img, 800, 600)} alt="" loading="lazy" className="img-zoom aspect-[4/3] w-full object-cover" />
              </div>
              <div className="mt-6 flex gap-5">
                <span className="serif-en text-5xl leading-none text-tomato-500">{s.no}</span>
                <div>
                  <h3 className="text-xl">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">{s.desc}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FaqSection() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section-y scroll-mt-24 bg-paper/60 dark:bg-ink-soft/40">
      <div className="container-x grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionHead eyebrow="FAQ" title="자주 묻는 질문" desc="더 궁금한 점은 고객센터(1588-0000)로 문의해 주세요." />
          <a href="tel:1588-0000" className="btn-ghost mt-6"><i className="fa-solid fa-phone" />고객센터 1588-0000</a>
        </div>
        <div className="divide-y divide-stone-200 border-y border-stone-200 lg:col-span-8 dark:divide-ink-line dark:border-ink-line">
          {FAQ.map((f, i) => (
            <div key={f.q}>
              <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-6 py-6 text-left" aria-expanded={open === i}>
                <span className="flex gap-4 text-[16px] font-semibold">
                  <span className="serif-en text-tomato-500">Q{String(i + 1).padStart(2, "0")}</span>{f.q}
                </span>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full border border-stone-300 transition dark:border-ink-line ${open === i ? "rotate-45 border-leaf-800 bg-leaf-800 text-white" : ""}`}>
                  <i className="fa-solid fa-plus text-xs" />
                </span>
              </button>
              <div className={`grid transition-all duration-300 ${open === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <p className="overflow-hidden pl-12 text-[15px] leading-relaxed text-stone-600 dark:text-stone-300"><span className="block pb-6">{f.a}</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const location = useLocation();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api("/api/public/stats").then(setStats).catch(() => setStats(false));
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const t = setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [location.hash]);

  const startTo = user ? "/dashboard" : "/login?mode=register";

  return (
    <>
      <Hero stats={stats} startTo={startTo} user={user} />
      <Marquee deals={stats?.top_deals} />
      <RescueSection stats={stats} />
      <LookbookSection startTo={user ? "/recipe" : "/login?mode=register"} />
      <DealsSection stats={stats} startTo={user ? "/deals" : "/login"} />
      <HowSection />
      <FaqSection />
      <section className="container-x pt-24">
        <div className="relative isolate overflow-hidden rounded-[2rem] px-6 py-20 text-center text-white sm:px-12">
          <img src={unsplash(IMG.tableSpread, 1600, 700)} alt="" loading="lazy" className="absolute inset-0 -z-10 size-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-leaf-950/75" />
          <p className="serif-en text-lg text-tomato-300">Tonight's rescue mission</p>
          <h2 className="mt-3 text-3xl leading-tight sm:text-5xl">오늘 저녁, 냉장고부터<br />구출해 볼까요?</h2>
          <p className="mx-auto mt-5 max-w-xl text-white/75">가입 1분이면 할인 매칭과 AI 건강 레시피를 바로 받아볼 수 있어요.</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to={startTo} className="btn bg-white px-7 py-3.5 text-[15px] text-leaf-900 hover:bg-cream">{user ? "마이 키친으로" : "무료로 시작하기"}<i className="fa-solid fa-arrow-right text-xs" /></Link>
            {!user && <Link to="/login" className="btn border border-white/40 px-7 py-3.5 text-[15px] text-white hover:bg-white/10">테스트 계정으로 체험</Link>}
          </div>
        </div>
      </section>
    </>
  );
}

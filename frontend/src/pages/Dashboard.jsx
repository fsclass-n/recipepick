import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { api, CATEGORY_ICONS, HEALTH_LABELS, timeAgo, won } from "../lib/api";
import PageHero from "../components/PageHero";
import { IMG } from "../lib/images";

function Stat({ icon, label, value, sub, tone = "leaf" }) {
  const tones = {
    leaf: "bg-leaf-100 text-leaf-700 dark:bg-leaf-900/50 dark:text-leaf-300",
    tomato: "bg-tomato-100 text-tomato-600 dark:bg-tomato-500/20 dark:text-tomato-400",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };
  return (
    <div className="card animate-fade-up p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><i className={`fa-solid ${icon}`} /></span>
        <div className="min-w-0">
          <p className="truncate text-xs text-stone-500">{label}</p>
          <p className="font-display text-xl sm:text-2xl">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-2 truncate text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { notifications, connected, unread, markAllRead } = useRealtime();
  const [fridge, setFridge] = useState([]);
  const [summary, setSummary] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const health = HEALTH_LABELS[user.health_type] || HEALTH_LABELS.general;

  useEffect(() => {
    api("/api/fridge").then(setFridge).catch(() => {});
    api("/api/deals/summary").then(setSummary).catch(() => {});
    api("/api/recipes").then(setRecipes).catch(() => {});
  }, [notifications.length]);

  const today = new Date();
  const soon = fridge
    .filter((i) => !i.is_wishlist && i.expires_at)
    .map((i) => ({ ...i, days: Math.ceil((new Date(i.expires_at) - today) / 86400000) }))
    .filter((i) => i.days <= 5)
    .sort((a, b) => a.days - b.days);
  const matched = fridge.filter((i) => i.matched_deal);
  const potentialSaving = matched.reduce((s, i) => s + (i.matched_deal.original_price - i.matched_deal.sale_price), 0);

  return (
    <div className="space-y-6">
      <PageHero
        image={IMG.greenBowl}
        eyebrow={`My Kitchen · ${health.label} 맞춤`}
        title={<>{user.name}님,<br className="sm:hidden" /> 오늘은 무엇을 구출해 볼까요?</>}
        desc={<>냉장고 재료 {fridge.filter((i) => !i.is_wishlist).length}종과 마트 할인 식재료 {summary?.total_deals ?? 0}개를 조합해 AI가 레시피를 창작합니다.</>}
      >
        <Link to="/recipe" className="btn bg-white text-leaf-900 hover:bg-cream"><i className="fa-solid fa-wand-magic-sparkles" />AI 레시피 만들기</Link>
        <Link to="/fridge" className="btn border border-white/40 text-white hover:bg-white/10"><i className="fa-solid fa-snowflake" />냉장고 관리</Link>
      </PageHero>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="fa-snowflake" label="냉장고 보유 재료" value={`${fridge.filter((i) => !i.is_wishlist).length}종`} sub={`장바구니 ${fridge.filter((i) => i.is_wishlist).length}개`} />
        <Stat icon="fa-tags" tone="tomato" label="할인 매칭 재료" value={`${matched.length}개`} sub={`예상 절약 ${won(potentialSaving)}`} />
        <Stat icon="fa-store" tone="sky" label="수집된 할인 상품" value={`${summary?.total_deals ?? 0}개`} sub={summary?.last_collected_at ? `${timeAgo(summary.last_collected_at)} 갱신` : "수집 대기 중"} />
        <Stat icon="fa-clock" tone="amber" label="마감세일" value={`${summary?.closing_count ?? 0}건`} sub="오늘 마감 임박 특가" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl"><i className="fa-solid fa-tower-broadcast mr-2 text-tomato-500" />실시간 알림 현황판</h2>
            <div className="flex items-center gap-3">
              <span className={`chip ${connected ? "bg-leaf-100 text-leaf-800 dark:bg-leaf-900/50 dark:text-leaf-200" : "bg-stone-100 text-stone-500 dark:bg-ink-line"}`}>
                <span className={`size-1.5 rounded-full ${connected ? "animate-pulse bg-leaf-500" : "bg-stone-400"}`} />{connected ? "LIVE" : "연결 중"}
              </span>
              {unread > 0 && <button onClick={markAllRead} className="text-xs font-semibold text-leaf-700 hover:underline dark:text-leaf-300">모두 읽음</button>}
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-leaf-200 py-10 text-center text-sm text-stone-500 dark:border-ink-line">
              <i className="fa-regular fa-bell mb-2 text-2xl text-leaf-400" />
              장바구니에 재료를 담아두면 마감세일 매칭 시 실시간으로 알려드려요.
            </div>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {notifications.slice(0, 12).map((n) => (
                <li key={n.id} className={`flex animate-fade-up items-start gap-3 rounded-xl p-3 transition ${n.is_read ? "bg-stone-50 dark:bg-ink/60" : "bg-tomato-50 ring-1 ring-tomato-200 dark:bg-tomato-500/10 dark:ring-tomato-500/30"}`}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-tomato-500 text-white"><i className="fa-solid fa-tags text-sm" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{n.title} <span className="font-normal text-stone-400">· {timeAgo(n.created_at)}</span></p>
                    <p className="text-sm text-stone-600 dark:text-stone-300">{n.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-xl"><i className="fa-solid fa-hourglass-half mr-2 text-amber-500" />유통기한 임박</h2>
          {soon.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-500">임박한 재료가 없어요 👍</p>
          ) : (
            <ul className="space-y-2">
              {soon.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5 text-sm dark:bg-amber-900/20">
                  <span><i className={`fa-solid ${CATEGORY_ICONS[i.category] || CATEGORY_ICONS.기타} mr-2 text-amber-600`} />{i.name}</span>
                  <span className={`chip ${i.days <= 1 ? "bg-rose-500 text-white" : "bg-amber-200 text-amber-900"}`}>{i.days <= 0 ? "오늘까지" : `D-${i.days}`}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/recipe" className="btn-accent mt-4 w-full"><i className="fa-solid fa-fire-burner" />임박 재료로 레시피 만들기</Link>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">최근 AI 레시피</h2>
          <Link to="/recipe" className="text-sm font-semibold text-leaf-700 hover:underline dark:text-leaf-300">전체 보기 <i className="fa-solid fa-chevron-right text-xs" /></Link>
        </div>
        {recipes.length === 0 ? (
          <div className="card p-8 text-center text-sm text-stone-500">아직 만든 레시피가 없어요. 첫 레시피를 만들어 보세요!</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.slice(0, 3).map((r) => (
              <Link key={r.id} to={`/recipe?id=${r.id}`} className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <span className={`chip ${(HEALTH_LABELS[r.health_type] || HEALTH_LABELS.general).color}`}>{(HEALTH_LABELS[r.health_type] || HEALTH_LABELS.general).label}</span>
                  {timeAgo(r.created_at)}
                </div>
                <p className="font-display mt-2 text-lg group-hover:text-leaf-700 dark:group-hover:text-leaf-300">{r.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-stone-500">{r.data.summary}</p>
                <p className="mt-3 text-xs text-stone-400">
                  <i className="fa-solid fa-fire-flame-curved mr-1" />{r.data.nutrition_per_serving?.kcal}kcal · <i className="fa-regular fa-clock mx-1" />{r.data.cook_minutes}분
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

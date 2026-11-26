import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useRealtime } from "../context/RealtimeContext";
import { api, CATEGORY_ICONS, timeAgo, won } from "../lib/api";
import MartLogo, { MARTS } from "../components/MartLogo";
import PageHero from "../components/PageHero";
import { IMG } from "../lib/images";


export default function Deals() {
  const { toast, subscribe } = useRealtime();
  const navigate = useNavigate();
  const [deals, setDeals] = useState(null);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState({ mart: "", category: "", q: "", closing_only: false, sort: "discount" });
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setFilter((f) => ({ ...f, q: query })), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams(Object.entries(filter).filter(([, v]) => v !== "" && v !== false));
    setDeals(null);
    api(`/api/deals?${params}`).then(setDeals).catch((e) => { setDeals([]); toast({ title: "할인 정보 로딩 실패", message: e.message, tone: "error" }); });
  }, [filter, toast]);

  useEffect(() => {
    const loadSummary = () => api("/api/deals/summary").then(setSummary).catch(() => {});
    loadSummary();
    return subscribe((msg) => msg.type === "notification" && loadSummary());
  }, [subscribe]);

  const addToCart = async (d) => {
    try {
      await api("/api/fridge", { method: "POST", body: { name: d.name.replace(/^(국내산|국산|친환경|유기농)\s*/, ""), category: d.category, quantity: 1, unit: "개", is_wishlist: true } });
      toast({ title: "장바구니에 담았어요", message: `${d.name} · ${d.mart} ${won(d.sale_price)}`, tone: "success", icon: "fa-cart-plus" });
    } catch (e) {
      toast({ title: "담기 실패", message: e.message, tone: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        image={IMG.groceryShelf}
        eyebrow="Today's Rescue Deals"
        title="마감세일 · 할인 식재료"
        desc={<>RPA(Playwright)가 이마트·롯데마트·홈플러스·오이마켓 할인가를 주기적으로 수집합니다.{summary?.last_collected_at && <span className="ml-1 font-semibold text-tomato-300">· {timeAgo(summary.last_collected_at)} 갱신</span>}</>}
      />

      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.marts.map((m) => (
            <button key={m.mart} onClick={() => setFilter((f) => ({ ...f, mart: f.mart === m.mart ? "" : m.mart }))}
              className={`card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 ${filter.mart === m.mart ? "ring-2 ring-leaf-500" : ""}`}>
              <MartLogo mart={m.mart} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.mart} <span className="text-xs font-normal text-stone-400">{m.count}개</span></p>
                <p className="text-xs text-stone-500">평균 {m.avg_discount}% 할인 · 총 {won(m.total_saving)} 절약</p>
              </div>
              {filter.mart === m.mart && <i className="fa-solid fa-circle-check text-leaf-600" />}
            </button>
          ))}
        </div>
      )}

      <div className="card flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400" />
          <input className="input pl-10" placeholder="식재료 검색 (예: 두부, 고등어)" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
            <option value="">전체 카테고리</option>
            {(summary?.categories || []).map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="input w-auto" value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value })}>
            <option value="discount">할인율 높은 순</option>
            <option value="price">가격 낮은 순</option>
            <option value="recent">최신 수집 순</option>
          </select>
          <button onClick={() => setFilter({ ...filter, closing_only: !filter.closing_only })} className={`btn ${filter.closing_only ? "bg-tomato-500 text-white" : "btn-ghost"}`}>
            <i className="fa-solid fa-clock" />마감세일만
          </button>
        </div>
      </div>

      {deals === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-56" />)}
        </div>
      ) : deals.length === 0 ? (
        <div className="card p-12 text-center text-stone-500"><i className="fa-solid fa-store-slash mb-3 block text-4xl text-leaf-300" />조건에 맞는 할인 상품이 없어요.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {deals.map((d, idx) => (
            <article key={d.id} className="card group flex animate-fade-up flex-col overflow-hidden p-0" style={{ animationDelay: `${Math.min(idx, 12) * 25}ms` }}>
              <div className="relative grid h-28 place-items-center bg-gradient-to-br from-leaf-50 to-leaf-100 dark:from-ink-line dark:to-ink">
                {d.image_url ? <img src={d.image_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <i className={`fa-solid ${CATEGORY_ICONS[d.category] || CATEGORY_ICONS.기타} text-4xl text-leaf-500/70 transition group-hover:scale-110`} />}
                <span className={`absolute top-2 left-2 chip ${MARTS[d.mart]?.chip || "bg-stone-600 text-white"}`}>{d.mart}</span>
                {d.is_closing_sale && <span className="absolute top-2 right-2 chip animate-pulse bg-tomato-500 text-white"><i className="fa-solid fa-clock" />마감</span>}
                {d.source === "demo" && <span className="absolute bottom-2 right-2 chip bg-black/40 text-[10px] text-white">DEMO</span>}
              </div>
              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <p className="line-clamp-2 text-sm font-semibold">{d.name}</p>
                <p className="text-xs text-stone-400">{d.unit} · {d.store}</p>
                <div className="mt-auto pt-2">
                  <p className="text-xs text-stone-400"><s>{won(d.original_price)}</s></p>
                  <p className="flex items-baseline gap-1.5">
                    <span className="font-display text-lg text-tomato-600 dark:text-tomato-400">{Math.round(d.discount_rate)}%</span>
                    <span className="text-base font-bold">{won(d.sale_price)}</span>
                  </p>
                </div>
                <div className="mt-3 flex gap-1.5">
                  <button onClick={() => addToCart(d)} className="btn-ghost flex-1 px-2 py-1.5 text-xs"><i className="fa-solid fa-cart-plus" />담기</button>
                  <button onClick={() => navigate(`/recipe?deal=${d.id}`)} className="btn-primary flex-1 px-2 py-1.5 text-xs"><i className="fa-solid fa-wand-magic-sparkles" />레시피</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useRealtime } from "../context/RealtimeContext";
import { api, CATEGORY_ICONS, won } from "../lib/api";

const CATEGORIES = Object.keys(CATEGORY_ICONS);
const EMPTY = { name: "", category: "채소", quantity: 1, unit: "개", expires_at: "", is_wishlist: false };

function daysLeft(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date(new Date().toDateString())) / 86400000);
}

function ItemCard({ item, onUpdate, onDelete }) {
  const deal = item.matched_deal;
  const days = daysLeft(item.expires_at);
  return (
    <div className={`card group relative flex animate-pop flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-md ${deal ? "ring-2 ring-tomato-400/70 dark:ring-tomato-500/60" : ""}`}>
      {deal && (
        <span className="absolute -top-2.5 right-3 chip bg-tomato-500 text-white shadow-md shadow-tomato-500/30">
          <i className="fa-solid fa-bolt" />-{Math.round(deal.discount_rate)}%{deal.is_closing_sale && " 마감"}
        </span>
      )}
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${item.is_wishlist ? "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300" : "bg-leaf-100 text-leaf-700 dark:bg-leaf-900/50 dark:text-leaf-300"}`}>
          <i className={`fa-solid ${CATEGORY_ICONS[item.category] || CATEGORY_ICONS.기타}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{item.name}</p>
          <p className="text-xs text-slate-500">{item.category}</p>
        </div>
      </div>

      {!item.is_wishlist && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-ink-line">
            <button onClick={() => onUpdate(item, { quantity: Math.max(0, item.quantity - 1) })} className="px-2 py-1 text-slate-500 hover:text-leaf-700" aria-label="수량 감소"><i className="fa-solid fa-minus text-xs" /></button>
            <span className="min-w-10 text-center text-sm font-semibold">{+item.quantity.toFixed(1)}{item.unit}</span>
            <button onClick={() => onUpdate(item, { quantity: item.quantity + 1 })} className="px-2 py-1 text-slate-500 hover:text-leaf-700" aria-label="수량 증가"><i className="fa-solid fa-plus text-xs" /></button>
          </div>
          {days !== null && (
            <span className={`chip whitespace-nowrap ${days <= 1 ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" : days <= 3 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-slate-100 text-slate-500 dark:bg-ink-line"}`}>
              {days < 0 ? "기한 지남" : days === 0 ? "오늘까지" : `D-${days}`}
            </span>
          )}
        </div>
      )}

      {deal ? (
        <a href={deal.url || undefined} target="_blank" rel="noreferrer" className="mt-3 block rounded-xl bg-tomato-50 p-2.5 text-xs dark:bg-tomato-500/10">
          <p className="truncate font-semibold text-tomato-700 dark:text-tomato-400">{deal.mart} · {deal.name}</p>
          <p className="mt-0.5"><span className="font-bold text-slate-800 dark:text-slate-100">{won(deal.sale_price)}</span> <s className="text-slate-400">{won(deal.original_price)}</s></p>
        </a>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-400 dark:bg-ink/60">현재 매칭된 할인 없음</p>
      )}

      <div className="mt-3 flex gap-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button onClick={() => onUpdate(item, { is_wishlist: !item.is_wishlist, quantity: item.is_wishlist ? 1 : item.quantity })} className="btn-ghost flex-1 px-2 py-1.5 text-xs">
          <i className={`fa-solid ${item.is_wishlist ? "fa-snowflake" : "fa-cart-plus"}`} />{item.is_wishlist ? "구매 완료" : "장바구니"}
        </button>
        <button onClick={() => onDelete(item)} className="btn px-2.5 py-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40" aria-label="삭제"><i className="fa-solid fa-trash" /></button>
      </div>
    </div>
  );
}

export default function Fridge() {
  const { toast, notifications } = useRealtime();
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState("fridge");
  const [cat, setCat] = useState("전체");
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const load = () => api("/api/fridge").then(setItems).catch((e) => toast({ title: "불러오기 실패", message: e.message, tone: "error" }));
  useEffect(() => {
    load();
  }, [notifications.length]);

  const list = useMemo(() => (items || []).filter((i) => (tab === "cart" ? i.is_wishlist : !i.is_wishlist) && (cat === "전체" || i.category === cat)), [items, tab, cat]);
  const cart = (items || []).filter((i) => i.is_wishlist);
  const cartByMart = useMemo(() => {
    const m = {};
    cart.forEach((i) => {
      const key = i.matched_deal?.mart || "할인 없음";
      (m[key] ||= []).push(i);
    });
    return Object.entries(m).sort((a, b) => (a[0] === "할인 없음") - (b[0] === "할인 없음") || b[1].length - a[1].length);
  }, [cart]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const created = await api("/api/fridge", { method: "POST", body: { ...form, is_wishlist: tab === "cart" || form.is_wishlist, expires_at: form.expires_at || null, quantity: Number(form.quantity) } });
      setItems((l) => [created, ...(l || [])]);
      setForm(EMPTY);
      toast({ title: `${created.name} 추가 완료`, message: created.matched_deal ? `${created.matched_deal.mart}에서 ${won(created.matched_deal.sale_price)}에 할인 중이에요!` : undefined, tone: created.matched_deal ? "deal" : "success" });
    } catch (err) {
      toast({ title: "추가 실패", message: err.message, tone: "error" });
    }
  };

  const update = async (item, patch) => {
    setItems((l) => l.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    try {
      const u = await api(`/api/fridge/${item.id}`, { method: "PATCH", body: patch });
      setItems((l) => l.map((i) => (i.id === item.id ? u : i)));
    } catch (err) {
      toast({ title: "수정 실패", message: err.message, tone: "error" });
      load();
    }
  };

  const remove = async (item) => {
    setItems((l) => l.filter((i) => i.id !== item.id));
    await api(`/api/fridge/${item.id}`, { method: "DELETE" }).catch(() => load());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl text-leaf-900 dark:text-leaf-100">냉장고 파먹기</h1>
          <p className="mt-1 text-sm text-slate-500">할인 중인 재료는 <span className="font-semibold text-tomato-600">주황색 테두리</span>로 자동 하이라이트됩니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary"><i className={`fa-solid ${showForm ? "fa-xmark" : "fa-plus"}`} />재료 추가</button>
          <Link to="/recipe" className="btn-accent"><i className="fa-solid fa-wand-magic-sparkles" /><span className="hidden sm:inline">AI 레시피</span></Link>
        </div>
      </div>

      {showForm && (
        <form onSubmit={add} className="card grid animate-fade-up grid-cols-2 gap-3 p-4 sm:grid-cols-6 sm:items-end">
          <div className="col-span-2">
            <label className="label">재료명</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 두부, 양파, 고등어" autoFocus />
          </div>
          <div>
            <label className="label">분류</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label">수량</label>
              <input type="number" min="0" step="0.5" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="w-16">
              <label className="label">단위</label>
              <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">유통기한</label>
            <input type="date" className="input" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} disabled={tab === "cart"} />
          </div>
          <button type="submit" className="btn-primary col-span-2 sm:col-span-1"><i className="fa-solid fa-check" />{tab === "cart" ? "장바구니에 담기" : "냉장고에 넣기"}</button>
        </form>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl bg-white p-1 shadow-sm dark:bg-ink-soft">
          {[["fridge", "fa-snowflake", "냉장고"], ["cart", "fa-cart-shopping", "장바구니"]].map(([k, icon, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === k ? "bg-leaf-600 text-white shadow" : "text-slate-500 hover:text-leaf-700"}`}>
              <i className={`fa-solid ${icon}`} />{label}
              <span className={`chip ${tab === k ? "bg-white/20" : "bg-slate-100 dark:bg-ink-line"}`}>{(items || []).filter((i) => (k === "cart") === i.is_wishlist).length}</span>
            </button>
          ))}
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {["전체", ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`chip shrink-0 py-1.5 transition ${cat === c ? "bg-leaf-700 text-white" : "bg-white text-slate-600 hover:bg-leaf-50 dark:bg-ink-soft dark:text-slate-300"}`}>{c}</button>
          ))}
        </div>
      </div>

      {tab === "cart" && cart.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-lg"><i className="fa-solid fa-map-location-dot mr-2 text-sky-500" />장바구니 맵 · 마트별 최저가 동선</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cartByMart.map(([mart, list]) => (
              <div key={mart} className={`rounded-xl p-3 ${mart === "할인 없음" ? "bg-slate-50 dark:bg-ink/60" : "bg-sky-50 dark:bg-sky-950/30"}`}>
                <p className="font-semibold"><i className="fa-solid fa-store mr-1.5 text-sky-500" />{mart} <span className="text-xs text-slate-400">{list.length}개</span></p>
                <ul className="mt-2 space-y-1 text-sm">
                  {list.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2"><span className="truncate">{i.name}</span>{i.matched_deal && <span className="shrink-0 font-semibold">{won(i.matched_deal.sale_price)}</span>}</li>
                  ))}
                </ul>
                {mart !== "할인 없음" && (
                  <p className="mt-2 border-t border-sky-100 pt-2 text-xs text-sky-700 dark:border-sky-900 dark:text-sky-300">
                    합계 {won(list.reduce((s, i) => s + i.matched_deal.sale_price, 0))} · 절약 {won(list.reduce((s, i) => s + i.matched_deal.original_price - i.matched_deal.sale_price, 0))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {items === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton h-44" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="card grid place-items-center p-12 text-center text-slate-500">
          <i className={`fa-solid ${tab === "cart" ? "fa-cart-shopping" : "fa-snowflake"} mb-3 text-4xl text-leaf-300`} />
          <p>{tab === "cart" ? "장바구니가 비어있어요. 사고 싶은 재료를 담으면 할인 시 알려드려요!" : "냉장고가 비어있어요. 재료를 추가해 보세요."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((i) => <ItemCard key={i.id} item={i} onUpdate={update} onDelete={remove} />)}
        </div>
      )}
    </div>
  );
}

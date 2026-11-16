import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { api, HEALTH_LABELS, timeAgo, won } from "../lib/api";

const LOADING_STEPS = [
  { icon: "fa-snowflake", text: "냉장고 재료를 확인하는 중..." },
  { icon: "fa-tags", text: "마트 할인 식재료를 조합하는 중..." },
  { icon: "fa-heart-pulse", text: "건강 상태에 맞춰 영양 균형을 계산하는 중..." },
  { icon: "fa-wand-magic-sparkles", text: "Gemini AI가 레시피를 창작하는 중..." },
];

const NUTRITION_LIMITS = {
  kcal: { label: "열량", unit: "kcal", max: { general: 700, diabetes: 600, diet: 500, hypertension: 650, cholesterol: 650 } },
  carbs_g: { label: "탄수화물", unit: "g", max: { general: 100, diabetes: 60, diet: 50, hypertension: 90, cholesterol: 90 } },
  protein_g: { label: "단백질", unit: "g", max: { general: 40, diabetes: 40, diet: 40, hypertension: 40, cholesterol: 40 }, good: true },
  fat_g: { label: "지방", unit: "g", max: { general: 25, diabetes: 20, diet: 15, hypertension: 20, cholesterol: 15 } },
  sodium_mg: { label: "나트륨", unit: "mg", max: { general: 1000, diabetes: 800, diet: 800, hypertension: 600, cholesterol: 800 } },
};

function NutritionBars({ n, health }) {
  return (
    <div className="space-y-2.5">
      {Object.entries(NUTRITION_LIMITS).map(([k, cfg]) => {
        const v = n?.[k] ?? 0;
        const max = cfg.max[health] || cfg.max.general;
        const pct = Math.min(100, (v / max) * 100);
        const over = !cfg.good && v > max;
        return (
          <div key={k}>
            <div className="flex justify-between text-xs">
              <span className="font-semibold">{cfg.label}</span>
              <span className={over ? "font-bold text-rose-600" : "text-slate-500"}>{v.toLocaleString()}{cfg.unit} <span className="text-slate-400">/ 권장 {max.toLocaleString()}</span></span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-ink-line">
              <div className={`h-full rounded-full transition-all duration-700 ${over ? "bg-rose-500" : cfg.good ? "bg-sky-500" : "bg-leaf-500"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecipeCard({ recipe }) {
  const d = recipe.data;
  const health = HEALTH_LABELS[recipe.health_type] || HEALTH_LABELS.general;
  const [done, setDone] = useState([]);
  useEffect(() => setDone([]), [recipe.id]);
  const toggle = (i) => setDone((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  const saved = (d.used_deals || []).reduce((s, x) => s + (x.original_price - x.sale_price), 0);

  return (
    <article className="card animate-fade-up overflow-hidden p-0">
      <header className="relative bg-gradient-to-br from-leaf-600 to-leaf-800 p-6 text-white">
        <i className="fa-solid fa-utensils absolute right-5 bottom-3 text-7xl text-white/10" />
        <div className="flex flex-wrap gap-1.5">
          <span className="chip bg-white/20"><i className={`fa-solid ${health.icon}`} />{health.label}</span>
          <span className={`chip ${recipe.source === "gemini" ? "bg-sky-400/30" : "bg-amber-400/30"}`}>
            <i className={`fa-solid ${recipe.source === "gemini" ? "fa-wand-magic-sparkles" : "fa-book"}`} />{recipe.source === "gemini" ? `Gemini AI 창작${d.model ? ` · ${d.model}` : ""}` : d.fallback_reason === "no_api_key" ? "기본 템플릿 (API 키 미설정)" : "기본 템플릿 (AI 응답 지연·실패)"}
          </span>
        </div>
        <h2 className="mt-3 text-2xl sm:text-3xl">{d.title}</h2>
        <p className="mt-1 text-sm text-leaf-100">{d.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <span className="rounded-xl bg-white/10 px-3 py-2"><i className="fa-regular fa-clock mr-1.5" />{d.cook_minutes}분</span>
          <span className="rounded-xl bg-white/10 px-3 py-2"><i className="fa-solid fa-users mr-1.5" />{d.servings}인분</span>
          <span className="rounded-xl bg-white/10 px-3 py-2"><i className="fa-solid fa-signal mr-1.5" />{d.difficulty}</span>
          <span className="rounded-xl bg-white/10 px-3 py-2"><i className="fa-solid fa-coins mr-1.5" />{won(d.estimated_cost)}</span>
        </div>
        {saved > 0 && <p className="mt-3 text-sm text-tomato-300"><i className="fa-solid fa-piggy-bank mr-1" />할인 재료 활용으로 {won(saved)} 절약!</p>}
      </header>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h3 className="mb-2 text-lg">재료</h3>
            <ul className="space-y-1.5">
              {d.ingredients?.map((ing, i) => (
                <li key={i} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${ing.from_deal ? "bg-tomato-50 dark:bg-tomato-500/10" : "bg-slate-50 dark:bg-ink/60"}`}>
                  <span className="min-w-0 truncate">{ing.from_deal && <i className="fa-solid fa-tag mr-1.5 text-tomato-500" />}{ing.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{ing.amount}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-lg">1인분 영양 성분</h3>
            <NutritionBars n={d.nutrition_per_serving} health={recipe.health_type} />
          </section>
          {d.substitutions?.length > 0 && (
            <section>
              <h3 className="mb-2 text-lg">대체 식재료</h3>
              <ul className="space-y-1.5 text-sm">
                {d.substitutions.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 dark:bg-sky-950/30">
                    <span className="truncate">{s.original}</span><i className="fa-solid fa-arrow-right-arrow-left text-xs text-sky-500" /><span className="truncate font-semibold">{s.alternative}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6 lg:col-span-3">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg">조리 순서</h3>
              <span className="text-xs text-slate-400">{done.length}/{d.steps?.length || 0} 완료</span>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-ink-line">
              <div className="h-full bg-leaf-500 transition-all" style={{ width: `${(done.length / (d.steps?.length || 1)) * 100}%` }} />
            </div>
            <ol className="space-y-2">
              {d.steps?.map((s, i) => (
                <li key={i}>
                  <button onClick={() => toggle(i)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition ${done.includes(i) ? "border-leaf-200 bg-leaf-50 text-slate-400 line-through dark:border-leaf-900 dark:bg-leaf-950/30" : "border-slate-200 hover:border-leaf-300 dark:border-ink-line"}`}>
                    <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done.includes(i) ? "bg-leaf-500 text-white" : "bg-leaf-100 text-leaf-800 dark:bg-leaf-900 dark:text-leaf-200"}`}>
                      {done.includes(i) ? <i className="fa-solid fa-check" /> : i + 1}
                    </span>
                    <span className="flex-1">{s}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
          {d.health_tips?.length > 0 && (
            <section className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-900/20">
              <h3 className="mb-2 text-lg text-amber-800 dark:text-amber-300"><i className="fa-solid fa-lightbulb mr-1.5" />{health.label} 꿀팁</h3>
              <ul className="space-y-1.5 text-sm text-amber-900 dark:text-amber-100">
                {d.health_tips.map((t, i) => <li key={i} className="flex gap-2"><i className="fa-solid fa-check mt-1 text-xs text-amber-600" />{t}</li>)}
              </ul>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Recipe() {
  const { user } = useAuth();
  const { toast } = useRealtime();
  const [params, setParams] = useSearchParams();
  const [fridge, setFridge] = useState([]);
  const [deals, setDeals] = useState([]);
  const [history, setHistory] = useState([]);
  const [selFridge, setSelFridge] = useState(null);
  const [selDeals, setSelDeals] = useState(() => (params.get("deal") ? [Number(params.get("deal"))] : []));
  const [opts, setOpts] = useState({ health_type: user.health_type, servings: 2, max_minutes: 30, notes: "", extra: "", use_top_deals: true });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [recipe, setRecipe] = useState(null);

  useEffect(() => {
    api("/api/fridge").then((items) => {
      setFridge(items.filter((i) => !i.is_wishlist && i.quantity > 0));
      setSelFridge((s) => s ?? items.filter((i) => !i.is_wishlist && i.quantity > 0).map((i) => i.id));
    });
    api("/api/deals?limit=24").then(setDeals);
    api("/api/recipes").then((h) => {
      setHistory(h);
      const id = Number(params.get("id"));
      if (id) setRecipe(h.find((r) => r.id === id) || null);
    });
  }, []);

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 1400);
    return () => clearInterval(t);
  }, [loading]);

  const dealList = useMemo(() => {
    const picked = deals.filter((d) => selDeals.includes(d.id));
    return [...picked, ...deals.filter((d) => !selDeals.includes(d.id))].slice(0, 16);
  }, [deals, selDeals]);

  const toggle = (setter) => (id) => setter((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const generate = async () => {
    setLoading(true);
    setRecipe(null);
    try {
      const r = await api("/api/recipes/generate", {
        method: "POST",
        body: {
          fridge_item_ids: selFridge || [],
          deal_ids: selDeals,
          extra_ingredients: opts.extra.split(",").map((s) => s.trim()).filter(Boolean),
          use_top_deals: opts.use_top_deals,
          health_type: opts.health_type,
          servings: Number(opts.servings),
          max_minutes: Number(opts.max_minutes),
          notes: opts.notes,
        },
      });
      setRecipe(r);
      setHistory((h) => [r, ...h]);
      setParams({ id: r.id }, { replace: true });
      setTimeout(() => document.getElementById("recipe-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      toast({ title: "레시피 생성 실패", message: e.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const removeHistory = async (id) => {
    await api(`/api/recipes/${id}`, { method: "DELETE" });
    setHistory((h) => h.filter((r) => r.id !== id));
    if (recipe?.id === id) setRecipe(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-leaf-900 dark:text-leaf-100">AI 맞춤 레시피 창작</h1>
        <p className="mt-1 text-sm text-slate-500">냉장고 재료 + 마트 할인 식재료 + 내 건강 상태를 조합해 Gemini가 새로운 레시피를 만들어 드려요.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card space-y-5 p-5 lg:col-span-2">
          <div>
            <label className="label">건강 관리 목표</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {Object.entries(HEALTH_LABELS).map(([k, h]) => (
                <button key={k} onClick={() => setOpts({ ...opts, health_type: k })}
                  className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${opts.health_type === k ? "border-leaf-500 bg-leaf-50 text-leaf-800 ring-2 ring-leaf-500/20 dark:bg-leaf-950/50 dark:text-leaf-200" : "border-slate-200 text-slate-500 hover:border-leaf-300 dark:border-ink-line"}`}>
                  <i className={`fa-solid ${h.icon} mb-1 block text-base`} />{h.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label">냉장고 재료 <span className="font-normal text-slate-400">({selFridge?.length || 0}/{fridge.length} 선택)</span></label>
              <button onClick={() => setSelFridge(selFridge?.length === fridge.length ? [] : fridge.map((i) => i.id))} className="text-xs font-semibold text-leaf-700 dark:text-leaf-300">{selFridge?.length === fridge.length ? "전체 해제" : "전체 선택"}</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {fridge.length === 0 && <p className="text-sm text-slate-400">냉장고가 비어있어요. 할인 재료만으로 만들어 드릴게요.</p>}
              {fridge.map((i) => (
                <button key={i.id} onClick={() => toggle(setSelFridge)(i.id)} className={`chip py-1.5 transition ${selFridge?.includes(i.id) ? "bg-leaf-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-ink-line"}`}>
                  {selFridge?.includes(i.id) && <i className="fa-solid fa-check" />}{i.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">마트 할인 재료 <span className="font-normal text-slate-400">(선택 시 우선 활용)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {dealList.map((d) => (
                <button key={d.id} onClick={() => toggle(setSelDeals)(d.id)} className={`chip py-1.5 transition ${selDeals.includes(d.id) ? "bg-tomato-500 text-white" : "bg-tomato-50 text-tomato-700 dark:bg-tomato-500/10 dark:text-tomato-400"}`}>
                  {selDeals.includes(d.id) && <i className="fa-solid fa-check" />}{d.name} <span className="opacity-70">-{Math.round(d.discount_rate)}%</span>
                </button>
              ))}
            </div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" className="accent-leaf-600" checked={opts.use_top_deals} onChange={(e) => setOpts({ ...opts, use_top_deals: e.target.checked })} />
              장바구니·냉장고 재료와 매칭된 할인 상품 자동 추가
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label className="label">추가 재료 (쉼표 구분)</label>
              <input className="input" placeholder="예: 마늘, 들기름" value={opts.extra} onChange={(e) => setOpts({ ...opts, extra: e.target.value })} />
            </div>
            <div>
              <label className="label">인분</label>
              <select className="input" value={opts.servings} onChange={(e) => setOpts({ ...opts, servings: e.target.value })}>{[1, 2, 3, 4, 6].map((n) => <option key={n} value={n}>{n}인분</option>)}</select>
            </div>
            <div>
              <label className="label">조리시간</label>
              <select className="input" value={opts.max_minutes} onChange={(e) => setOpts({ ...opts, max_minutes: e.target.value })}>{[15, 30, 45, 60].map((n) => <option key={n} value={n}>{n}분 이내</option>)}</select>
            </div>
          </div>
          <div>
            <label className="label">요청사항</label>
            <input className="input" placeholder="예: 맵지 않게, 도시락용으로" value={opts.notes} onChange={(e) => setOpts({ ...opts, notes: e.target.value })} maxLength={300} />
          </div>

          <button onClick={generate} disabled={loading} className="btn-primary w-full py-3.5 text-base">
            {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-wand-magic-sparkles" />}
            {loading ? "레시피 창작 중..." : "AI 레시피 창작하기"}
          </button>
        </section>

        <aside className="card p-5">
          <h2 className="mb-3 text-lg"><i className="fa-solid fa-clock-rotate-left mr-2 text-leaf-600" />레시피 기록</h2>
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">아직 기록이 없어요</p>
          ) : (
            <ul className="max-h-[32rem] space-y-1.5 overflow-y-auto">
              {history.map((r) => (
                <li key={r.id} className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 transition ${recipe?.id === r.id ? "bg-leaf-100 dark:bg-leaf-900/40" : "hover:bg-slate-50 dark:hover:bg-ink-line"}`}>
                  <button onClick={() => { setRecipe(r); setParams({ id: r.id }, { replace: true }); }} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                    <p className="text-xs text-slate-400">{(HEALTH_LABELS[r.health_type] || HEALTH_LABELS.general).label} · {timeAgo(r.created_at)}</p>
                  </button>
                  <button onClick={() => removeHistory(r.id)} className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500" aria-label="삭제"><i className="fa-solid fa-trash text-xs" /></button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <div id="recipe-result" className="scroll-mt-20">
        {loading && (
          <div className="card p-8">
            <ul className="mx-auto max-w-md space-y-3">
              {LOADING_STEPS.map((s, i) => (
                <li key={i} className={`flex items-center gap-3 text-sm transition-all duration-500 ${i <= step ? "opacity-100" : "opacity-30"}`}>
                  <span className={`grid size-9 place-items-center rounded-xl ${i < step ? "bg-leaf-500 text-white" : i === step ? "bg-leaf-100 text-leaf-700 dark:bg-leaf-900 dark:text-leaf-200" : "bg-slate-100 text-slate-400 dark:bg-ink-line"}`}>
                    <i className={`fa-solid ${i < step ? "fa-check" : s.icon} ${i === step ? "fa-beat-fade" : ""}`} />
                  </span>
                  {s.text}
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              <div className="skeleton h-6 w-1/2" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          </div>
        )}
        {!loading && recipe && <RecipeCard recipe={recipe} />}
      </div>
    </div>
  );
}

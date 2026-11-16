import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import Footer from "../components/Footer";
import PublicHeader from "../components/PublicHeader";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { api, HEALTH_LABELS, oauthLoginUrl, PASSWORD_RULE, passwordChecks, won } from "../lib/api";

const TEST_ACCOUNTS = {
  user: { email: "user@recipepick.dev", password: "Recipe!2026" },
  admin: { email: "admin@recipepick.dev", password: "Admin!2026" },
};

const OAUTH_ERRORS = {
  oauth_failed: "소셜 로그인에 실패했습니다. 다시 시도해 주세요.",
  invalid_state: "로그인 요청이 만료되었습니다. 다시 시도해 주세요.",
  cancelled: "소셜 로그인이 취소되었습니다.",
  inactive: "비활성화된 계정입니다. 관리자에게 문의하세요.",
};

const FLOATING = [
  { icon: "fa-carrot", cls: "top-[12%] left-[10%] text-tomato-400", delay: "0s" },
  { icon: "fa-apple-whole", cls: "top-[22%] right-[14%] text-rose-300", delay: "1.2s" },
  { icon: "fa-fish", cls: "bottom-[30%] left-[16%] text-sky-200", delay: "2.1s" },
  { icon: "fa-lemon", cls: "bottom-[18%] right-[10%] text-yellow-200", delay: "0.6s" },
  { icon: "fa-pepper-hot", cls: "top-[46%] right-[6%] text-red-300", delay: "1.8s" },
  { icon: "fa-egg", cls: "top-[60%] left-[6%] text-amber-100", delay: "2.6s" },
];

function useCountUp(target, ms = 1200) {
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

function HeroPanel() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const load = () => api("/api/public/stats").then(setStats).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  const saving = useCountUp(stats?.total_saving || 0);
  const deals = useCountUp(stats?.deals || 0);

  return (
    <section className="relative hidden overflow-hidden bg-gradient-to-br from-leaf-600 via-leaf-700 to-leaf-950 p-10 text-white md:flex md:w-1/2 md:flex-col lg:p-14">
      <div className="absolute -top-24 -right-24 size-96 rounded-full bg-leaf-400/30 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-tomato-500/25 blur-3xl" />
      {FLOATING.map((f) => (
        <i key={f.icon} className={`fa-solid ${f.icon} absolute animate-float text-4xl opacity-70 ${f.cls}`} style={{ animationDelay: f.delay }} />
      ))}

      <div className="relative my-auto max-w-lg animate-fade-up">
        <p className="chip bg-white/15 text-leaf-50"><span className="size-1.5 animate-pulse rounded-full bg-tomato-400" />실시간 마트 할인 수집 중</p>
        <h1 className="mt-4 text-4xl leading-tight lg:text-5xl">
          냉장고 속 재료와<br />오늘의 <span className="text-tomato-400">마감세일</span>로<br />건강한 한끼를.
        </h1>
        <p className="mt-4 text-leaf-100/90">RPA가 대형마트 할인가를 찾고, Gemini AI가 당뇨·다이어트·고혈압 맞춤 레시피를 창작합니다.</p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs text-leaf-100">오늘 할인 상품 합산 절약액</p>
            <p className="font-display mt-1 text-2xl text-tomato-300 lg:text-3xl">{won(saving)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs text-leaf-100">수집된 할인 식재료</p>
            <p className="font-display mt-1 text-2xl lg:text-3xl">{deals.toLocaleString()}<span className="text-base">개</span></p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs text-leaf-100">평균 할인율</p>
            <p className="font-display mt-1 text-2xl lg:text-3xl">{stats?.avg_discount ?? 0}%</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs text-leaf-100">마감세일 진행</p>
            <p className="font-display mt-1 text-2xl lg:text-3xl">{stats?.closing ?? 0}<span className="text-base">건</span></p>
          </div>
        </div>

        {stats?.top_deals?.length > 0 && (
          <ul className="mt-5 space-y-2">
            {stats.top_deals.slice(0, 3).map((d) => (
              <li key={d.name + d.mart} className="flex items-center justify-between rounded-xl bg-black/15 px-4 py-2 text-sm">
                <span className="truncate"><i className="fa-solid fa-fire mr-2 text-tomato-400" />{d.name} <span className="text-leaf-200">· {d.mart}</span></span>
                <span className="shrink-0 font-bold text-tomato-300">-{d.discount_rate}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function Login() {
  const { user, login, register } = useAuth();
  const { toast } = useRealtime();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "register" ? "register" : "login");
  const [form, setForm] = useState({ email: "", password: "", name: "", health_type: "general" });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(OAUTH_ERRORS[params.get("error")] || "");
  const [providers, setProviders] = useState({});

  useEffect(() => {
    api("/api/auth/providers").then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    setMode(params.get("mode") === "register" ? "register" : "login");
    setError("");
  }, [params]);

  if (user && !busy) return <Navigate to={location.state?.from || "/dashboard"} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const checks = passwordChecks(form.password);
  const pwValid = PASSWORD_RULE.test(form.password);

  const submit = async (e, creds) => {
    e?.preventDefault();
    setError("");
    const { email, password } = creds || form;
    if (!creds && mode === "register" && !pwValid) return setError("비밀번호 규칙을 확인해 주세요.");
    setBusy(creds ? creds.kind : "form");
    try {
      const u = mode === "register" && !creds ? await register(form) : await login(email, password);
      toast({ title: `${u.name}님, 환영합니다!`, message: u.role === "admin" ? "관리자 권한으로 로그인했습니다." : "오늘의 할인 식재료를 확인해 보세요.", tone: "success", icon: "fa-leaf" });
      navigate(u.role === "admin" && creds?.kind === "admin" ? "/admin" : location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  const testLogin = async (kind) => {
    const acc = TEST_ACCOUNTS[kind];
    setMode("login");
    setForm((f) => ({ ...f, email: "", password: "" }));
    for (let i = 1; i <= acc.email.length; i += 2) {
      setForm((f) => ({ ...f, email: acc.email.slice(0, i) }));
      await new Promise((r) => setTimeout(r, 12));
    }
    setForm((f) => ({ ...f, email: acc.email, password: acc.password }));
    await submit(null, { ...acc, kind });
  };

  const social = (p) => {
    if (!providers[p]) {
      toast({ title: "소셜 로그인 준비 중", message: `${p} OAuth 클라이언트가 서버에 설정되지 않았습니다. (.env 의 ${p.toUpperCase()}_CLIENT_ID)`, tone: "error" });
      return;
    }
    window.location.href = oauthLoginUrl(p);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <div className="flex flex-1">
      <HeroPanel />
      <section className="relative flex w-full flex-col md:w-1/2">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-leaf-600 to-leaf-700 p-4 text-white md:hidden">
            <p className="text-xs opacity-80">오늘의 마감세일로 냉장고 파먹기</p>
            <p className="font-display text-lg">AI가 건강 맞춤 레시피를 창작해 드려요 🥗</p>
          </div>

          <h2 className="text-3xl text-leaf-900 dark:text-leaf-100">{mode === "login" ? "다시 만나서 반가워요" : "RecipePick 시작하기"}</h2>
          <p className="mt-1 text-sm text-slate-500">{mode === "login" ? "로그인하고 오늘의 할인 식재료를 확인하세요." : "건강 상태에 맞는 레시피를 추천받으세요."}</p>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button onClick={() => testLogin("user")} disabled={!!busy} className="btn border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
              {busy === "user" ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-user" />}
              <span className="text-left leading-tight">일반 회원<br /><span className="text-[11px] font-normal opacity-80">테스트 로그인 (당뇨)</span></span>
            </button>
            <button onClick={() => testLogin("admin")} disabled={!!busy} className="btn border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {busy === "admin" ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-user-shield" />}
              <span className="text-left leading-tight">시스템 관리자<br /><span className="text-[11px] font-normal opacity-80">테스트 로그인</span></span>
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-ink-line" />또는 이메일로<span className="h-px flex-1 bg-slate-200 dark:bg-ink-line" /></div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === "register" && (
              <>
                <div>
                  <label className="label" htmlFor="name">이름</label>
                  <input id="name" className="input" value={form.name} onChange={set("name")} placeholder="홍길동" required />
                </div>
                <div>
                  <label className="label">건강 관리 목표</label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {Object.entries(HEALTH_LABELS).map(([k, h]) => (
                      <button type="button" key={k} onClick={() => setForm((f) => ({ ...f, health_type: k }))}
                        className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${form.health_type === k ? "border-leaf-500 bg-leaf-50 text-leaf-800 ring-2 ring-leaf-500/20 dark:bg-leaf-950/50 dark:text-leaf-200" : "border-slate-200 text-slate-500 dark:border-ink-line"}`}>
                        <i className={`fa-solid ${h.icon} mb-1 block text-base`} />{h.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="label" htmlFor="email">이메일</label>
              <div className="relative">
                <i className="fa-regular fa-envelope absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
                <input id="email" type="email" autoComplete="email" className="input pl-10" value={form.email} onChange={set("email")} placeholder="you@example.com" required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="password">비밀번호</label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
                <input id="password" type={showPw ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} className="input px-10" value={form.password} onChange={set("password")} placeholder="영문 대·소문자, 숫자, 특수문자 8자 이상" required />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="비밀번호 표시">
                  <i className={`fa-regular ${showPw ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>
              {(mode === "register" || form.password) && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {checks.map((c) => (
                    <li key={c.label} className={`chip transition ${c.ok ? "bg-leaf-100 text-leaf-800 dark:bg-leaf-900/50 dark:text-leaf-200" : "bg-slate-100 text-slate-500 dark:bg-ink-line"}`}>
                      <i className={`fa-solid ${c.ok ? "fa-check" : "fa-circle text-[6px]"}`} />{c.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {error && <p className="animate-pop rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"><i className="fa-solid fa-circle-exclamation mr-1" />{error}</p>}
            <button type="submit" disabled={!!busy || (mode === "register" && !pwValid)} className="btn-primary w-full py-3">
              {busy === "form" && <i className="fa-solid fa-spinner fa-spin" />}
              {mode === "login" ? "로그인" : "회원가입"}
            </button>
          </form>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <button onClick={() => social("google")} className="btn border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-ink-line dark:bg-ink-soft dark:text-slate-200" aria-label="구글 로그인">
              <i className="fa-brands fa-google text-[#ea4335]" /><span className="hidden sm:inline">Google</span>
            </button>
            <button onClick={() => social("naver")} className="btn bg-[#03c75a] text-white hover:brightness-95" aria-label="네이버 로그인">
              <span className="font-black">N</span><span className="hidden sm:inline">네이버</span>
            </button>
            <button onClick={() => social("kakao")} className="btn bg-[#fee500] text-[#191919] hover:brightness-95" aria-label="카카오 로그인">
              <i className="fa-solid fa-comment" /><span className="hidden sm:inline">카카오</span>
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "login" ? "아직 회원이 아니신가요?" : "이미 계정이 있으신가요?"}{" "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="font-semibold text-leaf-700 hover:underline dark:text-leaf-300">
              {mode === "login" ? "회원가입" : "로그인"}
            </button>
          </p>
        </div>
      </section>
      </div>
      <Footer compact />
    </div>
  );
}

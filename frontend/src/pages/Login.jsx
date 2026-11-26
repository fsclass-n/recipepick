import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { api, HEALTH_LABELS, oauthLoginUrl, PASSWORD_RULE, passwordChecks, won } from "../lib/api";
import { IMG, unsplash } from "../lib/images";

const TEST_USER = { email: "user@recipepick.dev", password: "Recipe!2026" };

const OAUTH_ERRORS = {
  oauth_failed: "소셜 로그인에 실패했습니다. 다시 시도해 주세요.",
  invalid_state: "로그인 요청이 만료되었습니다. 다시 시도해 주세요.",
  cancelled: "소셜 로그인이 취소되었습니다.",
  inactive: "비활성화된 계정입니다. 관리자에게 문의하세요.",
};

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

function VisualPanel() {
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
    <section className="relative isolate hidden min-h-[640px] flex-col justify-end overflow-hidden rounded-[2rem] p-10 text-white lg:flex">
      <img src={unsplash(IMG.eggBowl, 1100, 1400)} alt="" className="absolute inset-0 -z-10 size-full animate-ken-burns object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-leaf-950/95 via-leaf-950/50 to-leaf-950/10" />
      <p className="serif-en text-lg text-tomato-300">Welcome to the Rescue Kitchen</p>
      <h1 className="mt-3 text-4xl leading-tight xl:text-5xl">냉장고 속 재료와<br />오늘의 마감세일로<br />건강한 한 끼를.</h1>
      <p className="mt-4 max-w-md text-white/75">RPA가 대형마트 할인가를 찾고, Gemini AI가 당뇨·다이어트·고혈압 맞춤 레시피를 창작합니다.</p>
      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/15 backdrop-blur">
        {[
          ["할인 합산 절약액", won(saving)],
          ["수집된 할인 식재료", `${deals.toLocaleString()}개`],
          ["평균 할인율", `${stats?.avg_discount ?? 0}%`],
          ["마감세일 진행", `${stats?.closing ?? 0}건`],
        ].map(([k, v]) => (
          <div key={k} className="bg-black/20 p-4">
            <dt className="text-[11px] text-white/60">{k}</dt>
            <dd className="mt-1 font-display text-2xl">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Divider({ children }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
      <span className="h-px flex-1 bg-stone-200 dark:bg-ink-line" />{children}<span className="h-px flex-1 bg-stone-200 dark:bg-ink-line" />
    </div>
  );
}

export default function Login() {
  const { user, login, register, loginAsTestAdmin, loginWithAdminKey } = useAuth();
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
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminKey, setAdminKey] = useState("");

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

  const run = async (kind, action, { to, message }) => {
    setError("");
    setBusy(kind);
    try {
      const u = await action();
      toast({ title: `${u.name}님, 환영합니다!`, message: message(u), tone: "success", icon: "fa-leaf" });
      navigate(to(u), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  const submit = (e) => {
    e?.preventDefault();
    if (mode === "register" && !pwValid) return setError("비밀번호 규칙을 확인해 주세요.");
    run("form", () => (mode === "register" ? register(form) : login(form.email, form.password)), {
      to: () => location.state?.from || "/dashboard",
      message: (u) => (u.role === "admin" ? "관리자 계정으로 로그인했습니다." : "오늘의 할인 식재료를 확인해 보세요."),
    });
  };

  const testUserLogin = async () => {
    setMode("login");
    setForm((f) => ({ ...f, email: "", password: "" }));
    for (let i = 1; i <= TEST_USER.email.length; i += 2) {
      setForm((f) => ({ ...f, email: TEST_USER.email.slice(0, i) }));
      await new Promise((r) => setTimeout(r, 12));
    }
    setForm((f) => ({ ...f, ...TEST_USER }));
    run("user", () => login(TEST_USER.email, TEST_USER.password), {
      to: () => location.state?.from || "/dashboard",
      message: () => "테스트 회원(당뇨 관리)으로 체험 중입니다.",
    });
  };

  const testAdminLogin = () =>
    run("test-admin", loginAsTestAdmin, { to: () => "/admin", message: () => "테스트 관리자 · 읽기 전용 모드입니다. 데이터 변경은 차단됩니다." });

  const adminKeyLogin = (e) => {
    e.preventDefault();
    if (!adminKey.trim()) return setError("관리자 키를 입력해 주세요.");
    run("admin-key", () => loginWithAdminKey(adminKey.trim()), { to: () => "/admin", message: () => "실제 관리자 권한(전체 CRUD)으로 로그인했습니다." });
  };

  const social = (p) => {
    if (!providers[p]) {
      toast({ title: "소셜 로그인 준비 중", message: `${p} OAuth 클라이언트가 서버에 설정되지 않았습니다. (.env 의 ${p.toUpperCase()}_CLIENT_ID)`, tone: "error" });
      return;
    }
    window.location.href = oauthLoginUrl(p);
  };

  const spinner = (kind, icon) => <i className={`fa-solid ${busy === kind ? "fa-spinner fa-spin" : icon}`} />;

  return (
    <div className="container-x grid gap-10 py-10 sm:py-14 lg:grid-cols-2 lg:gap-16">
      <VisualPanel />
      <section className="mx-auto flex w-full max-w-md flex-col justify-center">
        <p className="eyebrow">{mode === "login" ? "Sign in" : "Join RecipePick"}</p>
        <h2 className="mt-3 text-4xl text-leaf-950 dark:text-stone-50">{mode === "login" ? "다시 만나서 반가워요" : "레스큐 키친 시작하기"}</h2>
        <p className="mt-3 text-sm text-stone-500">{mode === "login" ? "로그인하고 오늘의 할인 식재료를 확인하세요." : "건강 목표를 고르면 맞춤 식단 룩북이 열려요."}</p>

        <div className="mt-8 grid grid-cols-2 gap-2">
          <button onClick={testUserLogin} disabled={!!busy} className="flex items-center gap-3 rounded-2xl border border-stone-200 p-3.5 text-left transition hover:border-leaf-700 hover:bg-white disabled:opacity-50 dark:border-ink-line dark:hover:bg-ink-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">{spinner("user", "fa-user")}</span>
            <span className="leading-tight"><b className="block text-sm">일반 회원 체험</b><span className="text-[11px] text-stone-500">테스트 계정 (당뇨)</span></span>
          </button>
          <button onClick={testAdminLogin} disabled={!!busy} className="flex items-center gap-3 rounded-2xl border border-stone-200 p-3.5 text-left transition hover:border-amber-600 hover:bg-white disabled:opacity-50 dark:border-ink-line dark:hover:bg-ink-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{spinner("test-admin", "fa-user-shield")}</span>
            <span className="leading-tight"><b className="block text-sm">테스트 관리자</b><span className="text-[11px] text-stone-500"><i className="fa-solid fa-eye mr-1" />읽기 전용</span></span>
          </button>
        </div>

        <Divider>또는 이메일로</Divider>

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
                      className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${form.health_type === k ? "border-leaf-700 bg-leaf-50 text-leaf-900 ring-2 ring-leaf-700/15 dark:bg-leaf-950/50 dark:text-leaf-200" : "border-stone-200 text-stone-500 hover:border-stone-400 dark:border-ink-line"}`}>
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
              <i className="fa-regular fa-envelope absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400" />
              <input id="email" type="email" autoComplete="email" className="input pl-10" value={form.email} onChange={set("email")} placeholder="you@example.com" required />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="password">비밀번호</label>
            <div className="relative">
              <i className="fa-solid fa-lock absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400" />
              <input id="password" type={showPw ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} className="input px-10" value={form.password} onChange={set("password")} placeholder="영문 대·소문자, 숫자, 특수문자 8자 이상" required />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute top-1/2 right-3 -translate-y-1/2 text-stone-400 hover:text-stone-600" aria-label="비밀번호 표시">
                <i className={`fa-regular ${showPw ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>
            {(mode === "register" || form.password) && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {checks.map((c) => (
                  <li key={c.label} className={`chip transition ${c.ok ? "bg-leaf-100 text-leaf-800 dark:bg-leaf-900/50 dark:text-leaf-200" : "bg-stone-100 text-stone-500 dark:bg-ink-line"}`}>
                    <i className={`fa-solid ${c.ok ? "fa-check" : "fa-circle text-[6px]"}`} />{c.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && <p className="animate-pop rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"><i className="fa-solid fa-circle-exclamation mr-1" />{error}</p>}
          <button type="submit" disabled={!!busy || (mode === "register" && !pwValid)} className="btn-primary w-full py-3.5">
            {busy === "form" && <i className="fa-solid fa-spinner fa-spin" />}
            {mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={() => social("google")} className="btn border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-ink-line dark:bg-ink-soft dark:text-stone-200" aria-label="구글 로그인">
            <i className="fa-brands fa-google text-[#ea4335]" /><span className="hidden sm:inline">Google</span>
          </button>
          <button onClick={() => social("naver")} className="btn bg-[#03c75a] text-white hover:brightness-95" aria-label="네이버 로그인">
            <span className="font-black">N</span><span className="hidden sm:inline">네이버</span>
          </button>
          <button onClick={() => social("kakao")} className="btn bg-[#fee500] text-[#191919] hover:brightness-95" aria-label="카카오 로그인">
            <i className="fa-solid fa-comment" /><span className="hidden sm:inline">카카오</span>
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-stone-500">
          {mode === "login" ? "아직 회원이 아니신가요?" : "이미 계정이 있으신가요?"}{" "}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="font-semibold text-leaf-800 underline-offset-4 hover:underline dark:text-leaf-300">
            {mode === "login" ? "회원가입" : "로그인"}
          </button>
        </p>

        <div className="mt-8 rounded-2xl border border-dashed border-stone-300 dark:border-ink-line">
          <button onClick={() => setAdminOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-stone-500" aria-expanded={adminOpen}>
            <span><i className="fa-solid fa-key mr-2" />관리자 키로 로그인 (운영자 전용)</span>
            <i className={`fa-solid fa-chevron-down transition ${adminOpen ? "rotate-180" : ""}`} />
          </button>
          {adminOpen && (
            <form onSubmit={adminKeyLogin} className="animate-fade-up space-y-2 px-4 pb-4">
              <input type="password" autoComplete="off" className="input" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="서버 .env 의 ADMIN_ACCESS_KEY" aria-label="관리자 키" />
              <button type="submit" disabled={!!busy} className="btn w-full bg-stone-900 text-white hover:bg-black dark:bg-stone-100 dark:text-stone-900">
                {spinner("admin-key", "fa-unlock-keyhole")}관리자 로그인 · 전체 권한
              </button>
              <p className="text-[11px] leading-relaxed text-stone-400">실제 관리자는 서버 환경 변수에 등록된 키로만 진입하며 모든 데이터의 생성·수정·삭제 권한을 가집니다.</p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

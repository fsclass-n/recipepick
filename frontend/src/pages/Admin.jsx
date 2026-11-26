import { useCallback, useEffect, useState } from "react";
import PlotlyChart from "../components/PlotlyChart";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import PageHero from "../components/PageHero";
import { api, HEALTH_LABELS, timeAgo, won } from "../lib/api";
import { IMG } from "../lib/images";

const STATUS = {
  running: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  success: "bg-leaf-100 text-leaf-800 dark:bg-leaf-900/50 dark:text-leaf-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${checked ? "bg-leaf-600" : "bg-stone-300 dark:bg-ink-line"}`}>
      <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

function CrawlerTab() {
  const { readOnly } = useAuth();
  const { toast, crawlStatus, setCrawlStatus, subscribe } = useRealtime();
  const [overview, setOverview] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [deals, setDeals] = useState([]);
  const [openJob, setOpenJob] = useState(null);

  const loadAll = useCallback(() => {
    api("/api/admin/overview").then(setOverview).catch(() => {});
    api("/api/admin/crawler/jobs").then(setJobs).catch(() => {});
    api("/api/admin/crawler/stats").then(setStats).catch(() => {});
    api("/api/deals?sort=recent&limit=20").then(setDeals).catch(() => {});
    api("/api/admin/crawler").then(setCrawlStatus).catch(() => {});
  }, [setCrawlStatus]);

  useEffect(() => {
    loadAll();
    return subscribe((msg) => {
      if (msg.type !== "crawl_status") return;
      if (msg.data.event === "started") api("/api/admin/crawler/jobs").then(setJobs);
      if (msg.data.event === "finished") {
        loadAll();
        toast({ title: "크롤링 완료", message: `작업 #${msg.data.job_id} · ${msg.data.job_status}`, tone: msg.data.job_status === "failed" ? "error" : "success", icon: "fa-robot" });
      }
    });
  }, [loadAll, subscribe, toast]);

  const s = crawlStatus || {};
  const patch = async (body) => {
    try {
      setCrawlStatus(await api("/api/admin/crawler", { method: "PATCH", body }));
    } catch (e) {
      toast({ title: "설정 변경 실패", message: e.message, tone: "error" });
    }
  };
  const runNow = async () => {
    try {
      await api("/api/admin/crawler/run", { method: "POST" });
      setCrawlStatus({ ...s, running: true });
      toast({ title: "크롤링 시작", message: "Playwright 크롤러가 실행되었습니다.", icon: "fa-robot" });
    } catch (e) {
      toast({ title: "실행 불가", message: e.message, tone: "error" });
    }
  };

  const cards = [
    ["fa-users", "전체 회원", overview?.users, `관리자 ${overview?.admins ?? 0}명`],
    ["fa-signal", "실시간 접속", overview?.online_users, "WebSocket 연결"],
    ["fa-tags", "수집 할인 상품", overview?.deals, `평균 ${stats?.summary?.avg_discount ?? 0}% 할인`],
    ["fa-robot", "크롤링 작업", overview?.jobs, `성공률 ${stats?.summary?.success_rate ?? 0}%`],
    ["fa-bowl-food", "생성 레시피", overview?.recipes, `알림 ${overview?.notifications ?? 0}건`],
    ["fa-database", "데이터베이스", overview?.database?.toUpperCase(), overview?.database_failover ? "RDS 중지 → TiDB 자동 전환 중" : ({ tidb: "TiDB Cloud 연결", mysql: `AWS RDS · MySQL ${overview?.database_version || ""}`, sqlite: "로컬 SQLite", unavailable: "DB 연결 불가" })[overview?.database] || "-"],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(([icon, label, value, sub]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-stone-500"><i className={`fa-solid ${icon} mr-1.5 text-leaf-600`} />{label}</p>
            <p className="font-display mt-1 text-2xl">{value ?? "-"}</p>
            <p className="truncate text-xs text-stone-400">{sub}</p>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className={`grid size-12 place-items-center rounded-2xl ${s.running ? "bg-sky-500 text-white" : "bg-leaf-100 text-leaf-700 dark:bg-leaf-900/50 dark:text-leaf-300"}`}>
              <i className={`fa-solid fa-robot text-xl ${s.running ? "fa-bounce" : ""}`} />
            </span>
            <div>
              <h2 className="text-xl">Playwright RPA 크롤러</h2>
              <p className="text-sm text-stone-500">
                {s.running ? <span className="font-semibold text-sky-600">수집 중... (작업 #{s.current_job_id})</span> : s.enabled ? `다음 실행: ${s.next_run_at ? new Date(s.next_run_at).toLocaleTimeString("ko-KR") : "-"}` : "자동 실행 일시정지"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">자동 실행 <Toggle checked={!!s.enabled} disabled={readOnly} onChange={(v) => patch({ enabled: v })} label="자동 실행" /></label>
            <select disabled={readOnly} className="input w-auto disabled:opacity-50" value={s.interval_minutes || 60} onChange={(e) => patch({ interval_minutes: Number(e.target.value) })} aria-label="크롤링 주기">
              {[5, 15, 30, 60, 180, 360, 720, 1440].map((m) => <option key={m} value={m}>{m < 60 ? `${m}분` : `${m / 60}시간`}마다</option>)}
            </select>
            <select disabled={readOnly} className="input w-auto disabled:opacity-50" value={s.mode || "auto"} onChange={(e) => patch({ mode: e.target.value })} aria-label="수집 모드">
              <option value="auto">AUTO (실패 시 데모)</option>
              <option value="live">LIVE (실제 사이트)</option>
              <option value="demo">DEMO (시뮬레이션)</option>
            </select>
            <button onClick={runNow} disabled={s.running || readOnly} title={readOnly ? "읽기 전용 모드에서는 실행할 수 없습니다" : undefined} className="btn-accent">
              <i className={`fa-solid ${s.running ? "fa-spinner fa-spin" : "fa-play"}`} />지금 실행
            </button>
          </div>
        </div>
      </section>

      {stats && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(stats.figures).map(([k, fig]) => (
            <div key={k} className={`card p-3 ${k === "jobs_timeline" ? "lg:col-span-2" : ""}`}><PlotlyChart figure={fig} height={300} /></div>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h3 className="mb-3 text-lg">작업 로그</h3>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {jobs.map((j) => (
              <li key={j.id} className="rounded-xl border border-stone-100 dark:border-ink-line">
                <button onClick={() => setOpenJob(openJob === j.id ? null : j.id)} className="flex w-full items-center gap-3 p-3 text-left text-sm">
                  <span className={`chip ${STATUS[j.status]}`}>{j.status}</span>
                  <span className="font-semibold">#{j.id}</span>
                  <span className="hidden text-stone-500 sm:inline">{j.trigger} · {j.mode}</span>
                  <span className="ml-auto text-xs text-stone-400">{j.items_collected}건 · 매칭 {j.matches} · {timeAgo(j.started_at)}</span>
                  <i className={`fa-solid fa-chevron-down text-xs text-stone-400 transition ${openJob === j.id ? "rotate-180" : ""}`} />
                </button>
                {openJob === j.id && (
                  <pre className="max-h-60 overflow-auto rounded-b-xl bg-ink px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap text-leaf-200">{j.log || "(로그 없음)"}</pre>
                )}
              </li>
            ))}
            {jobs.length === 0 && <li className="py-8 text-center text-sm text-stone-400">아직 실행된 작업이 없습니다.</li>}
          </ul>
        </section>

        <section className="card p-5">
          <h3 className="mb-3 text-lg">최근 수집 데이터</h3>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs text-stone-500 dark:bg-ink-soft">
                <tr><th className="py-2">마트</th><th>상품</th><th className="text-right">할인가</th><th className="text-right">할인율</th></tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-t border-stone-100 dark:border-ink-line">
                    <td className="py-2 whitespace-nowrap">{d.mart}</td>
                    <td className="max-w-48 truncate">{d.is_closing_sale && <i className="fa-solid fa-clock mr-1 text-tomato-500" />}{d.name}</td>
                    <td className="text-right whitespace-nowrap">{won(d.sale_price)}</td>
                    <td className="text-right font-semibold text-tomato-600">{d.discount_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function UsersTab() {
  const { user: me, readOnly } = useAuth();
  const { toast } = useRealtime();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => api(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setUsers).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  const update = async (u, body) => {
    try {
      const updated = await api(`/api/admin/users/${u.id}`, { method: "PATCH", body });
      setUsers((list) => list.map((x) => (x.id === u.id ? updated : x)));
      toast({ title: "회원 정보 변경", message: `${updated.name} → ${updated.role === "admin" ? "관리자" : "일반 사용자"} · ${HEALTH_LABELS[updated.health_type]?.label}`, tone: "success", icon: "fa-user-shield" });
    } catch (e) {
      toast({ title: "변경 실패", message: e.message, tone: "error" });
    }
  };

  const protectedUser = (u) => u.id === me.id || ["user@recipepick.dev", "admin@recipepick.dev"].includes(u.email);
  const kick = async (u) => {
    if (!window.confirm(`${u.name}(${u.email}) 회원을 강퇴할까요?
냉장고·레시피·알림 데이터가 함께 삭제되며 복구할 수 없습니다.`)) return;
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      setUsers((list) => list.filter((x) => x.id !== u.id));
      toast({ title: "강퇴 완료", message: `${u.name} 회원과 관련 데이터를 삭제했습니다.`, tone: "success", icon: "fa-user-slash" });
    } catch (e) {
      toast({ title: "강퇴 실패", message: e.message, tone: "error" });
    }
  };
  const KickButton = ({ u }) => (
    <button onClick={() => kick(u)} disabled={readOnly || protectedUser(u)}
      title={readOnly ? "읽기 전용 모드" : protectedUser(u) ? "본인·데모 테스트 계정은 강퇴할 수 없습니다" : "강퇴"}
      className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">
      <i className="fa-solid fa-user-slash" />강퇴
    </button>
  );

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl">회원 권한 · 건강 프로필 관리 <span className="text-sm text-stone-400">{users.length}명</span></h2>
        <div className="relative sm:w-72">
          <i className="fa-solid fa-magnifying-glass absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400" />
          <input className="input pl-10" placeholder="이름 또는 이메일 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-stone-500">
            <tr><th className="py-2">회원</th><th>가입</th><th>건강 타입</th><th>최근 로그인</th><th className="text-center">관리자</th><th className="text-center">활성</th><th className="text-center">강퇴</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-stone-100 dark:border-ink-line">
                <td className="py-3">
                  <p className="font-semibold">{u.name} {u.id === me.id && <span className="chip bg-leaf-100 text-leaf-700 dark:bg-leaf-900/50 dark:text-leaf-200">나</span>}</p>
                  <p className="text-xs text-stone-400">{u.email}</p>
                </td>
                <td className="text-xs text-stone-500">{u.provider}<br />{new Date(u.created_at).toLocaleDateString("ko-KR")}</td>
                <td>
                  <select disabled={readOnly} className="input w-auto py-1.5 text-xs disabled:opacity-50" value={u.health_type} onChange={(e) => update(u, { health_type: e.target.value })}>
                    {Object.entries(HEALTH_LABELS).map(([k, h]) => <option key={k} value={k}>{h.label}</option>)}
                  </select>
                </td>
                <td className="text-xs text-stone-500">{u.last_login_at ? timeAgo(u.last_login_at) : "-"}</td>
                <td className="text-center"><Toggle checked={u.role === "admin"} disabled={readOnly || u.id === me.id} onChange={(v) => update(u, { role: v ? "admin" : "user" })} label="관리자 권한" /></td>
                <td className="text-center"><Toggle checked={u.is_active} disabled={readOnly || u.id === me.id} onChange={(v) => update(u, { is_active: v })} label="활성 상태" /></td>
                <td className="text-center"><KickButton u={u} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {users.map((u) => (
          <li key={u.id} className="rounded-xl border border-stone-100 p-4 dark:border-ink-line">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{u.name}</p>
                <p className="truncate text-xs text-stone-400">{u.email} · {u.provider}</p>
              </div>
              <span className={`chip ${u.role === "admin" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>{u.role === "admin" ? "관리자" : "일반"}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <select disabled={readOnly} className="input flex-1 py-1.5 text-xs disabled:opacity-50" value={u.health_type} onChange={(e) => update(u, { health_type: e.target.value })}>
                {Object.entries(HEALTH_LABELS).map(([k, h]) => <option key={k} value={k}>{h.label}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs">관리자<Toggle checked={u.role === "admin"} disabled={readOnly || u.id === me.id} onChange={(v) => update(u, { role: v ? "admin" : "user" })} label="관리자 권한" /></label>
              <KickButton u={u} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Admin() {
  const { readOnly } = useAuth();
  const [tab, setTab] = useState("crawler");
  return (
    <div className="space-y-6">
      <PageHero
        image={IMG.market}
        eyebrow={readOnly ? "Admin Console · Read-Only" : "Admin Console"}
        title="관리자 대시보드"
        desc="RPA 크롤러 모니터링과 회원 권한·건강 프로필을 관리합니다."
      >
        <div className="inline-flex rounded-full bg-white/15 p-1 backdrop-blur">
          {[["crawler", "fa-robot", "RPA 크롤러"], ["users", "fa-users-gear", "회원 관리"]].map(([k, icon, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === k ? "bg-white text-leaf-900 shadow" : "text-white/80 hover:text-white"}`}>
              <i className={`fa-solid ${icon}`} />{label}
            </button>
          ))}
        </div>
      </PageHero>
      {readOnly && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200" role="status">
          <i className="fa-solid fa-eye mt-0.5" />
          <p><b>테스트 관리자 · 읽기 전용 모드</b> — 모든 관리자 화면을 열람할 수 있지만 크롤러 실행·설정 변경, 회원 권한·프로필 수정 등 데이터 변경 요청은 서버에서 차단됩니다. 전체 권한은 로그인 화면의 <b>관리자 키 로그인</b>으로 진입하세요.</p>
        </div>
      )}
      {tab === "crawler" ? <CrawlerTab /> : <UsersTab />}
    </div>
  );
}

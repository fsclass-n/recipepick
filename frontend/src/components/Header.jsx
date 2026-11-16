import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { useTheme } from "../context/ThemeContext";
import { HEALTH_LABELS, timeAgo } from "../lib/api";
import Hamburger from "./Hamburger";
import Logo from "./Logo";

const NAV = [
  { to: "/dashboard", label: "대시보드", icon: "fa-house" },
  { to: "/fridge", label: "냉장고 파먹기", icon: "fa-snowflake" },
  { to: "/deals", label: "마트 할인", icon: "fa-tags" },
  { to: "/recipe", label: "AI 레시피", icon: "fa-wand-magic-sparkles" },
  { to: "/profile", label: "건강 프로필", icon: "fa-user-doctor" },
];

function ThemeButton() {
  const { dark, toggle } = useTheme();
  return (
    <button onClick={toggle} className="grid size-10 place-items-center rounded-xl text-slate-600 transition hover:bg-leaf-50 dark:text-slate-300 dark:hover:bg-ink-line" aria-label="테마 전환">
      <i className={`fa-solid ${dark ? "fa-sun text-amber-300" : "fa-moon"} transition-transform duration-500 ${dark ? "rotate-180" : ""}`} />
    </button>
  );
}

function Bell() {
  const { notifications, unread, markAllRead, connected } = useRealtime();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative grid size-10 place-items-center rounded-xl text-slate-600 transition hover:bg-leaf-50 dark:text-slate-300 dark:hover:bg-ink-line" aria-label="알림">
        <i className={`fa-solid fa-bell ${unread ? "text-tomato-500" : ""}`} />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-tomato-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
        <span className={`absolute bottom-1.5 right-2 size-1.5 rounded-full ${connected ? "bg-leaf-500" : "bg-slate-400"}`} title={connected ? "실시간 연결됨" : "연결 끊김"} />
      </button>
      {open && (
        <div className="card absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-pop overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-leaf-100 px-4 py-3 dark:border-ink-line">
            <p className="font-display text-base">실시간 알림</p>
            <button onClick={markAllRead} className="text-xs font-semibold text-leaf-700 hover:underline dark:text-leaf-300">모두 읽음</button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">아직 알림이 없어요</li>}
            {notifications.slice(0, 15).map((n) => (
              <li key={n.id} className={`border-b border-leaf-50 px-4 py-3 text-sm last:border-0 dark:border-ink-line ${n.is_read ? "opacity-60" : ""}`}>
                <p className="font-semibold text-tomato-600 dark:text-tomato-400"><i className="fa-solid fa-tags mr-1" />{n.title}</p>
                <p className="mt-0.5 text-slate-600 dark:text-slate-300">{n.message}</p>
                <p className="mt-1 text-xs text-slate-400">{timeAgo(n.created_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const items = isAdmin ? [...NAV, { to: "/admin", label: "관리자", icon: "fa-user-shield" }] : NAV;
  const health = HEALTH_LABELS[user?.health_type] || HEALTH_LABELS.general;

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const doLogout = () => {
    logout();
    navigate("/login");
  };

  const linkCls = ({ isActive }) =>
    `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
      isActive ? "bg-leaf-600 text-white shadow-sm shadow-leaf-600/30" : "text-slate-600 hover:bg-leaf-50 hover:text-leaf-800 dark:text-slate-300 dark:hover:bg-ink-line"
    }`;

  return (
    <>
      <header className={`sticky top-0 z-40 border-b transition-all ${scrolled ? "border-leaf-100 bg-white/85 shadow-sm backdrop-blur-lg dark:border-ink-line dark:bg-ink/85" : "border-transparent bg-cream/60 dark:bg-ink/60"}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/dashboard" className="shrink-0" aria-label="대시보드"><Logo /></Link>
          <nav className="ml-6 hidden flex-1 items-center gap-1 lg:flex">
            {items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/dashboard"} className={linkCls}>
                <i className={`fa-solid ${n.icon} text-xs`} />{n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeButton />
            <Bell />
            <div className="ml-2 hidden items-center gap-2 lg:flex">
              <span className={`chip ${health.color}`}><i className={`fa-solid ${health.icon}`} />{health.label}</span>
              <span className="max-w-32 truncate text-sm font-semibold">{user?.name}</span>
              <button onClick={doLogout} className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" aria-label="로그아웃">
                <i className="fa-solid fa-right-from-bracket" />
              </button>
            </div>
            <button
              onClick={() => setOpen((o) => !o)}
              className="relative z-[60] grid size-10 place-items-center rounded-xl hover:bg-leaf-50 lg:hidden dark:hover:bg-ink-line"
              aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={open}
            >
              <Hamburger open={open} />
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setOpen(false)} />
      <aside
        className={`fixed top-0 right-0 z-[55] flex h-dvh w-[82%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden dark:bg-ink-soft ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-4 grid size-10 place-items-center rounded-xl text-white hover:bg-white/15"
          aria-label="메뉴 닫기"
          tabIndex={open ? 0 : -1}
        >
          <span className="relative block h-4 w-5">
            <span className={`absolute top-1.5 left-0 h-0.5 w-5 rounded bg-current transition-all delay-100 duration-300 ${open ? "rotate-45" : ""}`} />
            <span className={`absolute top-1.5 left-0 h-0.5 w-5 rounded bg-current transition-all delay-100 duration-300 ${open ? "-rotate-45" : ""}`} />
          </span>
        </button>
        <div className="bg-gradient-to-br from-leaf-600 to-leaf-800 px-6 pt-20 pb-6 text-white">
          <p className="text-xs opacity-80">안녕하세요 👋</p>
          <p className="font-display text-2xl">{user?.name}</p>
          <span className="chip mt-2 bg-white/20 text-white"><i className={`fa-solid ${health.icon}`} />{health.label}</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {items.map((n, i) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/dashboard"}
              className={({ isActive }) => `${linkCls({ isActive })} py-3 text-base ${open ? "animate-fade-up" : ""}`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <i className={`fa-solid ${n.icon} w-5 text-center`} />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-leaf-100 p-4 dark:border-ink-line">
          <button onClick={doLogout} className="btn-ghost w-full"><i className="fa-solid fa-right-from-bracket" />로그아웃</button>
        </div>
      </aside>
    </>
  );
}

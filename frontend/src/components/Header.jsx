import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { useTheme } from "../context/ThemeContext";
import { api, HEALTH_LABELS, timeAgo } from "../lib/api";
import Hamburger from "./Hamburger";
import Logo from "./Logo";

export const NAV = [
  { to: "/#lookbook", label: "식단 룩북", en: "Lookbook", icon: "fa-book-open" },
  { to: "/deals", label: "마감세일", en: "Deals", icon: "fa-tags" },
  { to: "/fridge", label: "냉장고 파먹기", en: "Fridge", icon: "fa-snowflake" },
  { to: "/recipe", label: "AI 레시피", en: "AI Recipe", icon: "fa-wand-magic-sparkles" },
  { to: "/dashboard", label: "마이 키친", en: "My Kitchen", icon: "fa-house" },
];

const iconBtn = "relative grid size-10 place-items-center rounded-full text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-ink-line";

function useOutside(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && onClose();
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);
  return ref;
}

function ThemeButton() {
  const { dark, toggle } = useTheme();
  return (
    <button onClick={toggle} className={iconBtn} aria-label="테마 전환">
      <i className={`fa-solid ${dark ? "fa-sun text-amber-300" : "fa-moon"} transition-transform duration-500 ${dark ? "rotate-180" : ""}`} />
    </button>
  );
}

function Bell() {
  const { notifications, unread, markAllRead, connected } = useRealtime();
  const [open, setOpen] = useState(false);
  const ref = useOutside(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className={iconBtn} aria-label="알림">
        <i className={`fa-solid fa-bell ${unread ? "text-tomato-500" : ""}`} />
        {unread > 0 && <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-tomato-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
        <span className={`absolute right-2 bottom-1.5 size-1.5 rounded-full ${connected ? "bg-leaf-500" : "bg-stone-400"}`} title={connected ? "실시간 연결됨" : "연결 끊김"} />
      </button>
      {open && (
        <div className="card absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-pop overflow-hidden p-0 shadow-xl shadow-stone-900/10">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-ink-line">
            <p className="font-display text-base">실시간 알림</p>
            <button onClick={markAllRead} className="text-xs font-semibold text-leaf-700 hover:underline dark:text-leaf-300">모두 읽음</button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-stone-500">아직 알림이 없어요</li>}
            {notifications.slice(0, 15).map((n) => (
              <li key={n.id} className={`border-b border-stone-100 px-4 py-3 text-sm last:border-0 dark:border-ink-line ${n.is_read ? "opacity-60" : ""}`}>
                <p className="font-semibold text-tomato-600 dark:text-tomato-400"><i className="fa-solid fa-tags mr-1" />{n.title}</p>
                <p className="mt-0.5 text-stone-600 dark:text-stone-300">{n.message}</p>
                <p className="mt-1 text-xs text-stone-400">{timeAgo(n.created_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu({ onLogout }) {
  const { user, isAdmin, readOnly } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useOutside(() => setOpen(false));
  const health = HEALTH_LABELS[user.health_type] || HEALTH_LABELS.general;
  const items = [
    { to: "/dashboard", label: "마이 키친", icon: "fa-house" },
    { to: "/profile", label: "건강 프로필", icon: "fa-user-doctor" },
    ...(isAdmin ? [{ to: "/admin", label: readOnly ? "관리자 (읽기 전용)" : "관리자", icon: "fa-user-shield" }] : []),
  ];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-stone-200 py-1 pr-3 pl-1 transition hover:border-stone-400 dark:border-ink-line" aria-haspopup="menu" aria-expanded={open}>
        <span className="grid size-8 place-items-center rounded-full bg-leaf-800 font-display text-sm text-white dark:bg-leaf-300 dark:text-leaf-950">{user.name?.[0] || "R"}</span>
        <span className="hidden max-w-28 truncate text-sm font-semibold xl:inline">{user.name}</span>
        <i className={`fa-solid fa-chevron-down text-[10px] text-stone-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="card absolute right-0 z-50 mt-2 w-64 animate-pop overflow-hidden p-0 shadow-xl shadow-stone-900/10" role="menu">
          <div className="border-b border-stone-100 px-4 py-4 dark:border-ink-line">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs text-stone-400">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className={`chip ${health.color}`}><i className={`fa-solid ${health.icon}`} />{health.label}</span>
              {readOnly && <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"><i className="fa-solid fa-eye" />읽기 전용</span>}
            </div>
          </div>
          <nav className="p-1.5">
            {items.map((it) => (
              <Link key={it.to} to={it.to} onClick={() => setOpen(false)} role="menuitem"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-ink-line">
                <i className={`fa-solid ${it.icon} w-4 text-center text-stone-400`} />{it.label}
              </Link>
            ))}
            <button onClick={onLogout} role="menuitem" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-ink-line">
              <i className="fa-solid fa-arrow-right-from-bracket w-4 text-center text-stone-400" />로그아웃
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

function AnnouncementBar() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api("/api/public/stats").then(setStats).catch(() => {});
  }, []);
  return (
    <div className="bg-leaf-900 text-[12px] text-white/75 dark:bg-black">
      <div className="container-x flex h-9 items-center justify-between gap-4">
        <p className="flex min-w-0 items-center gap-2">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-tomato-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-tomato-400" />
          </span>
          {stats ? (
            <span className="truncate">
              오늘 구출을 기다리는 할인 식재료 <b className="text-white">{stats.deals}개</b> · 마감세일 <b className="text-white">{stats.closing}건</b> · 평균 <b className="text-tomato-300">{stats.avg_discount}%</b> 할인
            </span>
          ) : (
            <span className="truncate">RPA가 매시간 대형마트 할인 식재료를 수집하고 있어요</span>
          )}
        </p>
        <nav className="hidden shrink-0 items-center gap-5 md:flex">
          <Link to="/#how" className="link-underline hover:text-white">이용 가이드</Link>
          <Link to="/#faq" className="link-underline hover:text-white">자주 묻는 질문</Link>
          <a href="mailto:whyeil@naver.com" className="link-underline hover:text-white">고객센터</a>
        </nav>
      </div>
    </div>
  );
}

export default function Header() {
  const { user, logout, isAdmin, readOnly } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const items = isAdmin ? [...NAV, { to: "/admin", label: "관리자", en: "Admin", icon: "fa-user-shield" }] : NAV;
  const drawerItems = user ? [...items, { to: "/profile", label: "건강 프로필", en: "Profile", icon: "fa-user-doctor" }] : items;
  const health = HEALTH_LABELS[user?.health_type] || HEALTH_LABELS.general;

  useEffect(() => setOpen(false), [location.pathname, location.hash]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const doLogout = () => {
    logout();
    navigate("/");
  };

  const navCls = ({ isActive }) =>
    `link-underline py-1 text-[14px] font-semibold tracking-tight transition ${
      isActive ? "text-leaf-900 after:w-full dark:text-white" : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
    }`;

  return (
    <>
      <AnnouncementBar />
      <header
        className={`sticky top-0 z-40 border-b transition-all duration-300 ${
          scrolled
            ? "border-stone-200/80 bg-cream/85 shadow-[0_8px_30px_-12px_rgba(28,25,23,0.15)] backdrop-blur-xl dark:border-ink-line dark:bg-ink/85"
            : "border-stone-200/60 bg-cream dark:border-ink-line dark:bg-ink"
        }`}
      >
        <div className="container-x flex h-[68px] items-center gap-6">
          <Link to="/" className="shrink-0" aria-label="RecipePick 메인으로"><Logo tagline /></Link>
          <nav className="mx-auto hidden items-center gap-8 lg:flex" aria-label="주요 메뉴">
            {items.map((n) =>
              n.to.includes("#") ? (
                <Link key={n.to} to={n.to} className={navCls({ isActive: false })}>{n.label}</Link>
              ) : (
                <NavLink key={n.to} to={n.to} className={navCls}>{n.label}</NavLink>
              ),
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            {readOnly && (
              <span className="chip hidden bg-amber-100 text-amber-800 sm:inline-flex dark:bg-amber-900/40 dark:text-amber-200"><i className="fa-solid fa-eye" />테스트 관리자</span>
            )}
            <ThemeButton />
            {user && <Bell />}
            <div className="hidden items-center gap-2 sm:flex">
              {user ? (
                <UserMenu onLogout={doLogout} />
              ) : (
                <>
                  <Link to="/login" className="px-3 text-sm font-semibold text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white">로그인</Link>
                  <Link to="/login?mode=register" className="btn-primary py-2">시작하기</Link>
                </>
              )}
            </div>
            <button onClick={() => setOpen((o) => !o)} className={`${iconBtn} lg:hidden`} aria-label={open ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={open}>
              <Hamburger open={open} />
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setOpen(false)} />
      <aside
        className={`fixed top-0 right-0 z-[55] flex h-dvh w-[86%] max-w-sm flex-col bg-cream shadow-2xl transition-transform duration-300 ease-out lg:hidden dark:bg-ink-soft ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <div className="flex h-[68px] items-center justify-between border-b border-stone-200 px-5 dark:border-ink-line">
          <Logo />
          <button onClick={() => setOpen(false)} className={iconBtn} aria-label="메뉴 닫기" tabIndex={open ? 0 : -1}><Hamburger open /></button>
        </div>
        {user && (
          <div className="border-b border-stone-200 px-5 py-4 dark:border-ink-line">
            <p className="font-display text-lg">{user.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className={`chip ${health.color}`}><i className={`fa-solid ${health.icon}`} />{health.label}</span>
              {readOnly && <span className="chip bg-amber-100 text-amber-800"><i className="fa-solid fa-eye" />읽기 전용</span>}
            </div>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {drawerItems.map((n, i) => (
            <Link key={n.to} to={n.to} tabIndex={open ? 0 : -1} style={{ animationDelay: `${i * 40}ms` }}
              className={`flex items-center justify-between rounded-xl px-3 py-3.5 hover:bg-white dark:hover:bg-ink-line ${open ? "animate-fade-up" : ""}`}>
              <span className="flex items-center gap-3 text-base font-semibold"><i className={`fa-solid ${n.icon} w-5 text-center text-leaf-600 dark:text-leaf-300`} />{n.label}</span>
              <span className="serif-en text-sm text-stone-400">{n.en}</span>
            </Link>
          ))}
        </nav>
        <div className="grid gap-2 border-t border-stone-200 p-4 dark:border-ink-line">
          {user ? (
            <button onClick={doLogout} className="btn-ghost w-full"><i className="fa-solid fa-arrow-right-from-bracket" />로그아웃</button>
          ) : (
            <>
              <Link to="/login?mode=register" className="btn-primary w-full">무료로 시작하기</Link>
              <Link to="/login" className="btn-ghost w-full">로그인</Link>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

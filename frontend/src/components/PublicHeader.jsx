import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Hamburger from "./Hamburger";
import Logo from "./Logo";

export const PUBLIC_NAV = [
  { href: "/#features", label: "주요 기능", icon: "fa-star" },
  { href: "/#health", label: "건강 맞춤", icon: "fa-heart-pulse" },
  { href: "/#how", label: "이용 방법", icon: "fa-list-check" },
  { href: "/#deals", label: "오늘의 할인", icon: "fa-tags" },
  { href: "/#faq", label: "자주 묻는 질문", icon: "fa-circle-question" },
];

export default function PublicHeader() {
  const { user } = useAuth();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

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
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cta = user ? (
    <Link to="/dashboard" className="btn-primary"><i className="fa-solid fa-gauge" />대시보드</Link>
  ) : (
    <>
      <Link to="/login" className="btn-ghost">로그인</Link>
      <Link to="/login?mode=register" className="btn-primary">무료로 시작하기</Link>
    </>
  );

  return (
    <>
      <header className={`sticky top-0 z-40 border-b transition-all ${scrolled ? "border-leaf-100 bg-white/85 shadow-sm backdrop-blur-lg dark:border-ink-line dark:bg-ink/85" : "border-transparent bg-cream/70 backdrop-blur dark:bg-ink/70"}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="RecipePick 홈"><Logo /></Link>
          <nav className="ml-8 hidden flex-1 items-center gap-1 lg:flex" aria-label="주요 메뉴">
            {PUBLIC_NAV.map((n) => (
              <a key={n.href} href={n.href} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-leaf-50 hover:text-leaf-800 dark:text-slate-300 dark:hover:bg-ink-line">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggle} className="grid size-10 place-items-center rounded-xl text-slate-600 transition hover:bg-leaf-50 dark:text-slate-300 dark:hover:bg-ink-line" aria-label="테마 전환">
              <i className={`fa-solid ${dark ? "fa-sun text-amber-300" : "fa-moon"}`} />
            </button>
            <div className="hidden items-center gap-2 sm:flex">{cta}</div>
            <button
              onClick={() => setOpen((o) => !o)}
              className="grid size-10 place-items-center rounded-xl hover:bg-leaf-50 lg:hidden dark:hover:bg-ink-line"
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
        <div className="flex h-16 items-center justify-between border-b border-leaf-100 px-4 dark:border-ink-line">
          <Logo size="text-xl" />
          <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl hover:bg-leaf-50 dark:hover:bg-ink-line" aria-label="메뉴 닫기" tabIndex={open ? 0 : -1}>
            <Hamburger open />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {PUBLIC_NAV.map((n, i) => (
            <a
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-slate-700 hover:bg-leaf-50 dark:text-slate-200 dark:hover:bg-ink-line ${open ? "animate-fade-up" : ""}`}
              style={{ animationDelay: `${i * 40}ms` }}
              tabIndex={open ? 0 : -1}
            >
              <i className={`fa-solid ${n.icon} w-5 text-center text-leaf-600`} />{n.label}
            </a>
          ))}
        </nav>
        <div className="grid gap-2 border-t border-leaf-100 p-4 dark:border-ink-line">{cta}</div>
      </aside>
    </>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router";
import Logo from "./Logo";

const COLUMNS = [
  {
    title: "서비스",
    links: [
      { to: "/#features", label: "주요 기능" },
      { to: "/#health", label: "건강 맞춤 식단" },
      { to: "/#deals", label: "오늘의 마트 할인" },
      { to: "/#faq", label: "자주 묻는 질문" },
    ],
  },
  {
    title: "바로가기",
    links: [
      { to: "/dashboard", label: "대시보드" },
      { to: "/fridge", label: "냉장고 파먹기" },
      { to: "/recipe", label: "AI 레시피" },
      { to: "/deals", label: "마트 할인" },
    ],
  },
  {
    title: "고객 지원",
    links: [
      { href: "https://fsclass-n.github.io/recipepick/", label: "프로젝트 안내" },
      { href: "https://github.com/fsclass-n/recipepick/issues", label: "문의·버그 제보" },
      { href: "https://recipepick-api.onrender.com/docs", label: "API 문서" },
    ],
  },
];

function FooterLink({ to, href, label }) {
  const cls = "text-sm text-slate-500 transition hover:text-leaf-700 dark:text-slate-400 dark:hover:text-leaf-300";
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{label}</a>;
  return to.includes("#") ? <a href={to} className={cls}>{label}</a> : <Link to={to} className={cls}>{label}</Link>;
}

export default function Footer({ compact = false }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <footer className={`border-t border-leaf-100 bg-white/70 dark:border-ink-line dark:bg-ink-soft/70 ${compact ? "" : "mt-16"}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {!compact && (
          <div className="grid gap-10 py-12 md:grid-cols-5">
            <div className="md:col-span-2">
              <Logo size="text-xl" />
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                RPA로 대형마트 마감세일을 찾고, Gemini AI가 내 건강에 맞는 냉장고 파먹기 레시피를 창작합니다. 식비는 줄이고 건강은 챙기는 푸드테크 짠테크 플랫폼.
              </p>
              <div className="mt-4 flex gap-2">
                {[
                  ["fa-brands fa-github", "https://github.com/fsclass-n/recipepick", "GitHub"],
                  ["fa-solid fa-book-open", "https://fsclass-n.github.io/recipepick/", "프로젝트 안내"],
                  ["fa-solid fa-envelope", "mailto:whyeil@naver.com", "이메일 문의"],
                ].map(([icon, href, label]) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}
                    className="grid size-10 place-items-center rounded-xl bg-leaf-50 text-leaf-700 transition hover:bg-leaf-600 hover:text-white dark:bg-ink-line dark:text-leaf-300">
                    <i className={icon} />
                  </a>
                ))}
              </div>
            </div>
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="font-display text-base text-leaf-900 dark:text-leaf-100">{col.title}</p>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => <li key={l.label}><FooterLink {...l} /></li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div className={`flex flex-col gap-3 py-6 text-xs text-slate-400 md:flex-row md:items-center md:justify-between ${compact ? "" : "border-t border-leaf-100 dark:border-ink-line"}`}>
          <div className="space-y-1">
            <p>RecipePick · 대표 홍기흥 · 문의 whyeil@naver.com</p>
            <p>할인 정보는 각 마트 공개 페이지 기준이며 실제 매장 가격과 다를 수 있습니다. 데모(DEMO) 표시 상품은 시뮬레이션 데이터입니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/terms" className="hover:text-leaf-700 dark:hover:text-leaf-300">이용약관</Link>
            <Link to="/privacy" className="font-semibold text-slate-500 hover:text-leaf-700 dark:text-slate-300 dark:hover:text-leaf-300">개인정보처리방침</Link>
            <span>© 2026 RecipePick. All rights reserved.</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed right-5 bottom-5 z-30 grid size-12 place-items-center rounded-full bg-leaf-600 text-white shadow-lg shadow-leaf-600/40 transition-all duration-300 hover:-translate-y-1 hover:bg-leaf-700 ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
        aria-label="맨 위로"
      >
        <i className="fa-solid fa-arrow-up" />
      </button>
    </footer>
  );
}

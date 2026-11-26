import { useEffect, useState } from "react";
import { Link } from "react-router";
import Logo from "./Logo";

const COLUMNS = [
  {
    title: "서비스",
    links: [
      { to: "/#lookbook", label: "식단 룩북" },
      { to: "/#rescue", label: "레스큐 키친이란?" },
      { to: "/deals", label: "오늘의 마감세일" },
      { to: "/recipe", label: "AI 레시피 창작" },
    ],
  },
  {
    title: "마이 키친",
    links: [
      { to: "/dashboard", label: "대시보드" },
      { to: "/fridge", label: "냉장고 파먹기" },
      { to: "/profile", label: "건강 프로필" },
      { to: "/#faq", label: "자주 묻는 질문" },
    ],
  },
  {
    title: "정책 · 지원",
    links: [
      { to: "/terms", label: "이용약관" },
      { to: "/privacy", label: "개인정보처리방침", strong: true },
      { href: "https://github.com/fsclass-n/recipepick/issues", label: "문의 · 버그 제보" },
      { href: "https://recipepick-api.onrender.com/docs", label: "Open API 문서" },
    ],
  },
];

const SOCIAL = [
  ["fa-brands fa-github", "https://github.com/fsclass-n/recipepick", "GitHub"],
  ["fa-solid fa-book-open", "https://fsclass-n.github.io/recipepick/", "프로젝트 안내"],
  ["fa-solid fa-envelope", "mailto:whyeil@naver.com", "이메일 문의"],
];

function FooterLink({ to, href, label, strong }) {
  const cls = `link-underline text-[13px] transition ${strong ? "font-semibold text-stone-700 dark:text-stone-200" : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"}`;
  if (href) return <a href={href} target={href.startsWith("mailto") ? undefined : "_blank"} rel="noreferrer" className={cls}>{label}</a>;
  return <Link to={to} className={cls}>{label}</Link>;
}

export function ToTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`group fixed right-5 bottom-5 z-30 grid size-12 place-items-center rounded-full border border-stone-200 bg-white/95 text-stone-800 shadow-lg shadow-stone-900/10 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-leaf-800 hover:bg-leaf-800 hover:text-white sm:right-8 sm:bottom-8 dark:border-ink-line dark:bg-ink-soft/95 dark:text-stone-100 ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
      aria-label="맨 위로 이동"
      title="To the Top"
    >
      <i className="fa-solid fa-arrow-up text-sm transition-transform group-hover:-translate-y-0.5" />
    </button>
  );
}

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-stone-200 bg-paper/60 dark:border-ink-line dark:bg-ink-soft/60">
      <div className="container-x">
        <div className="grid gap-12 py-16 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo tagline />
            <p className="mt-5 max-w-sm text-[13px] leading-relaxed text-stone-500 dark:text-stone-400">
              버려질 뻔한 마감세일 식재료와 냉장고 속 임박 재료를 AI가 내 건강에 맞는 한 끼로 큐레이션합니다. 식비는 줄이고, 건강은 챙기고, 음식물 쓰레기는 덜어내는 레스큐 키친.
            </p>
            <div className="mt-6 flex gap-2">
              {SOCIAL.map(([icon, href, label]) => (
                <a key={label} href={href} target={href.startsWith("mailto") ? undefined : "_blank"} rel="noreferrer" aria-label={label} title={label}
                  className="grid size-10 place-items-center rounded-full border border-stone-300 text-stone-600 transition hover:border-leaf-800 hover:bg-leaf-800 hover:text-white dark:border-ink-line dark:text-stone-300">
                  <i className={icon} />
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-5">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="eyebrow !text-stone-400">{col.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => <li key={l.label}><FooterLink {...l} /></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="lg:col-span-3">
            <p className="eyebrow !text-stone-400">고객센터</p>
            <a href="mailto:whyeil@naver.com" className="mt-4 block font-display text-xl text-leaf-900 hover:text-tomato-600 dark:text-stone-100">whyeil@naver.com</a>
            <p className="mt-2 text-[13px] leading-relaxed text-stone-500 dark:text-stone-400">서비스 이용 · 제휴 문의는 이메일 또는 GitHub 이슈로 남겨 주세요.</p>
            <a href="https://github.com/fsclass-n/recipepick/issues" target="_blank" rel="noreferrer" className="btn-ghost mt-4 py-2 text-xs">
              <i className="fa-brands fa-github" />이슈 남기기
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-stone-200 py-8 text-[12px] text-stone-400 lg:flex-row lg:items-end lg:justify-between dark:border-ink-line">
          <div className="space-y-1.5 leading-relaxed">
            <p className="text-stone-500 dark:text-stone-400">
              <b className="font-semibold text-stone-700 dark:text-stone-200">RecipePick</b>
              <span className="mx-2 text-stone-300">|</span>대표 홍기흥
              <span className="mx-2 text-stone-300">|</span>개인정보 보호책임자 홍기흥
              <span className="mx-2 text-stone-300">|</span>whyeil@naver.com
            </p>
            <p>할인 정보는 각 마트 공개 페이지 기준이며 실제 매장 가격과 다를 수 있습니다. DEMO 표시 상품은 시뮬레이션 데이터입니다.</p>
            <p>AI 레시피와 영양 정보는 일반적인 식단 참고용이며 의학적 진단·처방을 대체하지 않습니다.</p>
          </div>
          <div className="flex flex-col gap-1.5 lg:items-end">
            <p>Food photography by <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Unsplash</a></p>
            <p>© 2026 RecipePick. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { useEffect, useState } from "react";
import Logo from "./Logo";

export default function Footer() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <footer className="mt-16 border-t border-leaf-100 bg-white/60 dark:border-ink-line dark:bg-ink-soft/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo size="text-xl" />
          <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
            RPA로 대형마트 마감세일을 찾고, Gemini AI가 내 건강에 맞는 냉장고 파먹기 레시피를 창작합니다.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xl text-slate-400">
          <a href="https://github.com/fsclass-n/recipepick" target="_blank" rel="noreferrer" className="hover:text-leaf-600" aria-label="GitHub"><i className="fa-brands fa-github" /></a>
          <a href="https://fsclass-n.github.io/recipepick/" target="_blank" rel="noreferrer" className="hover:text-leaf-600" aria-label="프로젝트 안내"><i className="fa-solid fa-book-open" /></a>
          <span className="text-xs">© 2026 RecipePick · 홍기흥</span>
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

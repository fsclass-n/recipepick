/** 그릇(레시피) + 새싹(건강) + 체크(Pick, 큐레이션)를 결합한 RecipePick 심볼. */
export function LogoMark({ className = "size-9" }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="14" className="fill-leaf-800 dark:fill-honey-300" />
      <path d="M24.6 23.6C24.6 15.6 29.1 10.6 36.6 9.6C36.6 17.6 32.1 22.6 24.6 23.6Z" className="fill-leaf-300 dark:fill-leaf-600" />
      <path d="M23.4 22.2C22.4 16.7 18.9 13.7 13.4 13.7C13.4 18.7 16.9 22.2 23.4 22.2Z" className="fill-leaf-200 dark:fill-leaf-500" />
      <path d="M9.5 25.5H38.5C38.5 33.5 32 39.5 24 39.5S9.5 33.5 9.5 25.5Z" className="fill-cream dark:fill-ink" />
      <path d="M18.4 31.2L22.3 34.6L29.8 28" fill="none" className="stroke-tomato-500" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ light = false, size = "text-[22px]", tagline = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${light ? "text-white" : "text-leaf-900 dark:text-stone-100"}`}>
      <LogoMark className={size.includes("xl") || size.includes("2") ? "size-9" : "size-8"} />
      <span className="flex flex-col leading-none">
        <span className={`font-display ${size} tracking-tight`}>
          Recipe<span className="serif-en text-tomato-500">Pick</span>
        </span>
        {tagline && <span className={`mt-1 text-[9px] font-semibold tracking-[0.28em] uppercase ${light ? "text-white/60" : "text-stone-400"}`}>Rescue Kitchen</span>}
      </span>
    </span>
  );
}

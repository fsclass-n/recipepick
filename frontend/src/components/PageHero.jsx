import { unsplash } from "../lib/images";

/** 내부 페이지 공통 상단 비주얼 배너: 같은 높이·타이포·여백으로 모든 화면의 첫인상을 통일한다. */
export default function PageHero({ eyebrow, title, desc, image, children, compact = false }) {
  return (
    <section className={`relative isolate flex flex-col justify-end overflow-hidden rounded-3xl bg-leaf-900 text-white ${compact ? "min-h-[200px]" : "min-h-[240px] sm:min-h-[280px]"}`}>
      {image && (
        <img src={unsplash(image, 1600, 640)} alt="" className="absolute inset-0 -z-10 size-full animate-ken-burns object-cover" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-leaf-950/90 via-leaf-950/65 to-leaf-950/10" />
      <div className="flex flex-col gap-5 p-6 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl animate-fade-up">
          {eyebrow && <p className="eyebrow !text-tomato-300">{eyebrow}</p>}
          <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">{title}</h1>
          {desc && <div className="mt-3 text-sm leading-relaxed text-white/75 sm:text-[15px]">{desc}</div>}
        </div>
        {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
      </div>
    </section>
  );
}

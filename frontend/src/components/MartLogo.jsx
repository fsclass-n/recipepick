// 마트 공식 워드마크(Wikimedia Commons: 홈플러스 CC0, 이마트·롯데마트 Public Domain). 오이마켓은 공식 로고를 확보하지 못해 텍스트 배지로 표시한다.
export const MARTS = {
  홈플러스: { logo: "/logos/homeplus.png", chip: "bg-rose-500 text-white" },
  이마트: { logo: "/logos/emart.svg", chip: "bg-yellow-400 text-stone-900" },
  롯데마트: { logo: "/logos/lottemart.svg", chip: "bg-red-600 text-white" },
  오이마켓: { logo: null, chip: "bg-lime-600 text-white" },
};

export default function MartLogo({ mart, className = "h-12 w-28" }) {
  const m = MARTS[mart];
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-ink-line ${className}`} title={mart}>
      {m?.logo ? (
        <img src={m.logo} alt={`${mart} 로고`} className="max-h-full max-w-full object-contain" loading="lazy" />
      ) : (
        <span className="flex items-center gap-1 text-sm font-black tracking-tight text-lime-700"><i className="fa-solid fa-seedling text-xs" />{mart}</span>
      )}
    </span>
  );
}

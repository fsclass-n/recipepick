// 마트 시그니처 심볼(원형 배지). 출처: public/logos/CREDITS.txt
export const MARTS = {
  홈플러스: { symbol: "/logos/homeplus-symbol.svg", chip: "bg-rose-500 text-white" },
  이마트: { symbol: "/logos/emart-symbol.svg", chip: "bg-yellow-400 text-stone-900" },
  롯데마트: { symbol: "/logos/lottemart-symbol.svg", chip: "bg-red-600 text-white" },
  오아시스마켓: { symbol: "/logos/oasis-symbol.png", chip: "bg-[#6ca437] text-white", fill: true },
};

export default function MartLogo({ mart, className = "size-12" }) {
  const m = MARTS[mart];
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-stone-200 bg-white shadow-sm dark:border-ink-line ${className}`} title={mart}>
      {m?.symbol ? (
        <img src={m.symbol} alt={`${mart} 심볼`} className={m.fill ? "size-full rounded-full object-cover" : "size-[62%] object-contain"} loading="lazy" />
      ) : (
        <i className="fa-solid fa-seedling text-lg text-lime-600" aria-label={`${mart} 심볼`} />
      )}
    </span>
  );
}

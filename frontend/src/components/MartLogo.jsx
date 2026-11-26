// 마트 시그니처 심볼(원형 배지). 출처: public/logos/CREDITS.txt
// 오이마켓은 공식 심볼을 확보하지 못해 아이콘 배지로 표시한다.
export const MARTS = {
  홈플러스: { symbol: "/logos/homeplus-symbol.svg", chip: "bg-rose-500 text-white" },
  이마트: { symbol: "/logos/emart-symbol.svg", chip: "bg-yellow-400 text-stone-900" },
  롯데마트: { symbol: "/logos/lottemart-symbol.svg", chip: "bg-red-600 text-white" },
  오이마켓: { symbol: null, chip: "bg-lime-600 text-white" },
};

export default function MartLogo({ mart, className = "size-12" }) {
  const m = MARTS[mart];
  return (
    <span className={`grid shrink-0 place-items-center rounded-full border border-stone-200 bg-white shadow-sm dark:border-ink-line ${className}`} title={mart}>
      {m?.symbol ? (
        <img src={m.symbol} alt={`${mart} 심볼`} className="size-[62%] object-contain" loading="lazy" />
      ) : (
        <i className="fa-solid fa-seedling text-lg text-lime-600" aria-label={`${mart} 심볼`} />
      )}
    </span>
  );
}

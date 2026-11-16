import { useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";

export default function PlotlyChart({ figure, height = 320 }) {
  const ref = useRef(null);
  const { dark } = useTheme();

  useEffect(() => {
    let Plotly;
    let cancelled = false;
    import("plotly.js-basic-dist-min").then((mod) => {
      if (cancelled || !ref.current) return;
      Plotly = mod.default || mod;
      const layout = {
        ...figure.layout,
        height,
        autosize: true,
        font: { ...(figure.layout?.font || {}), color: dark ? "#cbd5e1" : "#334155" },
        xaxis: { ...(figure.layout?.xaxis || {}), gridcolor: dark ? "#233229" : "#e2e8f0" },
        yaxis: { ...(figure.layout?.yaxis || {}), gridcolor: dark ? "#233229" : "#e2e8f0" },
        legend: { orientation: "h", y: -0.2 },
      };
      Plotly.react(ref.current, figure.data, layout, { responsive: true, displayModeBar: false });
    });
    const el = ref.current;
    return () => {
      cancelled = true;
      if (Plotly && el) Plotly.purge(el);
    };
  }, [figure, dark, height]);

  return <div ref={ref} className="w-full" style={{ minHeight: height }} />;
}

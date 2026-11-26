import { useRealtime } from "../context/RealtimeContext";

const TONES = {
  info: "border-leaf-200 dark:border-leaf-800",
  deal: "border-tomato-400",
  error: "border-rose-400",
  success: "border-leaf-500",
};

export default function Toasts() {
  const { toasts, dismissToast } = useRealtime();
  return (
    <div className="pointer-events-none fixed top-20 right-4 left-4 z-[70] flex flex-col items-end gap-2 sm:left-auto sm:w-96" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`card pointer-events-auto flex w-full animate-pop items-start gap-3 border-l-4 p-4 shadow-lg ${TONES[t.tone] || TONES.info}`}>
          <i className={`fa-solid ${t.icon || (t.tone === "error" ? "fa-circle-exclamation" : "fa-bell")} mt-0.5 ${t.tone === "error" ? "text-rose-500" : t.tone === "deal" ? "text-tomato-500" : "text-leaf-600"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{t.title}</p>
            {t.message && <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">{t.message}</p>}
          </div>
          <button onClick={() => dismissToast(t.id)} className="text-stone-400 hover:text-stone-600" aria-label="닫기"><i className="fa-solid fa-xmark" /></button>
        </div>
      ))}
    </div>
  );
}

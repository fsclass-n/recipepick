import { useRef, useState } from "react";
import { useRealtime } from "../context/RealtimeContext";
import { api, CATEGORY_ICONS } from "../lib/api";

const MAX_SIDE = 1280;

// 업로드 전에 브라우저에서 긴 변 1280px JPEG 로 줄여 전송량을 낮춘다(EXIF 회전은 브라우저가 반영).
async function toJpegDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** 냉장고 사진 → Gemini 인식 → 사용자가 확인한 재료만 냉장고에 등록 */
export default function FridgeScanner({ onAdded, onClose }) {
  const { toast } = useRealtime();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState({});
  const [busy, setBusy] = useState("");

  const choose = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast({ title: "이미지 파일만 올릴 수 있어요", tone: "error" });
    setResult(null);
    setBusy("prepare");
    try {
      const dataUrl = await toJpegDataUrl(file);
      setPreview(dataUrl);
      setBusy("scan");
      const res = await api("/api/fridge/scan", { method: "POST", body: { image: dataUrl, mime: "image/jpeg" } });
      setResult(res);
      setPicked(Object.fromEntries(res.items.map((it, i) => [i, { ...it, on: (it.confidence ?? 1) >= 0.4 }])));
      if (!res.items.length) toast({ title: "식재료를 찾지 못했어요", message: res.note || "조금 더 밝고 가까이에서 찍어 주세요.", tone: "info" });
    } catch (e) {
      toast({ title: "사진 인식 실패", message: e.message, tone: "error" });
    } finally {
      setBusy("");
    }
  };

  const selected = Object.values(picked).filter((p) => p.on);
  const set = (i, patch) => setPicked((p) => ({ ...p, [i]: { ...p[i], ...patch } }));

  const save = async () => {
    setBusy("save");
    const created = [];
    for (const it of selected) {
      try {
        created.push(await api("/api/fridge", { method: "POST", body: { name: it.name, category: it.category, quantity: Number(it.quantity) || 1, unit: it.unit, is_wishlist: false } }));
      } catch (e) {
        toast({ title: `${it.name} 추가 실패`, message: e.message, tone: "error" });
      }
    }
    setBusy("");
    if (created.length) {
      toast({ title: `사진에서 ${created.length}개 재료를 냉장고에 담았어요`, message: created.map((c) => c.name).join(", "), tone: "success", icon: "fa-camera" });
      onAdded(created);
    }
  };

  return (
    <section className="card animate-fade-up overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-ink-line">
        <div>
          <p className="eyebrow">AI Fridge Scan</p>
          <h2 className="mt-1 text-xl">사진으로 냉장고 채우기</h2>
        </div>
        <button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-ink-line" aria-label="닫기"><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-5">
        <div className="md:col-span-2">
          <button onClick={() => inputRef.current?.click()} disabled={!!busy}
            className="group relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-paper/60 text-stone-500 transition hover:border-leaf-600 dark:border-ink-line dark:bg-ink">
            {preview ? <img src={preview} alt="업로드한 냉장고 사진" className="absolute inset-0 size-full object-cover" /> : (
              <span className="text-center text-sm">
                <i className="fa-solid fa-camera mb-2 block text-3xl text-leaf-500" />냉장고 안을 찍거나 사진을 선택하세요
                <span className="mt-1 block text-[11px] text-stone-400">JPEG·PNG·WEBP · 사진은 저장되지 않아요</span>
              </span>
            )}
            {busy && (
              <span className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-semibold text-white">
                <span><i className="fa-solid fa-spinner fa-spin mr-2" />{busy === "scan" ? "AI가 재료를 찾는 중…" : busy === "save" ? "냉장고에 담는 중…" : "사진 준비 중…"}</span>
              </span>
            )}
          </button>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
          {preview && !busy && <button onClick={() => inputRef.current?.click()} className="btn-ghost mt-3 w-full py-2 text-xs"><i className="fa-solid fa-rotate" />다른 사진으로 다시 인식</button>}
        </div>

        <div className="md:col-span-3">
          {!result && (
            <ol className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
              {["냉장고 문을 열고 칸이 잘 보이게 찍어 주세요.", "Gemini AI가 사진 속 식재료와 수량을 찾아요.", "목록을 확인·수정한 뒤 원하는 재료만 냉장고에 담아요."].map((t, i) => (
                <li key={t} className="flex gap-3"><span className="serif-en text-xl leading-none text-tomato-500">{String(i + 1).padStart(2, "0")}</span>{t}</li>
              ))}
            </ol>
          )}
          {result && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">인식된 재료 {result.items.length}개 <span className="font-normal text-stone-400">· {selected.length}개 선택</span></p>
                {result.model && <span className="chip bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"><i className="fa-solid fa-wand-magic-sparkles" />{result.model}</span>}
              </div>
              {result.note && <p className="mt-2 text-xs text-stone-500">{result.note}</p>}
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {result.items.map((it, i) => (
                  <li key={it.name} className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${picked[i]?.on ? "border-leaf-500 bg-leaf-50/60 dark:bg-leaf-950/30" : "border-stone-200 opacity-60 dark:border-ink-line"}`}>
                    <input type="checkbox" className="size-4 accent-leaf-700" checked={!!picked[i]?.on} onChange={(e) => set(i, { on: e.target.checked })} aria-label={`${it.name} 선택`} />
                    <i className={`fa-solid ${CATEGORY_ICONS[it.category] || CATEGORY_ICONS.기타} w-4 text-center text-leaf-600`} />
                    <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" value={picked[i]?.name ?? it.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="재료명" />
                    <input type="number" min="0" step="0.5" className="w-14 rounded-lg border border-stone-200 bg-white px-2 py-1 text-right text-sm dark:border-ink-line dark:bg-ink" value={picked[i]?.quantity ?? it.quantity} onChange={(e) => set(i, { quantity: e.target.value })} aria-label="수량" />
                    <span className="w-8 text-xs text-stone-500">{it.unit}</span>
                    {it.confidence > 0 && <span className="hidden w-10 text-right text-[11px] text-stone-400 sm:inline">{Math.round(it.confidence * 100)}%</span>}
                  </li>
                ))}
              </ul>
              <button onClick={save} disabled={!selected.length || !!busy} className="btn-primary mt-4 w-full py-3">
                <i className="fa-solid fa-snowflake" />선택한 {selected.length}개 냉장고에 담기
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

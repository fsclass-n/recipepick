import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { HEALTH_LABELS } from "../lib/api";
import PageHero from "../components/PageHero";
import { IMG } from "../lib/images";

const GUIDES = {
  general: "균형 잡힌 영양소 구성, 가공식품 최소화",
  diabetes: "저GI 식재료, 정제 탄수화물·설탕 최소화, 1회 탄수화물 45~60g 이하",
  diet: "1인분 500kcal 이하, 고단백·고식이섬유, 튀김·당류 배제",
  hypertension: "1인분 나트륨 600mg 이하(DASH 식단), 칼륨 풍부 채소",
  cholesterol: "포화지방 최소화, 오메가-3·식이섬유 강화, 생선·두부 위주",
};

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { toast } = useRealtime();
  const [form, setForm] = useState({ name: user.name, health_type: user.health_type, allergies: user.allergies, daily_kcal: user.daily_kcal });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile({ ...form, daily_kcal: Number(form.daily_kcal) });
      toast({ title: "건강 프로필 저장 완료", message: "다음 레시피부터 반영됩니다.", tone: "success" });
    } catch (err) {
      toast({ title: "저장 실패", message: err.message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero
        compact
        image={IMG.breakfast}
        eyebrow="Health Profile"
        title="건강 프로필"
        desc="AI 레시피 창작 시 프롬프트에 반영되는 개인 건강 정보입니다."
      />
      <form onSubmit={save} className="card space-y-5 p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-2xl bg-leaf-600 font-display text-2xl text-white">{user.name.slice(0, 1)}</span>
          <div>
            <p className="font-semibold">{user.email}</p>
            <p className="text-xs text-stone-500">
              {user.provider === "local" ? "이메일 계정" : `${user.provider} 소셜 계정`} · {user.role === "admin" ? "관리자" : "일반 회원"}
            </p>
          </div>
        </div>
        <div>
          <label className="label">이름</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">건강 관리 목표</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(HEALTH_LABELS).map(([k, h]) => (
              <button type="button" key={k} onClick={() => setForm({ ...form, health_type: k })}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${form.health_type === k ? "border-leaf-500 bg-leaf-50 ring-2 ring-leaf-500/20 dark:bg-leaf-950/40" : "border-stone-200 hover:border-leaf-300 dark:border-ink-line"}`}>
                <span className={`chip mt-0.5 ${h.color}`}><i className={`fa-solid ${h.icon}`} /></span>
                <span><span className="block text-sm font-semibold">{h.label}</span><span className="text-xs text-stone-500">{GUIDES[k]}</span></span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">알레르기 식품 (쉼표 구분)</label>
            <input className="input" placeholder="예: 땅콩, 갑각류" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
          </div>
          <div>
            <label className="label">1일 목표 열량 (kcal)</label>
            <input type="number" min="800" max="5000" step="50" className="input" value={form.daily_kcal} onChange={(e) => setForm({ ...form, daily_kcal: e.target.value })} />
          </div>
        </div>
        <button disabled={busy} className="btn-primary w-full sm:w-auto">{busy && <i className="fa-solid fa-spinner fa-spin" />}<i className="fa-solid fa-floppy-disk" />저장</button>
      </form>
    </div>
  );
}

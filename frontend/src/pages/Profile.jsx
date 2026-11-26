import { useState } from "react";
import { useNavigate } from "react-router";
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

const PROTECTED = ["user@recipepick.dev", "admin@recipepick.dev"];

function WithdrawSection() {
  const { user, withdraw, readOnly } = useAuth();
  const { toast } = useRealtime();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const isLocal = user.provider === "local";
  const blocked = readOnly || PROTECTED.includes(user.email);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await withdraw(isLocal ? { password: secret } : { confirm: secret });
      toast({ title: "회원 탈퇴 완료", message: "냉장고·레시피·알림 데이터가 모두 삭제되었습니다. 이용해 주셔서 감사합니다.", tone: "info", icon: "fa-user-slash", duration: 8000 });
      navigate("/", { replace: true });
    } catch (err) {
      toast({ title: "탈퇴 실패", message: err.message, tone: "error" });
      setBusy(false);
    }
  };

  return (
    <section className="card border-rose-200 p-6 dark:border-rose-900/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg text-rose-700 dark:text-rose-300">회원 탈퇴</h2>
          <p className="mt-1 text-sm text-stone-500">탈퇴하면 건강 프로필, 냉장고·장바구니, AI 레시피, 알림 기록이 즉시 삭제되며 복구할 수 없습니다.</p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} disabled={blocked} className="btn shrink-0 border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
            title={blocked ? "테스트 계정·읽기 전용 모드에서는 탈퇴할 수 없습니다" : undefined}>
            <i className="fa-solid fa-user-slash" />회원 탈퇴
          </button>
        )}
      </div>
      {blocked && <p className="mt-3 text-xs text-stone-400"><i className="fa-solid fa-lock mr-1" />데모용 테스트 계정과 테스트 관리자(읽기 전용)는 탈퇴할 수 없습니다.</p>}
      {open && !blocked && (
        <form onSubmit={submit} className="mt-5 animate-fade-up space-y-3 rounded-2xl bg-rose-50/60 p-4 dark:bg-rose-950/20">
          <label className="label" htmlFor="withdraw-secret">{isLocal ? "본인 확인을 위해 비밀번호를 입력하세요" : "확인을 위해 '탈퇴'를 입력하세요"}</label>
          <input id="withdraw-secret" type={isLocal ? "password" : "text"} autoComplete={isLocal ? "current-password" : "off"} className="input" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={isLocal ? "비밀번호" : "탈퇴"} />
          <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="size-4 accent-rose-600" />모든 데이터가 삭제되며 복구할 수 없음을 확인했습니다.
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !agree || !secret} className="btn bg-rose-600 text-white hover:bg-rose-700">{busy && <i className="fa-solid fa-spinner fa-spin" />}탈퇴하기</button>
            <button type="button" onClick={() => { setOpen(false); setSecret(""); setAgree(false); }} className="btn-ghost">취소</button>
          </div>
        </form>
      )}
    </section>
  );
}

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
          <span className="grid size-16 place-items-center rounded-2xl bg-leaf-800 font-display text-2xl text-white dark:bg-honey-300 dark:text-ink">{user.name.slice(0, 1)}</span>
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
      <WithdrawSection />
    </div>
  );
}

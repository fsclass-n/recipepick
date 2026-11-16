export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
export const WS_URL = API_BASE.replace(/^http/, "ws") + "/ws";

const TOKEN_KEY = "rp-token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError("서버에 연결할 수 없습니다. (Render 무료 인스턴스는 깨어나는 데 최대 1분이 걸릴 수 있어요)", 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(", ") : data.detail;
    if (res.status === 401 && token) window.dispatchEvent(new Event("rp:unauthorized"));
    throw new ApiError(detail || `요청 실패 (${res.status})`, res.status);
  }
  return data;
}

export const oauthLoginUrl = (provider) =>
  `${API_BASE}/api/auth/oauth/${provider}/login?redirect=${encodeURIComponent(window.location.origin)}`;

export const won = (n) => `${Number(n || 0).toLocaleString("ko-KR")}원`;

export const HEALTH_LABELS = {
  general: { label: "일반 건강식", icon: "fa-heart-pulse", color: "bg-leaf-100 text-leaf-800 dark:bg-leaf-900/50 dark:text-leaf-200" },
  diabetes: { label: "당뇨 관리", icon: "fa-droplet", color: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  diet: { label: "다이어트", icon: "fa-weight-scale", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200" },
  hypertension: { label: "고혈압 관리", icon: "fa-heart", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" },
  cholesterol: { label: "고지혈증 관리", icon: "fa-fish", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
};

export const CATEGORY_ICONS = {
  채소: "fa-carrot",
  과일: "fa-apple-whole",
  육류: "fa-drumstick-bite",
  수산: "fa-fish",
  "유제품·계란": "fa-egg",
  "두부·콩": "fa-seedling",
  곡류: "fa-wheat-awn",
  "베이커리·간편식": "fa-bread-slice",
  기타: "fa-basket-shopping",
};

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

export function passwordChecks(pw = "") {
  return [
    { ok: pw.length >= 8, label: "8자 이상" },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: "영문 대·소문자" },
    { ok: /\d/.test(pw), label: "숫자" },
    { ok: /[^A-Za-z0-9]/.test(pw), label: "특수문자" },
  ];
}

export function timeAgo(iso) {
  if (!iso) return "-";
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "방금 전";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return d.toLocaleDateString("ko-KR");
}

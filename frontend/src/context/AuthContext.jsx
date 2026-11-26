import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "../lib/api";

const AuthContext = createContext(null);

// JWT payload(서명 검증은 서버 몫)에서 로그인 유형만 UI 표시용으로 읽는다.
// adm: 실제 관리자(관리자 키) · ro: 테스트 관리자(읽기 전용) · 둘 다 없음: 일반 회원
function tokenClaims(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const p = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")));
    return { ro: !!p.ro, adm: !!p.adm };
  } catch {
    return { ro: false, adm: false };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState(() => tokenClaims(tokenStore.get() || ""));
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setClaims({ ro: false, adm: false });
  }, []);

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) return setLoading(false);
    try {
      setUser(await api("/api/auth/me"));
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    loadMe();
    window.addEventListener("rp:unauthorized", logout);
    return () => window.removeEventListener("rp:unauthorized", logout);
  }, [loadMe, logout]);

  const applyToken = (res) => {
    tokenStore.set(res.access_token);
    setClaims(tokenClaims(res.access_token));
    setUser(res.user);
    return res.user;
  };

  const login = async (email, password) => applyToken(await api("/api/auth/login", { method: "POST", body: { email, password } }));
  const register = async (payload) => applyToken(await api("/api/auth/register", { method: "POST", body: payload }));
  const loginWithAdminKey = async (accessKey) => applyToken(await api("/api/auth/admin-login", { method: "POST", body: { access_key: accessKey } }));
  const loginAsTestAdmin = async () => applyToken(await api("/api/auth/test-admin", { method: "POST" }));
  const loginWithToken = async (token) => {
    tokenStore.set(token);
    setClaims(tokenClaims(token));
    const me = await api("/api/auth/me");
    setUser(me);
    return me;
  };
  const withdraw = async (payload) => {
    await api("/api/auth/me", { method: "DELETE", body: payload });
    logout();
  };
  const updateProfile = async (patch) => {
    const me = await api("/api/auth/me", { method: "PATCH", body: patch });
    setUser(me);
    return me;
  };

  return (
    <AuthContext.Provider
      value={{
        user, setUser, loading, login, register, loginWithAdminKey, loginAsTestAdmin, loginWithToken, logout, updateProfile, withdraw,
        // 관리자 화면은 관리자 계정 + (관리자 키 로그인 또는 테스트 관리자 로그인)일 때만 노출
        isAdmin: user?.role === "admin" && (claims.adm || claims.ro),
        readOnly: claims.ro,
        loginType: claims.adm ? "admin" : claims.ro ? "test-admin" : "member",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

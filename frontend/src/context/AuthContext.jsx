import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "../lib/api";

const AuthContext = createContext(null);

// JWT payload(서명 검증은 서버 몫)에서 읽기 전용(ro) 여부만 UI 표시용으로 읽는다.
function readOnlyClaim(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return !!JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="))).ro;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [readOnly, setReadOnly] = useState(() => readOnlyClaim(tokenStore.get() || ""));
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setReadOnly(false);
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
    setReadOnly(readOnlyClaim(res.access_token));
    setUser(res.user);
    return res.user;
  };

  const login = async (email, password) => applyToken(await api("/api/auth/login", { method: "POST", body: { email, password } }));
  const register = async (payload) => applyToken(await api("/api/auth/register", { method: "POST", body: payload }));
  const loginWithAdminKey = async (accessKey) => applyToken(await api("/api/auth/admin-login", { method: "POST", body: { access_key: accessKey } }));
  const loginAsTestAdmin = async () => applyToken(await api("/api/auth/test-admin", { method: "POST" }));
  const loginWithToken = async (token) => {
    tokenStore.set(token);
    setReadOnly(readOnlyClaim(token));
    const me = await api("/api/auth/me");
    setUser(me);
    return me;
  };
  const updateProfile = async (patch) => {
    const me = await api("/api/auth/me", { method: "PATCH", body: patch });
    setUser(me);
    return me;
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, login, register, loginWithAdminKey, loginAsTestAdmin, loginWithToken, logout, updateProfile, isAdmin: user?.role === "admin", readOnly }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

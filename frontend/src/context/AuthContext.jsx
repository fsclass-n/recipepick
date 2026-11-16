import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
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
    setUser(res.user);
    return res.user;
  };

  const login = async (email, password) => applyToken(await api("/api/auth/login", { method: "POST", body: { email, password } }));
  const register = async (payload) => applyToken(await api("/api/auth/register", { method: "POST", body: payload }));
  const loginWithToken = async (token) => {
    tokenStore.set(token);
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
    <AuthContext.Provider value={{ user, setUser, loading, login, register, loginWithToken, logout, updateProfile, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

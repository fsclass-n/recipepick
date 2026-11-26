import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, tokenStore, WS_URL } from "../lib/api";
import { useAuth } from "./AuthContext";

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { user, setUser } = useAuth();
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [crawlStatus, setCrawlStatus] = useState(null);
  const listeners = useRef(new Set());
  const userId = user?.id;

  const toast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list.slice(-3), { id, tone: "info", ...t }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.duration || 5000);
  }, []);
  const dismissToast = (id) => setToasts((list) => list.filter((x) => x.id !== id));

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      setNotifications(await api("/api/notifications"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    refreshNotifications();
    let ws;
    let retry = 0;
    let closed = false;
    let pingTimer;
    let retryTimer;

    const connect = () => {
      ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(tokenStore.get() || "")}`);
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        pingTimer = setInterval(() => ws.readyState === 1 && ws.send("ping"), 25000);
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "notification") {
          const n = msg.notification;
          setNotifications((list) => [n, ...list].slice(0, 50));
          toast({ title: n.title, message: n.message, tone: n.payload?.is_wishlist ? "deal" : "info", icon: "fa-tags", duration: 8000 });
          if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            new Notification(`RecipePick · ${n.title}`, { body: n.message, icon: "/favicon.svg" });
          }
        } else if (msg.type === "crawl_status") {
          setCrawlStatus(msg.data);
        } else if (msg.type === "profile_changed") {
          setUser(msg.data);
          toast({ title: "회원 정보 변경", message: `관리자에 의해 권한/프로필이 변경되었습니다. (현재: ${msg.data.role === "admin" ? "관리자" : "일반 회원"})`, icon: "fa-user-shield" });
        } else if (msg.type === "account_removed") {
          closed = true;
          toast({
            title: msg.data?.reason === "kicked" ? "계정이 강퇴되었습니다" : "회원 탈퇴가 완료되었습니다",
            message: msg.data?.reason === "kicked" ? "관리자에 의해 계정과 데이터가 삭제되어 로그아웃됩니다." : "그동안 RecipePick 을 이용해 주셔서 감사합니다.",
            tone: msg.data?.reason === "kicked" ? "error" : "info",
            icon: "fa-user-slash",
            duration: 8000,
          });
          window.dispatchEvent(new Event("rp:unauthorized"));
        }
        listeners.current.forEach((fn) => fn(msg));
      };
      ws.onclose = (ev) => {
        setConnected(false);
        clearInterval(pingTimer);
        if (closed || ev.code === 4401) return;
        retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      closed = true;
      clearInterval(pingTimer);
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [userId, refreshNotifications, setUser, toast]);

  const markAllRead = async () => {
    await api("/api/notifications/read-all", { method: "POST" });
    setNotifications((list) => list.map((n) => ({ ...n, is_read: true })));
  };

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <RealtimeContext.Provider
      value={{ connected, notifications, unread, markAllRead, refreshNotifications, toast, toasts, dismissToast, crawlStatus, setCrawlStatus, subscribe }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);

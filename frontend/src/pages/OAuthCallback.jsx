import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";

export default function OAuthCallback() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) return navigate("/login?error=oauth_failed", { replace: true });
    loginWithToken(token)
      .then(() => navigate("/dashboard", { replace: true }))
      .catch(() => navigate("/login?error=oauth_failed", { replace: true }));
  }, [loginWithToken, navigate]);

  return (
    <div className="grid min-h-dvh place-items-center text-leaf-600">
      <p className="text-center"><i className="fa-solid fa-spinner fa-spin text-3xl" /><br /><span className="mt-3 block text-sm">소셜 로그인 처리 중...</span></p>
    </div>
  );
}

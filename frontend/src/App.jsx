import { lazy, Suspense, useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import Footer, { ToTopButton } from "./components/Footer";
import Header from "./components/Header";
import Toasts from "./components/Toasts";
import { useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import Deals from "./pages/Deals";
import Fridge from "./pages/Fridge";
import Landing from "./pages/Landing";
import Legal from "./pages/Legal";
import Login from "./pages/Login";
import OAuthCallback from "./pages/OAuthCallback";
import Profile from "./pages/Profile";
import Recipe from "./pages/Recipe";

const Admin = lazy(() => import("./pages/Admin"));

function FullSpinner() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-leaf-600">
      <i className="fa-solid fa-seedling fa-bounce text-3xl" />
    </div>
  );
}

function Protected({ admin = false }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <FullSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** 모든 페이지 공통 레이아웃: 글로벌 헤더 · 푸터 · To-Top 버튼을 고정 배치한다. */
function SiteLayout() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<FullSpinner />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <ToTopButton />
    </div>
  );
}

/** 회원 전용 화면은 같은 그리드 폭과 상하 여백을 공유한다. */
function AppContainer() {
  return (
    <div className="container-x py-8 sm:py-10">
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <>
      <Toasts />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<Landing />} />
          <Route path="login" element={<Login />} />
          <Route path="terms" element={<Legal type="terms" />} />
          <Route path="privacy" element={<Legal type="privacy" />} />
          <Route path="oauth/callback" element={<OAuthCallback />} />
          <Route element={<Protected />}>
            <Route element={<AppContainer />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="fridge" element={<Fridge />} />
              <Route path="deals" element={<Deals />} />
              <Route path="recipe" element={<Recipe />} />
              <Route path="profile" element={<Profile />} />
              <Route element={<Protected admin />}>
                <Route path="admin" element={<Admin />} />
              </Route>
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

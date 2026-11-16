import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Toasts from "./components/Toasts";
import { useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import Deals from "./pages/Deals";
import Fridge from "./pages/Fridge";
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
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Suspense fallback={<FullSpinner />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <>
      <Toasts />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route element={<Protected />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="fridge" element={<Fridge />} />
            <Route path="deals" element={<Deals />} />
            <Route path="recipe" element={<Recipe />} />
            <Route path="profile" element={<Profile />} />
            <Route element={<Protected admin />}>
              <Route path="admin" element={<Admin />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

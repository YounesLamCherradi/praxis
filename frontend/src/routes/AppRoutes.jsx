import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Landing = lazy(() => import("../pages/Landing"));
const AdminLogin = lazy(() => import("../pages/auth/AdminLogin"));
const Login = lazy(() => import("../pages/auth/Login"));
const Signup = lazy(() => import("../pages/auth/Signup"));
const CourseInvite = lazy(() => import("../pages/CourseInvite"));
const StudentDashboardRoute = lazy(() => import("./StudentDashboardRoute"));
const TeacherDashboardRoute = lazy(() => import("./TeacherDashboardRoute"));
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));

import ProtectedRoute from "./ProtectedRoute";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm font-semibold text-slate-500">
            Loading Praxis…
          </div>
        }
      >
      <Routes>

        {/* Public Pages */}
        <Route path="/" element={<Landing />} />

        <Route path="/login" element={<Login />} />

        <Route path="/admin-login" element={<AdminLogin />} />

        <Route path="/signup" element={<Signup />} />
        <Route path="/join" element={<CourseInvite />} />

        {/* STUDENT */}
        <Route
          path="/student"
          element={
            <ProtectedRoute roles={["student"]}>
              <StudentDashboardRoute />
            </ProtectedRoute>
          }
        />

        {/* TEACHER */}
        <Route
          path="/teacher"
          element={
            <ProtectedRoute roles={["teacher"]}>
              <TeacherDashboardRoute />
            </ProtectedRoute>
          }
        />

        {/* ADMIN */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

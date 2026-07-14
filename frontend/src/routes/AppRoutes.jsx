import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "../pages/Landing";

import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";

import StudentDashboard from "../pages/student/StudentDashboard";
import TeacherDashboard from "../pages/teacher/TeacherDashboard";
import AdminDashboard from "../pages/admin/AdminDashboard";

import ProtectedRoute from "./ProtectedRoute";

// Providers
import { StudentWorkspaceProvider } from "../contexts/StudentWorkspaceContext";
import { TeacherWorkspaceProvider } from "../contexts/TeacherWorkspaceContext";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public Pages */}
        <Route path="/" element={<Landing />} />

        <Route path="/login" element={<Login />} />

        <Route path="/signup" element={<Signup />} />

        {/* STUDENT */}
        <Route
          path="/student"
          element={
            <StudentWorkspaceProvider>
              <StudentDashboard />
            </StudentWorkspaceProvider>
          }
        />

        {/* TEACHER */}
        <Route
          path="/teacher"
          element={
            
              <TeacherWorkspaceProvider>
                <TeacherDashboard />
              </TeacherWorkspaceProvider>
            
          }
        />

        {/* ADMIN */}
        <Route
          path="/admin"
          element={
            
              <AdminDashboard />
            
          }
        />

      </Routes>
    </BrowserRouter>
  );
}
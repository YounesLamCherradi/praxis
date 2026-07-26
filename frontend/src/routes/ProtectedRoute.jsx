import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({
  children,
  roles = [],
}) {
  const { user } = useAuth();
  const location = useLocation();

  // Not logged in
  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  // Wrong role
  if (roles.length && !roles.includes(user.role)) {
    const destination =
      user.role === "teacher"
        ? "/teacher"
        : user.role === "student"
          ? "/student"
          : user.role === "admin"
            ? "/admin"
            : "/";
    return <Navigate to={destination} replace />;
  }

  return children;
}

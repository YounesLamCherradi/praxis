import { StudentWorkspaceProvider } from "../contexts/StudentWorkspaceContext";
import StudentDashboard from "../pages/student/StudentDashboard";

export default function StudentDashboardRoute() {
  return (
    <StudentWorkspaceProvider>
      <StudentDashboard />
    </StudentWorkspaceProvider>
  );
}

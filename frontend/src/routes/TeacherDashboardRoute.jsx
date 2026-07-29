import { TeacherWorkspaceProvider } from "../contexts/TeacherWorkspaceContext";
import TeacherDashboard from "../pages/teacher/TeacherDashboard";

export default function TeacherDashboardRoute() {
  return (
    <TeacherWorkspaceProvider>
      <TeacherDashboard />
    </TeacherWorkspaceProvider>
  );
}

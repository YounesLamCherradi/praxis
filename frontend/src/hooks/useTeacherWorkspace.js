import { useContext } from "react";
import { TeacherWorkspaceContext } from "../contexts/TeacherWorkspaceContextBase";

export function useTeacherWorkspace() {
  return useContext(TeacherWorkspaceContext);
}

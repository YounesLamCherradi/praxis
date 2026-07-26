import { useContext } from "react";
import { StudentWorkspaceContext } from "../contexts/StudentWorkspaceContextBase";

export function useStudentWorkspace() {
  return useContext(StudentWorkspaceContext);
}

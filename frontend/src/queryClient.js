import { QueryClient } from "@tanstack/react-query";

function shouldRetry(failureCount, error) {
  const status = Number(error?.status || 0);
  if ([400, 401, 403, 404, 409, 422].includes(status)) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});

export const queryKeys = {
  teacherCourses: ["teacher", "courses"],
  studentCourses: ["student", "courses"],
  teacherRubrics: ["teacher", "rubrics"],
  courseMessages: ["teacher", "course-messages"],
  classAssignments: (classId) => ["classes", String(classId), "assignments"],
  studentSubmissions: ["student", "submissions"],
  allTeacherSubmissions: ["teacher", "submissions"],
  teacherSubmissions: (classId) => ["teacher", String(classId), "submissions"],
};

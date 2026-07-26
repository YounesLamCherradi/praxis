function normalizeCourse(row = {}) {
  const members = (Array.isArray(row.class_members) ? row.class_members : [])
    .filter((entry) => entry?.profiles)
    .map((entry) => ({
      id: entry.profiles.id || entry.student_id,
      studentId: entry.student_id || entry.profiles.id,
      studentName: entry.profiles.name || "Student",
      studentEmail: entry.profiles.email || "",
      status: entry.status || "approved",
    }));

  return {
    ...row,
    id: row.id,
    name: row.name || "Untitled course",
    code: row.invite_code || row.inviteCode || row.code || "",
    description: row.description || "",
    semester: row.semester || "Course",
    isPublished: row.is_published !== false && row.isPublished !== false,
    archived: row.archived === true,
    teacherId: row.teacher_id || row.teacherId || null,
    members,
  };
}

async function request(path, options = {}) {
  return requestJson(path, options, { errorPrefix: "Course request failed" });
}

export async function getTeacherCourses() {
  const data = await request("/api/classes");
  return (Array.isArray(data.classes) ? data.classes : []).map(normalizeCourse);
}

export async function createTeacherCourse(course = {}) {
  const data = await request("/api/classes", {
    method: "POST",
    body: JSON.stringify({
      name: course.name,
      description: course.description,
      semester: course.semester,
      isPublished: course.isPublished !== false,
      inviteCode: course.code || course.inviteCode || "",
    }),
  });
  return normalizeCourse(data.class);
}

export async function deleteTeacherCourse(courseId) {
  return request(`/api/classes/${encodeURIComponent(courseId)}`, {
    method: "DELETE",
  });
}

export async function joinCourseByCode(code) {
  const data = await request("/api/classes/join-by-code", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return {
    ...data,
    class: normalizeCourse(data.class),
  };
}

export async function getStudentCourses() {
  const data = await request("/api/student/classes");
  return {
    classes: (Array.isArray(data.classes) ? data.classes : []).map(normalizeCourse),
    pendingClasses: (Array.isArray(data.pendingClasses) ? data.pendingClasses : []).map(normalizeCourse),
  };
}

export async function sendCourseMessage(courseId, message = {}) {
  return request(`/api/classes/${encodeURIComponent(courseId)}/messages`, {
    method: "POST",
    body: JSON.stringify(message),
  });
}

export async function getCourseMessages() {
  const data = await request("/api/course-messages");
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function saveCourseMessageDraft(draft = {}) {
  const data = await request("/api/course-messages/drafts", {
    method: "POST",
    body: JSON.stringify(draft),
  });
  return data.message;
}

export async function deleteCourseMessage(messageId) {
  return request(`/api/course-messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
  });
}
import { requestJson } from "./auth.js";

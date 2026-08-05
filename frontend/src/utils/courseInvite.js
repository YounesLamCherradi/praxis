export function normalizeCourseInviteCode(value) {
  return String(value || "").trim().toUpperCase();
}

let pendingInviteCode = "";

export function rememberPendingCourseInvite(value) {
  const code = normalizeCourseInviteCode(value);
  if (!code) return "";
  pendingInviteCode = code;
  return code;
}

export function getPendingCourseInvite() {
  return pendingInviteCode;
}

export function clearPendingCourseInvite() {
  pendingInviteCode = "";
}

export function buildCourseInvitePath(courseOrCode) {
  const code = normalizeCourseInviteCode(
    typeof courseOrCode === "object"
      ? courseOrCode?.code || courseOrCode?.invite_code
      : courseOrCode
  );

  return code ? `/join?code=${encodeURIComponent(code)}` : "";
}

const DEFAULT_INVITE_ORIGIN = "https://praxisproject.netlify.app";

export function buildCourseInviteUrl(courseOrCode, origin = DEFAULT_INVITE_ORIGIN) {
  const path = buildCourseInvitePath(courseOrCode);
  if (!path) return "";
  return origin ? `${String(origin).replace(/\/+$/, "")}${path}` : path;
}

export function buildCourseInviteMessage(course, origin, instructorName) {
  const code = normalizeCourseInviteCode(course?.code || course?.invite_code);
  const url = buildCourseInviteUrl(course, origin);

  return [
    `You are invited to join ${course?.name || "a course"} on Praxis.`,
    "",
    `Course: ${course?.name || "Course"}`,
    `Instructor: ${instructorName || course?.instructorName || course?.teacherName || "Instructor"}`,
    `Term: ${course?.semester || "Course"}`,
    `Join link: ${url}`,
    `Access code: ${code}`,
    "",
    "Open the link to join immediately. If you already have an account, please sign in. If you do not have an account, create an account and Praxis will continue the invitation automatically.",
  ].join("\n");
}

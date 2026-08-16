import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { createPortal } from "react-dom";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Database,
  Download,
  Eye,
  ImagePlus,
  FileClock,
  FileText,
  FlaskConical,
  GraduationCap,
  KeyRound,
  Layers,
  LogOut,
  Megaphone,
  Menu,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext.jsx";

import {
  getPraxisData,
  savePraxisData,
} from "../../services/praxisMockStore";
import { createBugReport } from "../../services/reportApi";
import { authenticatedFetch } from "../../services/auth";

/* =========================================================
   CONSTANTS
========================================================= */

const CEFR_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "Unknown",
];


const ADMIN_PRELIMINARY_COHORTS = {
  A0: {
    typingRate: [45, 115],
    longPauses: [18, 58],
    localRevisions: [2, 18],
    productProcessRatio: [0.62, 0.94],
    pasteShare: [0, 0.18],
  },
  A1: {
    typingRate: [55, 125],
    longPauses: [15, 52],
    localRevisions: [3, 20],
    productProcessRatio: [0.60, 0.94],
    pasteShare: [0, 0.18],
  },
  A2: {
    typingRate: [70, 145],
    longPauses: [10, 42],
    localRevisions: [4, 24],
    productProcessRatio: [0.58, 0.93],
    pasteShare: [0, 0.16],
  },
  B1: {
    typingRate: [85, 170],
    longPauses: [6, 32],
    localRevisions: [6, 30],
    productProcessRatio: [0.55, 0.92],
    pasteShare: [0, 0.14],
  },
  B2: {
    typingRate: [105, 205],
    longPauses: [4, 26],
    localRevisions: [8, 35],
    productProcessRatio: [0.52, 0.91],
    pasteShare: [0, 0.12],
  },
  C1: {
    typingRate: [120, 235],
    longPauses: [3, 20],
    localRevisions: [10, 40],
    productProcessRatio: [0.50, 0.90],
    pasteShare: [0, 0.10],
  },
  C2: {
    typingRate: [130, 255],
    longPauses: [2, 18],
    localRevisions: [12, 45],
    productProcessRatio: [0.48, 0.90],
    pasteShare: [0, 0.10],
  },
};

const ADMIN_PROCESS_METRICS = [
  {
    key: "typingRate",
    label: "Typing rate",
    unit: "chars/min",
    rangeKey: "typingRate",
  },
  {
    key: "longPausesPer100w",
    label: "Long pauses",
    unit: "per 100w",
    rangeKey: "longPauses",
  },
  {
    key: "localRevisionsPer100w",
    label: "Local revisions",
    unit: "per 100w",
    rangeKey: "localRevisions",
  },
  {
    key: "productProcessRatio",
    label: "Product/process ratio",
    unit: "",
    rangeKey: "productProcessRatio",
  },
  {
    key: "pasteShare",
    label: "Paste share",
    unit: "",
    rangeKey: "pasteShare",
  },
];

/*
 * Temporary visual fallback only.
 * Real PostgreSQL values automatically replace these as soon as
 * /api/admin/writing-process/benchmarks has measured cohort data.
 */
const ADMIN_DEMO_BENCHMARK_DATA = {
  A2: {
    level: "A2",
    included: 13,
    total: 21,
    measured: {
      typingRate: 42,
      longPausesPer100w: 78.4,
      localRevisionsPer100w: 9.3,
      productProcessRatio: 0.8,
      pasteShare: 0,
    },
  },
  B1: {
    level: "B1",
    included: 40,
    total: 71,
    measured: {
      typingRate: 69,
      longPausesPer100w: 56.2,
      localRevisionsPer100w: 6.5,
      productProcessRatio: 0.8,
      pasteShare: 0,
    },
  },
  B2: {
    level: "B2",
    included: 22,
    total: 24,
    measured: {
      typingRate: 58,
      longPausesPer100w: 47.2,
      localRevisionsPer100w: 7,
      productProcessRatio: 0.7,
      pasteShare: 0.3,
    },
  },
  C2: {
    level: "C2",
    included: 0,
    total: 2,
    measured: {
      typingRate: null,
      longPausesPer100w: null,
      localRevisionsPer100w: null,
      productProcessRatio: null,
      pasteShare: null,
    },
  },
};

const ADMIN_TEACHER_VIEW_KEY =
  "praxis_admin_view_as_teacher";

const MOCK_DATA_EVENT =
  "praxis-data-changed";

const BUG_SCREENSHOT_TYPES =
  new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
  ]);

const BUG_SCREENSHOT_MAX_BYTES =
  3 * 1024 * 1024;

/* =========================================================
   SAFE HELPERS
========================================================= */

function formatBugFileSize(
  bytes = 0
) {
  const size =
    Number(bytes || 0);

  if (size < 1024) {
    return `${size} B`;
  }

  if (
    size <
    1024 * 1024
  ) {
    return `${Math.round(
      size / 1024
    )} KB`;
  }

  return `${(
    size /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function readBugScreenshot(
  file
) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl:
            String(
              reader.result ||
                ""
            ),
        });
      };

      reader.onerror = () => {
        reject(
          new Error(
            "The screenshot could not be read."
          )
        );
      };

      reader.readAsDataURL(
        file
      );
    }
  );
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeComparable(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeAssignmentStatus(
  assignment
) {
  const value = normalizeComparable(
    assignment?.status ||
      assignment?.publicationStatus ||
      assignment?.state
  );

  if (
    value === "published" ||
    value === "active" ||
    assignment?.isPublished === true ||
    assignment?.published === true
  ) {
    return "Published";
  }

  return "Draft";
}

function normalizeSubmissionStatus(
  status
) {
  const value = normalizeComparable(
    status || "Not Started"
  );

  if (value === "graded") {
    return "Graded";
  }

  if (value === "submitted") {
    return "Submitted";
  }

  if (value === "late") {
    return "Late";
  }

  if (value === "missing") {
    return "Missing";
  }

  if (value === "reopened") {
    return "Reopened";
  }

  if (
    value === "draft" ||
    value === "in progress"
  ) {
    return "In Progress";
  }

  return "Not Started";
}

function getReadableDate(value) {
  if (!value) {
    return " - ";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(value) {
  const clean = String(
    value || "Account"
  ).trim();

  const pieces = clean
    .replace(/@.*/, "")
    .split(/[.\s_-]+/)
    .filter(Boolean);

  if (pieces.length === 0) {
    return "AC";
  }

  if (pieces.length === 1) {
    return pieces[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return pieces
    .slice(0, 2)
    .map((piece) =>
      piece[0]?.toUpperCase()
    )
    .join("");
}

function uniqueBy(
  values,
  keySelector
) {
  const seen = new Set();

  return values.filter((value) => {
    const key = keySelector(value);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function average(values) {
  const numeric = values
    .map(Number)
    .filter(Number.isFinite);

  if (numeric.length === 0) {
    return 0;
  }

  return (
    numeric.reduce(
      (sum, value) => sum + value,
      0
    ) / numeric.length
  );
}

function roundNumber(value, digits = 1) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const multiplier =
    10 ** digits;

  return (
    Math.round(
      numeric * multiplier
    ) / multiplier
  );
}

function getSubmissionText(
  submission
) {
  return String(
    submission?.submittedText ??
      submission?.finalText ??
      submission?.final_text ??
      submission?.content ??
      submission?.draftText ??
      submission?.draft_text ??
      ""
  );
}

function countWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function getSubmissionEvidence(
  submission
) {
  return Boolean(
    submission?.submittedAt ||
      submission?.resubmittedAt ||
      getSubmissionText(
        submission
      ).trim()
  );
}

function isCurrentAttempt(
  submission
) {
  return (
    submission?.isCurrent !== false
  );
}

function getAttemptNumber(
  submission
) {
  return Math.max(
    1,
    Number(
      submission?.attemptNumber ||
        submission?.attempt ||
        1
    ) || 1
  );
}

function getStudentKey(student) {
  return (
    normalizeEmail(
      student?.email ||
        student?.studentEmail
    ) ||
    String(
      student?.id ||
        student?.studentId ||
        ""
    )
  );
}

function getTeacherKey(instructor) {
  return (
    normalizeEmail(
      instructor?.email ||
        instructor?.teacherEmail
    ) ||
    String(
      instructor?.id ||
        instructor?.teacherId ||
        ""
    )
  );
}

function getClassTeacherKey(
  course
) {
  return (
    normalizeEmail(
      course?.teacherEmail ||
        course?.instructorEmail ||
        course?.ownerEmail
    ) ||
    String(
      course?.teacherId ||
        course?.teacher_id ||
        course?.ownerId ||
        ""
    )
  );
}

function classMatchesAssignment(
  course,
  assignment
) {
  const sameId =
    course?.id &&
    assignment?.classId &&
    String(course.id) ===
      String(
        assignment.classId
      );

  const sameLegacyId =
    course?.id &&
    assignment?.class_id &&
    String(course.id) ===
      String(
        assignment.class_id
      );

  const sameCode =
    course?.code &&
    assignment?.classCode &&
    normalizeComparable(
      course.code
    ) ===
      normalizeComparable(
        assignment.classCode
      );

  return Boolean(
    sameId ||
      sameLegacyId ||
      sameCode
  );
}

function classMatchesEnrollment(
  course,
  enrollment
) {
  const sameId =
    course?.id &&
    enrollment?.classId &&
    String(course.id) ===
      String(
        enrollment.classId
      );

  const sameLegacyId =
    course?.id &&
    enrollment?.class_id &&
    String(course.id) ===
      String(
        enrollment.class_id
      );

  const sameCode =
    course?.code &&
    enrollment?.classCode &&
    normalizeComparable(
      course.code
    ) ===
      normalizeComparable(
        enrollment.classCode
      );

  return Boolean(
    sameId ||
      sameLegacyId ||
      sameCode
  );
}

function assignmentMatchesSubmission(
  assignment,
  submission
) {
  return (
    assignment?.id &&
    String(assignment.id) ===
      String(
        submission?.assignmentId ||
          submission?.assignment_id ||
          ""
      )
  );
}

function getAssignmentLevel(
  assignment
) {
  const raw = String(
    assignment?.languageLevel ||
      assignment?.language_level ||
      assignment?.studentLevel ||
      assignment?.student_level ||
      assignment?.cefrLevel ||
      assignment?.cefr_level ||
      assignment?.level ||
      "Unknown"
  ).toUpperCase();

  return CEFR_LEVELS.includes(raw)
    ? raw
    : "Unknown";
}

function getWritingEvents(
  submission
) {
  return safeArray(
    submission?.writingEvents ||
      submission?.writing_events ||
      submission?.events
  );
}

function getPasteEvents(
  submission
) {
  const explicit = [
    ...safeArray(
      submission?.copyPasteLogs
    ),
    ...safeArray(
      submission?.pasteEvents
    ),
    ...safeArray(
      submission?.paste_evidence
    ),
  ];

  const recordedEvents = [
    ...getWritingEvents(submission),
    ...safeArray(
      submission?.keystrokeLog ||
      submission?.keystroke_log
    ),
  ];

  const detected = recordedEvents.filter((event) => {
    const type = String(
      event?.type ||
      event?.eventType ||
      event?.event_type ||
      event?.action ||
      event?.kind ||
      ""
    ).toLowerCase();

    return type.includes("paste");
  });

  return explicit.length
    ? explicit
    : detected;
}

function getCoachMessages(
  submission
) {
  return safeArray(
    submission?.planningChatMessages ||
      submission?.planningCoachHistory ||
      submission?.chatHistory ||
      submission?.chat_history
  );
}

function getFeedbackHistory(
  submission
) {
  return safeArray(
    submission?.feedbackHistory ||
      submission?.feedback_history ||
      submission?.aiFeedbackHistory ||
      submission?.feedbackResponses
  );
}

function getReflectionText(
  submission
) {
  return String(
    submission?.studentReflection ||
      submission?.finalReflection ||
      submission?.reflectionText ||
      submission?.reflection ||
      ""
  ).trim();
}

function getDurationSeconds(
  submission
) {
  const direct = Number(
    submission?.writingDurationSeconds ||
      submission?.durationSeconds ||
      submission?.activeWritingSeconds
  );

  if (
    Number.isFinite(direct) &&
    direct >= 0
  ) {
    return direct;
  }

  const events =
    getWritingEvents(submission);

  const times = events
    .map((event) =>
      new Date(
        event?.createdAt ||
          event?.timestamp ||
          event?.at ||
          0
      ).getTime()
    )
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (times.length < 2) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (times[times.length - 1] -
        times[0]) /
        1000
    )
  );
}

function getStatusClass(status) {
  if (
    status === "Published" ||
    status === "Active" ||
    status === "Graded"
  ) {
    return (
      "border-blue-200 " +
      "bg-blue-50 text-blue-700"
    );
  }

  if (
    status === "Submitted"
  ) {
    return (
      "border-indigo-200 " +
      "bg-indigo-50 text-indigo-700"
    );
  }

  if (
    status === "Draft" ||
    status === "In Progress"
  ) {
    return (
      "border-slate-200 " +
      "bg-slate-50 text-slate-600"
    );
  }

  if (
    status === "Late" ||
    status === "Reopened"
  ) {
    return (
      "border-amber-200 " +
      "bg-amber-50 text-amber-700"
    );
  }

  if (
    status === "Missing" ||
    status === "Excluded"
  ) {
    return (
      "border-red-200 " +
      "bg-red-50 text-red-700"
    );
  }

  return (
    "border-slate-200 " +
    "bg-slate-50 text-slate-500"
  );
}

function notifyMockDataChanged() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      MOCK_DATA_EVENT
    )
  );
}

/* =========================================================
   DERIVATION HELPERS
========================================================= */

function deriveWorkspaceUsers({
  storedUsers,
  enrollments,
  submissions,
}) {
  const userMap = new Map();

  function addUser(user) {
    const email = normalizeEmail(
      user?.email
    );

    if (!email) {
      return;
    }

    const existing =
      userMap.get(email);

    userMap.set(email, {
      id:
        existing?.id ||
        user?.id ||
        `usr_${email}`,
      name:
        user?.name ||
        existing?.name ||
        email,
      email,
      role:
        normalizeComparable(
          user?.role
        ) ||
        existing?.role ||
        "student",
      source:
        existing?.source
          ? `${existing.source}, ${
              user?.source ||
              "Workspace"
            }`
          : user?.source ||
            "Workspace",
      lastSeen:
        user?.lastSeen ||
        existing?.lastSeen ||
        null,
    });
  }

  storedUsers.forEach(
    (user) =>
      addUser({
        ...user,
        source:
          user?.source ||
          "Stored",
      })
  );

  enrollments.forEach(
    (enrollment) =>
      addUser({
        id:
          enrollment?.studentId ||
          enrollment?.student_id ||
          enrollment?.id,
        name:
          enrollment?.studentName ||
          enrollment?.name ||
          "Student",
        email:
          enrollment?.studentEmail ||
          enrollment?.email,
        role: "student",
        source: "Enrollment",
        lastSeen:
          enrollment?.enrolledAt ||
          enrollment?.createdAt,
      })
  );

  submissions.forEach(
    (submission) =>
      addUser({
        id:
          submission?.studentId ||
          submission?.student_id ||
          submission?.id,
        name:
          submission?.studentName ||
          "Student",
        email:
          submission?.studentEmail,
        role: "student",
        source: "Submission",
        lastSeen:
          submission?.resubmittedAt ||
          submission?.submittedAt ||
          submission?.updatedAt ||
          submission?.createdAt,
      })
  );

  return Array.from(
    userMap.values()
  );
}

function deriveInstructors({
  users,
  classes,
  assignments,
  enrollments,
}) {
  const teacherMap = new Map();

  function ensureTeacher(
    instructor
  ) {
    const key =
      getTeacherKey(instructor);

    if (!key) {
      return null;
    }

    const existing =
      teacherMap.get(key);

    const next = {
      id:
        existing?.id ||
        instructor?.id ||
        instructor?.teacherId ||
        key,
      key,
      name:
        instructor?.name ||
        instructor?.teacherName ||
        existing?.name ||
        instructor?.email ||
        "Instructor",
      email:
        normalizeEmail(
          instructor?.email ||
            instructor?.teacherEmail
        ) ||
        existing?.email ||
        "",
    };

    teacherMap.set(
      key,
      next
    );

    return next;
  }

  users
    .filter(
      (user) =>
        user.role === "teacher"
    )
    .forEach(ensureTeacher);

  classes.forEach((course) => {
    const teacherKey =
      getClassTeacherKey(
        course
      );

    if (teacherKey) {
      ensureTeacher({
        id:
          course?.teacherId ||
          course?.teacher_id ||
          teacherKey,
        name:
          course?.teacherName ||
          course?.instructorName ||
          course?.ownerName ||
          course?.teacherEmail ||
          teacherKey,
        email:
          course?.teacherEmail ||
          course?.instructorEmail ||
          course?.ownerEmail,
      });
    }
  });

  if (
    teacherMap.size === 0 &&
    classes.length > 0
  ) {
    ensureTeacher({
      id: "teacher_default",
      name: "Instructor Account",
      email:
        "instructor@aui.ma",
    });
  }

  const defaultTeacher =
    teacherMap.values().next()
      .value || null;

  return Array.from(
    teacherMap.values()
  )
    .map((instructor) => {
      const teacherClasses =
        classes.filter(
          (course) => {
            const classKey =
              getClassTeacherKey(
                course
              );

            if (!classKey) {
              return (
                defaultTeacher?.key ===
                instructor.key
              );
            }

            return (
              classKey ===
              instructor.key
            );
          }
        );

      const teacherAssignments =
        assignments.filter(
          (assignment) =>
            teacherClasses.some(
              (course) =>
                classMatchesAssignment(
                  course,
                  assignment
                )
            )
        );

      const teacherStudents =
        uniqueBy(
          enrollments
            .filter((enrollment) =>
              teacherClasses.some(
                (course) =>
                  classMatchesEnrollment(
                    course,
                    enrollment
                  )
              )
            )
            .map((enrollment) => ({
              id:
                enrollment?.studentId ||
                enrollment?.student_id ||
                enrollment?.id,
              name:
                enrollment?.studentName ||
                "Student",
              email:
                enrollment?.studentEmail,
            })),
          getStudentKey
        );

      return {
        ...instructor,
        classes:
          teacherClasses,
        assignments:
          teacherAssignments,
        students:
          teacherStudents,
      };
    })
    .sort((a, b) =>
      a.name.localeCompare(
        b.name
      )
    );
}

function deriveClassStudents({
  course,
  enrollments,
  submissions,
  users,
  adminStudentFlags,
}) {
  const studentMap = new Map();

  function addStudent(student) {
    const key =
      getStudentKey(student);

    if (!key) {
      return;
    }

    const existing =
      studentMap.get(key);

    const flags =
      adminStudentFlags?.[
        key
      ] || {};

    studentMap.set(key, {
      id:
        existing?.id ||
        student?.id ||
        student?.studentId ||
        key,
      key,
      name:
        student?.name ||
        student?.studentName ||
        existing?.name ||
        student?.email ||
        "Student",
      email:
        normalizeEmail(
          student?.email ||
            student?.studentEmail
        ) ||
        existing?.email ||
        "",
      isTestAccount:
        Boolean(
          flags.isTestAccount
        ),
      excludeFromResearch:
        Boolean(
          flags.excludeFromResearch
        ),
    });
  }

  enrollments
    .filter((enrollment) =>
      classMatchesEnrollment(
        course,
        enrollment
      )
    )
    .forEach(
      (enrollment) =>
        addStudent({
          id:
            enrollment?.studentId ||
            enrollment?.student_id ||
            enrollment?.id,
          name:
            enrollment?.studentName ||
            "Student",
          email:
            enrollment?.studentEmail,
        })
    );

  const courseAssignmentIds =
    new Set(
      safeArray(
        course?.assignments
      ).map(String)
    );

  submissions
    .filter((submission) => {
      if (
        courseAssignmentIds.size > 0
      ) {
        return courseAssignmentIds.has(
          String(
            submission?.assignmentId ||
              submission?.assignment_id
          )
        );
      }

      return (
        normalizeComparable(
          submission?.classCode
        ) ===
          normalizeComparable(
            course?.code
          )
      );
    })
    .forEach(addStudent);

  users
    .filter(
      (user) =>
        user.role === "student"
    )
    .forEach((user) => {
      const key =
        getStudentKey(user);

      if (
        key &&
        studentMap.has(key)
      ) {
        addStudent(user);
      }
    });

  return Array.from(
    studentMap.values()
  ).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function groupAssignmentSubmissions(
  submissions
) {
  const grouped = new Map();

  submissions.forEach(
    (submission) => {
      const key =
        getStudentKey(
          submission
        ) ||
        `submission_${submission.id}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped
        .get(key)
        .push(submission);
    }
  );

  return Array.from(
    grouped.entries()
  )
    .map(([studentKey, attempts]) => {
      const sorted = [...attempts].sort(
        (a, b) => {
          const currentDifference =
            Number(
              b?.isCurrent === true
            ) -
            Number(
              a?.isCurrent === true
            );

          if (
            currentDifference !== 0
          ) {
            return currentDifference;
          }

          const attemptDifference =
            getAttemptNumber(b) -
            getAttemptNumber(a);

          if (
            attemptDifference !== 0
          ) {
            return attemptDifference;
          }

          return (
            new Date(
              b?.updatedAt ||
                b?.resubmittedAt ||
                b?.submittedAt ||
                0
            ).getTime() -
            new Date(
              a?.updatedAt ||
                a?.resubmittedAt ||
                a?.submittedAt ||
                0
            ).getTime()
          );
        }
      );

      const current =
        sorted.find(
          (attempt) =>
            attempt?.isCurrent ===
            true
        ) ||
        sorted[0] ||
        null;

      return {
        studentKey,
        studentName:
          current?.studentName ||
          "Student",
        studentEmail:
          current?.studentEmail ||
          "",
        attempts: sorted,
        current,
      };
    })
    .sort((a, b) =>
      a.studentName.localeCompare(
        b.studentName
      )
    );
}

function buildProcessMetrics({
  submission,
  assignment,
}) {
  const writingEvents =
    getWritingEvents(submission);

  const pasteEvents =
    getPasteEvents(submission);

  const coachMessages =
    getCoachMessages(submission);

  const feedbackHistory =
    getFeedbackHistory(submission);

  return {
    submissionId:
      submission?.id,
    assignmentId:
      assignment?.id ||
      submission?.assignmentId ||
      submission?.assignment_id,
    studentKey:
      getStudentKey(
        submission
      ),
    classCode:
      assignment?.classCode ||
      submission?.classCode ||
      "",
    assignmentTitle:
      assignment?.title ||
      submission?.assignmentTitle ||
      "Assignment",
    cefrLevel:
      getAssignmentLevel(
        assignment || {}
      ),
    status:
      normalizeSubmissionStatus(
        submission?.status
      ),
    attempt:
      getAttemptNumber(
        submission
      ),
    wordCount:
      Number(
        submission?.wordCount
      ) ||
      countWords(
        getSubmissionText(
          submission
        )
      ),
    writingEvents:
      writingEvents.length,
    pasteEvents:
      pasteEvents.length,
    coachMessages:
      coachMessages.length,
    feedbackRequests:
      feedbackHistory.length,
    durationSeconds:
      getDurationSeconds(
        submission
      ),
    submittedAt:
      submission?.resubmittedAt ||
      submission?.resubmitted_at ||
      submission?.submittedAt ||
      submission?.submitted_at ||
      submission?.updatedAt ||
      submission?.updated_at ||
      submission?.createdAt ||
      submission?.created_at ||
      null,
  };
}

/* =========================================================
   CSV HELPERS
========================================================= */

function csvEscape(value) {
  const text = String(
    value ?? ""
  );

  if (
    /[",\n\r]/.test(text)
  ) {
    return `"${text.replace(
      /"/g,
      '""'
    )}"`;
  }

  return text;
}

function downloadCsv(
  filename,
  rows
) {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    throw new Error(
      "There is no eligible data to export."
    );
  }

  const headers =
    Object.keys(rows[0]);

  const csv = [
    headers
      .map(csvEscape)
      .join(","),
    ...rows.map((row) =>
      headers
        .map((header) =>
          csvEscape(row[header])
        )
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob(
    [csv],
    {
      type:
        "text/csv;charset=utf-8",
    }
  );

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function AdminDashboard() {

  const [adminCefrBenchmarks, setAdminCefrBenchmarks] =
    useState({});

  const [adminCefrBenchmarksLoading, setAdminCefrBenchmarksLoading] =
    useState(false);

  const [adminCefrBenchmarksError, setAdminCefrBenchmarksError] =
    useState("");

  const [adminAssignmentTypes, setAdminAssignmentTypes] =
    useState([]);

  const [adminAssignmentTypesLoading, setAdminAssignmentTypesLoading] =
    useState(false);

  const [adminAssignmentTypesError, setAdminAssignmentTypesError] =
    useState("");


  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    signOut,
    user: authUser,
    profile: authProfile,
  } = useAuth();

  const [activeTab, setActiveTab] =
    useState("overview");

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(false);

  const [data, setData] =
    useState(() =>
      getPraxisData()
    );

  const [remoteTeachers, setRemoteTeachers] = useState([]);
  const [remoteClassDetails, setRemoteClassDetails] = useState({});
  const [hasLoadedRemoteAdmin, setHasLoadedRemoteAdmin] = useState(false);
  const [isLoadingAdminData, setIsLoadingAdminData] = useState(true);

  const [
    selectedTeacherKey,
    setSelectedTeacherKey,
  ] = useState(null);

  const [
    selectedClassId,
    setSelectedClassId,
  ] = useState(null);

  const [
    selectedAssignmentId,
    setSelectedAssignmentId,
  ] = useState(null);

  const [
    selectedSubmissionId,
    setSelectedSubmissionId,
  ] = useState(null);

  const [
    teacherSearch,
    setTeacherSearch,
  ] = useState("");

  const [
    classStudentSearch,
    setClassStudentSearch,
  ] = useState("");

  const [
    systemMessage,
    setSystemMessage,
  ] = useState("");

  const [
    systemError,
    setSystemError,
  ] = useState("");

  const [
    isAccountMenuOpen,
    setIsAccountMenuOpen,
  ] = useState(false);

  const [
    isPasswordPanelOpen,
    setIsPasswordPanelOpen,
  ] = useState(false);

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    passwordUiMessage,
    setPasswordUiMessage,
  ] = useState("");

  const [
    isBugReportOpen,
    setIsBugReportOpen,
  ] = useState(false);

  const [
    bugDescription,
    setBugDescription,
  ] = useState("");

  const [
    bugScreenshot,
    setBugScreenshot,
  ] = useState(null);

  const [
    bugReportError,
    setBugReportError,
  ] = useState("");

  const [
    bugReportSuccess,
    setBugReportSuccess,
  ] = useState("");

  const [
    isSubmittingBugReport,
    setIsSubmittingBugReport,
  ] = useState(false);

  const [
    bugFileInputKey,
    setBugFileInputKey,
  ] = useState(0);

  const remoteClasses = useMemo(
    () => remoteTeachers.flatMap((teacher) =>
      safeArray(teacher.classes).map((course) => ({
        ...course,
        teacherId: course.teacherId || course.teacher_id || teacher.id,
        teacher_id: course.teacher_id || course.teacherId || teacher.id,
        teacherName: teacher.name,
        teacherEmail: teacher.email || "",
      }))
    ),
    [remoteTeachers]
  );

  const remoteDetailValues = useMemo(
    () => Object.values(remoteClassDetails),
    [remoteClassDetails]
  );

  const remoteAssignments = useMemo(
    () => remoteDetailValues.flatMap((detail) => safeArray(detail.assignments)),
    [remoteDetailValues]
  );

  const remoteSubmissions = useMemo(
    () => remoteDetailValues.flatMap((detail) => safeArray(detail.submissions)),
    [remoteDetailValues]
  );

  const remoteEnrollments = useMemo(
    () => remoteDetailValues.flatMap((detail) =>
      safeArray(detail.members).map((student) => ({
        id: `${detail.classId}:${student.id}`,
        classId: detail.classId,
        class_id: detail.classId,
        studentId: student.id,
        student_id: student.id,
        studentName: student.name,
        studentEmail: student.email || "",
      }))
    ),
    [remoteDetailValues]
  );

  const remoteUsers = useMemo(
    () => [
      ...remoteTeachers.map((teacher) => ({
        id: teacher.id,
        name: teacher.name,
        email: teacher.email || "",
        role: "teacher",
      })),
      ...remoteDetailValues.flatMap((detail) =>
        safeArray(detail.members).map((student) => ({
          id: student.id,
          name: student.name,
          email: student.email || "",
          role: "student",
        }))
      ),
    ],
    [remoteTeachers, remoteDetailValues]
  );

  const classes = hasLoadedRemoteAdmin
    ? remoteClasses
    : safeArray(data.classes);

  const enrollments = hasLoadedRemoteAdmin
    ? remoteEnrollments
    : safeArray(data.enrollments);

  const assignments = hasLoadedRemoteAdmin
    ? remoteAssignments
    : safeArray(data.assignments);

  const submissions = hasLoadedRemoteAdmin
    ? remoteSubmissions
    : safeArray(data.submissions);

  const storedUsers = hasLoadedRemoteAdmin
    ? remoteUsers
    : safeArray(data.users);

  const processAnalyses =
    safeArray(
      data.processAnalyses
    );

  const adminStudentFlags = useMemo(() => {
    if (!hasLoadedRemoteAdmin) {
      return data.adminStudentFlags || {};
    }

    return Object.fromEntries(
      remoteDetailValues.flatMap((detail) =>
        safeArray(detail.members).map((student) => [
          getStudentKey(student),
          {
            isTestAccount: Boolean(student.is_test_account),
            excludeFromResearch: Boolean(student.exclude_from_writing_behavior),
          },
        ])
      )
    );
  }, [data.adminStudentFlags, hasLoadedRemoteAdmin, remoteDetailValues]);

  const withdrawalLog =
    safeArray(
      data.researchWithdrawalLog
    );

  const currentAdminName =
    authProfile?.full_name ||
    authProfile?.fullName ||
    authProfile?.name ||
    authUser?.user_metadata
      ?.full_name ||
    "Admin Account";

  const currentAdminEmail =
    normalizeEmail(
      authProfile?.email ||
        authUser?.email ||
        "admin@aui.ma"
    );

  useEffect(() => {
    refreshData();

    function handleStorageChange(
      event
    ) {
      if (
        !event.key ||
        event.key ===
          "praxis_mock_data"
      ) {
        refreshData();
      }
    }

    function handleFocus() {
      refreshData();
    }

    window.addEventListener(
      "storage",
      handleStorageChange
    );

    window.addEventListener(
      "focus",
      handleFocus
    );

    window.addEventListener(
      MOCK_DATA_EVENT,
      handleFocus
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorageChange
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );

      window.removeEventListener(
        MOCK_DATA_EVENT,
        handleFocus
      );
    };
  }, []);

  const workspaceUsers =
    useMemo(
      () =>
        deriveWorkspaceUsers({
          storedUsers,
          enrollments,
          submissions,
        }),
      [
        storedUsers,
        enrollments,
        submissions,
      ]
    );

  const instructors =
    useMemo(() => {
      const derived = deriveInstructors({
          users:
            workspaceUsers,
          classes,
          assignments,
          enrollments,
        });

      if (!hasLoadedRemoteAdmin) {
        return derived;
      }

      const derivedById = new Map(
        derived.map((instructor) => [String(instructor.id), instructor])
      );

      return remoteTeachers.map((teacher) => {
        const current = derivedById.get(String(teacher.id));
        return {
          id: teacher.id,
          key: getTeacherKey(teacher) || String(teacher.id),
          name: teacher.name || "Instructor",
          email: teacher.email || "",
          classes: current?.classes || safeArray(teacher.classes),
          assignments: current?.assignments || [],
          students: current?.students || [],
          assignmentCount: Number(teacher.assignmentCount || 0),
          studentCount: Number(teacher.studentCount || 0),
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
    }, [
        workspaceUsers,
        classes,
        assignments,
        enrollments,
        hasLoadedRemoteAdmin,
        remoteTeachers,
      ]);

  const selectedTeacher =
    useMemo(
      () =>
        instructors.find(
          (instructor) =>
            instructor.key ===
            selectedTeacherKey
        ) || null,
      [
        instructors,
        selectedTeacherKey,
      ]
    );

  const selectedClass =
    useMemo(
      () =>
        classes.find(
          (course) =>
            String(course.id) ===
            String(
              selectedClassId
            )
        ) || null,
      [
        classes,
        selectedClassId,
      ]
    );

  const selectedClassAssignments =
    useMemo(
      () =>
        selectedClass
          ? assignments.filter(
              (assignment) =>
                classMatchesAssignment(
                  selectedClass,
                  assignment
                )
            )
          : [],
      [
        selectedClass,
        assignments,
      ]
    );

  const selectedClassStudents =
    useMemo(
      () =>
        selectedClass
          ? deriveClassStudents({
              course:
                selectedClass,
              enrollments,
              submissions,
              users:
                workspaceUsers,
              adminStudentFlags,
            })
          : [],
      [
        selectedClass,
        enrollments,
        submissions,
        workspaceUsers,
        adminStudentFlags,
      ]
    );

  const selectedClassSubmissions =
    useMemo(
      () => {
        const assignmentIds =
          new Set(
            selectedClassAssignments.map(
              (assignment) =>
                String(
                  assignment.id
                )
            )
          );

        return submissions.filter(
          (submission) =>
            assignmentIds.has(
              String(
                submission?.assignmentId ||
                  submission?.assignment_id
              )
            )
        );
      },
      [
        selectedClassAssignments,
        submissions,
      ]
    );

  const selectedAssignment =
    useMemo(
      () =>
        selectedClassAssignments.find(
          (assignment) =>
            String(assignment.id) ===
            String(
              selectedAssignmentId
            )
        ) || null,
      [
        selectedClassAssignments,
        selectedAssignmentId,
      ]
    );

  const selectedAssignmentSubmissions =
    useMemo(
      () =>
        selectedAssignment
          ? submissions.filter(
              (submission) =>
                assignmentMatchesSubmission(
                  selectedAssignment,
                  submission
                )
            )
          : [],
      [
        selectedAssignment,
        submissions,
      ]
    );

  const selectedSubmission =
    useMemo(
      () =>
        selectedAssignmentSubmissions.find(
          (submission) =>
            String(submission.id) ===
            String(
              selectedSubmissionId
            )
        ) || null,
      [
        selectedAssignmentSubmissions,
        selectedSubmissionId,
      ]
    );

  const filteredInstructors =
    useMemo(
      () => {
        const search =
          normalizeComparable(
            teacherSearch
          );

        return instructors.filter(
          (instructor) =>
            !search ||
            normalizeComparable(
              instructor.name
            ).includes(search) ||
            normalizeComparable(
              instructor.email
            ).includes(search)
        );
      },
      [
        instructors,
        teacherSearch,
      ]
    );

  const filteredClassStudents =
    useMemo(
      () => {
        const search =
          normalizeComparable(
            classStudentSearch
          );

        return selectedClassStudents.filter(
          (student) =>
            !search ||
            normalizeComparable(
              student.name
            ).includes(search) ||
            normalizeComparable(
              student.email
            ).includes(search)
        );
      },
      [
        selectedClassStudents,
        classStudentSearch,
      ]
    );

  const assignmentById =
    useMemo(
      () =>
        new Map(
          assignments.map(
            (assignment) => [
              String(
                assignment.id
              ),
              assignment,
            ]
          )
        ),
      [assignments]
    );

  const eligibleSubmissions =
    useMemo(
      () =>
        submissions.filter(
          (submission) => {
            const key =
              getStudentKey(
                submission
              );

            const flags =
              adminStudentFlags[
                key
              ] || {};

            const status =
              normalizeSubmissionStatus(
                submission?.status
              );

            return (
              !flags.isTestAccount &&
              !flags.excludeFromResearch &&
              isCurrentAttempt(
                submission
              ) &&
              [
                "Submitted",
                "Late",
                "Graded",
              ].includes(status) &&
              getSubmissionEvidence(
                submission
              )
            );
          }
        ),
      [
        submissions,
        adminStudentFlags,
      ]
    );

  const processMetricRows =
    useMemo(
      () =>
        eligibleSubmissions.map(
          (submission) => {
            const assignment =
              assignmentById.get(
                String(
                  submission?.assignmentId ||
                    submission?.assignment_id
                )
              );

            return buildProcessMetrics({
              submission,
              assignment,
            });
          }
        ),
      [
        eligibleSubmissions,
        assignmentById,
      ]
    );

  const cefrBenchmarks =
    useMemo(
      () =>
        CEFR_LEVELS.map(
          (level) => {
            const rows =
              processMetricRows.filter(
                (row) =>
                  row.cefrLevel ===
                  level
              );

            return {
              level,
              submissions:
                rows.length,
              averageWords:
                roundNumber(
                  average(
                    rows.map(
                      (row) =>
                        row.wordCount
                    )
                  )
                ),
              averageDurationMinutes:
                roundNumber(
                  average(
                    rows.map(
                      (row) =>
                        row.durationSeconds /
                        60
                    )
                  )
                ),
              averageWritingEvents:
                roundNumber(
                  average(
                    rows.map(
                      (row) =>
                        row.writingEvents
                    )
                  )
                ),
              averagePasteEvents:
                roundNumber(
                  average(
                    rows.map(
                      (row) =>
                        row.pasteEvents
                    )
                  )
                ),
              averageCoachMessages:
                roundNumber(
                  average(
                    rows.map(
                      (row) =>
                        row.coachMessages
                    )
                  )
                ),
            };
          }
        ),
      [processMetricRows]
    );

  const pendingReviewCount =
    useMemo(
      () =>
        submissions.filter(
          (submission) => {
            const status =
              normalizeSubmissionStatus(
                submission?.status
              );

            return (
              isCurrentAttempt(
                submission
              ) &&
              [
                "Submitted",
                "Late",
              ].includes(status) &&
              getSubmissionEvidence(
                submission
              )
            );
          }
        ).length,
      [submissions]
    );

  const stats =
    useMemo(
      () => ({
        instructors:
          instructors.length,
        classes:
          classes.length,
        assignments:
          assignments.length,
        students:
          uniqueBy(
            workspaceUsers.filter(
              (user) =>
                user.role ===
                "student"
            ),
            getStudentKey
          ).length,
        submissions:
          submissions.length,
        pendingReviews:
          pendingReviewCount,
        eligibleResearchSubmissions:
          eligibleSubmissions.length,
        excludedStudents:
          Object.values(
            adminStudentFlags
          ).filter(
            (flags) =>
              flags
                ?.excludeFromResearch
          ).length,
        testAccounts:
          Object.values(
            adminStudentFlags
          ).filter(
            (flags) =>
              flags?.isTestAccount
          ).length,
      }),
      [
        instructors,
        classes,
        assignments,
        workspaceUsers,
        submissions,
        pendingReviewCount,
        eligibleSubmissions,
        adminStudentFlags,
      ]
    );


  async function loadAdminAssignmentTypes() {
    setAdminAssignmentTypesLoading(true);

    try {
      const response = await authenticatedFetch(
        "/api/assignment-types",
        {
          credentials: "include",
        }
      );

      const payload = await response.json();

      if (!response.ok || payload?.error) {
        throw new Error(
          payload?.error ||
            "Could not load assignment types."
        );
      }

      setAdminAssignmentTypes(
        safeArray(payload?.types)
      );

      setAdminAssignmentTypesError("");
    } catch (error) {
      setAdminAssignmentTypesError(
        error?.message ||
          "Could not load assignment types."
      );
    } finally {
      setAdminAssignmentTypesLoading(false);
    }
  }


  async function addAdminAssignmentType(value) {
    const normalized =
      String(value || "").trim();

    if (normalized.length < 2) {
      setAdminAssignmentTypesError(
        "Enter an assignment type of at least 2 characters."
      );

      return false;
    }

    try {
      const response = await authenticatedFetch(
        "/api/admin/assignment-types",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            value: normalized,
          }),
        }
      );

      const payload = await response.json();

      if (!response.ok || payload?.error) {
        throw new Error(
          payload?.error ||
            "Could not save assignment type."
        );
      }

      setAdminAssignmentTypes(
        safeArray(payload?.types)
      );

      setAdminAssignmentTypesError("");

      setSystemMessage(
        `"${normalized}" added to the shared assignment type list.`
      );

      setSystemError("");

      return true;
    } catch (error) {
      setAdminAssignmentTypesError(
        error?.message ||
          "Could not save assignment type."
      );

      return false;
    }
  }


  async function removeAdminAssignmentType(type) {
    if (!type?.id) {
      return;
    }

    try {
      const response = await authenticatedFetch(
        `/api/admin/assignment-types/${encodeURIComponent(type.id)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const payload = await response.json();

      if (!response.ok || payload?.error) {
        throw new Error(
          payload?.error ||
            "Could not delete assignment type."
        );
      }

      setAdminAssignmentTypes(
        safeArray(payload?.types)
      );

      setAdminAssignmentTypesError("");

      setSystemMessage(
        `"${type.value}" removed from the shared assignment type list.`
      );

      setSystemError("");
    } catch (error) {
      setAdminAssignmentTypesError(
        error?.message ||
          "Could not delete assignment type."
      );
    }
  }


  async function loadAdminCefrBenchmarks() {
    setAdminCefrBenchmarksLoading(true);

    try {
      const response = await authenticatedFetch(
        "/api/admin/writing-process/benchmarks",
        {
          credentials: "include",
        }
      );

      const payload = await response.json();

      if (!response.ok || payload?.error) {
        throw new Error(
          payload?.error ||
            "Could not load writing process benchmark data."
        );
      }

      setAdminCefrBenchmarks(
        payload?.byLevel &&
          typeof payload.byLevel === "object"
          ? payload.byLevel
          : {}
      );

      setAdminCefrBenchmarksError("");
    } catch (error) {
      setAdminCefrBenchmarksError(
        error?.message ||
          "Could not load writing process benchmark data."
      );
    } finally {
      setAdminCefrBenchmarksLoading(false);
    }
  }

  async function refreshData() {
    setData(getPraxisData());
    setIsLoadingAdminData(true);

    loadAdminCefrBenchmarks();
    loadAdminAssignmentTypes();

    try {
      const response = await authenticatedFetch("/api/admin/teachers", {
        credentials: "include",
      });
      const payload = await response.json();

      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || "Could not load instructors.");
      }

      setRemoteTeachers(safeArray(payload?.teachers));
      setHasLoadedRemoteAdmin(true);
      setSystemError("");
    } catch (error) {
      setSystemError(
        error?.message || "Could not load instructors from the server."
      );
    } finally {
      setIsLoadingAdminData(false);
    }
  }

  async function loadRemoteClassDetail(classId) {
    if (!classId || remoteClassDetails[String(classId)]) {
      return;
    }

    setIsLoadingAdminData(true);
    try {
      const response = await authenticatedFetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/detail`,
        { credentials: "include" }
      );
      const payload = await response.json();

      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || "Could not load course details.");
      }

      setRemoteClassDetails((current) => ({
        ...current,
        [String(classId)]: {
          classId,
          assignments: safeArray(payload?.assignments),
          members: safeArray(payload?.members),
          submissions: safeArray(payload?.submissions),
        },
      }));
      setSystemError("");
    } catch (error) {
      setSystemError(error?.message || "Could not load course details.");
    } finally {
      setIsLoadingAdminData(false);
    }
  }

  function persistData(
    nextData,
    message = ""
  ) {
    savePraxisData(
      nextData
    );

    setData(nextData);

    notifyMockDataChanged();

    if (message) {
      setSystemMessage(
        message
      );

      setSystemError("");
    }
  }

  function openOverview() {
    setIsSidebarOpen(false);

    setActiveTab(
      "overview"
    );

    resetHierarchy();
  }

  function openInstructors() {
    setIsSidebarOpen(false);

    setActiveTab(
      "instructors"
    );

    resetHierarchy();
  }

  function resetHierarchy() {
    setSelectedTeacherKey(
      null
    );

    setSelectedClassId(
      null
    );

    setSelectedAssignmentId(
      null
    );

    setSelectedSubmissionId(
      null
    );
  }

  function selectTeacher(
    instructor
  ) {
    setSelectedTeacherKey(
      instructor.key
    );

    setSelectedClassId(
      null
    );

    setSelectedAssignmentId(
      null
    );

    setSelectedSubmissionId(
      null
    );
  }

  function selectClass(course) {
    setSelectedClassId(
      course.id
    );

    if (hasLoadedRemoteAdmin) {
      loadRemoteClassDetail(course.id);
    }

    setSelectedAssignmentId(
      null
    );

    setSelectedSubmissionId(
      null
    );
  }

  function selectAssignment(
    assignment
  ) {
    setSelectedAssignmentId(
      assignment.id
    );

    setSelectedSubmissionId(
      null
    );
  }

  function backFromHierarchy() {
    if (
      selectedAssignmentId
    ) {
      setSelectedAssignmentId(
        null
      );

      setSelectedSubmissionId(
        null
      );

      return;
    }

    if (selectedClassId) {
      setSelectedClassId(
        null
      );

      setSelectedAssignmentId(
        null
      );

      return;
    }

    if (selectedTeacherKey) {
      setSelectedTeacherKey(
        null
      );
    }
  }

  function openPasswordPanel() {
    setIsAccountMenuOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordUiMessage("");
    setIsPasswordPanelOpen(true);
  }

  function closePasswordPanel() {
    setIsPasswordPanelOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordUiMessage("");
  }

  async function handlePasswordUiSubmit(
    event
  ) {
    event.preventDefault();

    if (
      newPassword.length < 10
    ) {
      setPasswordUiMessage(
        "Use at least 10 characters."
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setPasswordUiMessage(
        "The passwords do not match."
      );
      return;
    }

    setPasswordUiMessage("Updating password...");

    try {
      const response = await authenticatedFetch("/api/auth/update-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setPasswordUiMessage(
          data.error || "Could not update password right now."
        );
        return;
      }

      setPasswordUiMessage("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordUiMessage("Could not update password right now.");
    }
  }

  function resetBugReportForm() {
    setBugDescription("");
    setBugScreenshot(null);
    setBugReportError("");
    setBugReportSuccess("");

    setBugFileInputKey(
      (current) =>
        current + 1
    );
  }

  function openBugReportForm() {
    setIsSidebarOpen(false);
    resetBugReportForm();
    setIsBugReportOpen(true);
  }

  function closeBugReportForm() {
    if (
      isSubmittingBugReport
    ) {
      return;
    }

    setIsBugReportOpen(false);
    resetBugReportForm();
  }

  async function handleBugScreenshotChange(
    event
  ) {
    const file =
      event.target.files?.[0] ||
      null;

    setBugReportError("");
    setBugReportSuccess("");

    if (!file) {
      setBugScreenshot(null);
      return;
    }

    if (
      !BUG_SCREENSHOT_TYPES.has(
        file.type
      )
    ) {
      setBugScreenshot(null);

      setBugFileInputKey(
        (current) =>
          current + 1
      );

      setBugReportError(
        "Upload a PNG, JPG, or WebP picture only."
      );

      return;
    }

    if (
      file.size >
      BUG_SCREENSHOT_MAX_BYTES
    ) {
      setBugScreenshot(null);

      setBugFileInputKey(
        (current) =>
          current + 1
      );

      setBugReportError(
        "The picture must be 3 MB or smaller."
      );

      return;
    }

    try {
      const screenshot =
        await readBugScreenshot(
          file
        );

      setBugScreenshot(
        screenshot
      );
    } catch (error) {
      setBugScreenshot(null);

      setBugFileInputKey(
        (current) =>
          current + 1
      );

      setBugReportError(
        error?.message ||
          "The picture could not be uploaded."
      );
    }
  }

  function removeBugScreenshot() {
    setBugScreenshot(null);

    setBugFileInputKey(
      (current) =>
        current + 1
    );

    setBugReportError("");
  }

  async function handleBugReportSubmit(
    event
  ) {
    event.preventDefault();

    setBugReportError("");
    setBugReportSuccess("");

    const description =
      bugDescription.trim();

    if (
      description.length < 10
    ) {
      setBugReportError(
        "Please describe the issue in at least 10 characters."
      );
      return;
    }

    setIsSubmittingBugReport(true);

    try {
      const now =
        new Date().toISOString();

      const report = {
        id:
          `bug_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`,

        status: "open",
        priority: "normal",

        reporterRole: "admin",
        reporterName:
          currentAdminName,
        reporterEmail:
          currentAdminEmail,

        description,

        screenshot:
          bugScreenshot
            ? {
                ...bugScreenshot,
              }
            : null,

        route:
          typeof window !==
          "undefined"
            ? window.location.pathname
            : "/admin",

        adminTab:
          activeTab,

        selectedTeacherKey:
          selectedTeacher?.key ||
          null,

        selectedTeacherName:
          selectedTeacher?.name ||
          null,

        selectedClassId:
          selectedClass?.id ||
          null,

        selectedClassCode:
          selectedClass?.code ||
          null,

        selectedAssignmentId:
          selectedAssignment?.id ||
          null,

        selectedAssignmentTitle:
          selectedAssignment?.title ||
          null,

        selectedSubmissionId:
          selectedSubmission?.id ||
          null,

        createdAt: now,
        updatedAt: now,
      };

      await createBugReport(report);

      setBugReportSuccess(
        "Your issue was reported successfully."
      );

      setBugDescription("");
      setBugScreenshot(null);

      setBugFileInputKey(
        (current) =>
          current + 1
      );

      window.setTimeout(
        () => {
          setIsBugReportOpen(false);
          setBugReportSuccess("");
        },
        1100
      );
    } catch {
      setBugReportError(
        "The report could not be saved. Try a smaller picture or submit without a picture."
      );
    } finally {
      setIsSubmittingBugReport(false);
    }
  }

  async function handleLogout() {
    setIsAccountMenuOpen(false);

    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error(
        "Logout failed:",
        error
      );

      setSystemError(
        "Logout failed."
      );
    }
  }

  async function updateStudentFlags(
    student,
    patch
  ) {
    const key =
      getStudentKey(student);

    if (!key) {
      setSystemError(
        "This student has no stable identifier."
      );

      return;
    }

    if (hasLoadedRemoteAdmin) {
      try {
        const response = await authenticatedFetch(
          `/api/admin/students/${encodeURIComponent(student.id)}/flags`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(patch.isTestAccount !== undefined
                ? { isTestAccount: Boolean(patch.isTestAccount) }
                : {}),
              ...(patch.excludeFromResearch !== undefined
                ? { excludeFromWritingBehavior: Boolean(patch.excludeFromResearch) }
                : {}),
            }),
          }
        );
        const payload = await response.json();
        if (!response.ok || payload?.error) {
          throw new Error(payload?.error || "Could not update student research settings.");
        }

        setRemoteClassDetails((current) =>
          Object.fromEntries(Object.entries(current).map(([classId, detail]) => [
            classId,
            {
              ...detail,
              members: safeArray(detail.members).map((member) =>
                String(member.id) === String(student.id)
                  ? { ...member, ...payload.profile }
                  : member
              ),
            },
          ]))
        );
        setSystemMessage("Student research settings updated.");
        setSystemError("");
      } catch (error) {
        setSystemError(error?.message || "Could not update student research settings.");
      }
      return;
    }

    const currentFlags =
      adminStudentFlags[
        key
      ] || {};

    const nextFlags = {
      ...adminStudentFlags,
      [key]: {
        ...currentFlags,
        ...patch,
        updatedAt:
          new Date().toISOString(),
      },
    };

    persistData(
      {
        ...data,
        adminStudentFlags:
          nextFlags,
      },
      patch.isTestAccount !==
      undefined
        ? patch.isTestAccount
          ? "Student marked as a test account. Their submissions are excluded from research analytics."
          : "Student removed from the test-account group."
        : patch.excludeFromResearch
        ? "Student excluded from research exports and cohort analytics. Their Praxis experience is unchanged."
        : "Student included in research data again."
    );
  }

  function deleteStudentResearchData(
    student
  ) {
    const key =
      getStudentKey(student);

    if (!key) {
      return;
    }

    const confirmed =
      window.confirm(
        `Research withdrawal: permanently delete all submissions, process analyses, and class memberships for ${student.name || "this student"}?\n\nOnly anonymous deletion counts and the date will be logged. This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    const isMatchingStudent =
      (record) => {
        const recordKey =
          getStudentKey(
            record
          );

        return (
          recordKey === key
        );
      };

    const deletedSubmissions =
      submissions.filter(
        isMatchingStudent
      );

    const deletedSubmissionIds =
      new Set(
        deletedSubmissions.map(
          (submission) =>
            String(
              submission.id
            )
        )
      );

    const deletedMemberships =
      enrollments.filter(
        isMatchingStudent
      );

    const deletedAnalyses =
      processAnalyses.filter(
        (analysis) =>
          analysis?.studentKey ===
            key ||
          deletedSubmissionIds.has(
            String(
              analysis
                ?.submissionId
            )
          )
      );

    const nextFlags = {
      ...adminStudentFlags,
    };

    delete nextFlags[key];

    const nextWithdrawalLog = [
      ...withdrawalLog,
      {
        id:
          `withdrawal_${Date.now()}`,
        deletedAt:
          new Date().toISOString(),
        deleted: {
          submissions:
            deletedSubmissions.length,
          analyses:
            deletedAnalyses.length,
          memberships:
            deletedMemberships.length,
        },
      },
    ];

    persistData(
      {
        ...data,
        submissions:
          submissions.filter(
            (submission) =>
              !isMatchingStudent(
                submission
              )
          ),
        enrollments:
          enrollments.filter(
            (enrollment) =>
              !isMatchingStudent(
                enrollment
              )
          ),
        processAnalyses:
          processAnalyses.filter(
            (analysis) =>
              !(
                analysis?.studentKey ===
                  key ||
                deletedSubmissionIds.has(
                  String(
                    analysis
                      ?.submissionId
                  )
                )
              )
          ),
        adminStudentFlags:
          nextFlags,
        researchWithdrawalLog:
          nextWithdrawalLog,
      },
      `Research data deleted: ${deletedSubmissions.length} submissions, ${deletedAnalyses.length} analyses, and ${deletedMemberships.length} class memberships.`
    );
  }

  function recomputeProcessAnalyses() {
    const now =
      new Date().toISOString();

    const nextAnalyses =
      processMetricRows.map(
        (row) => ({
          id:
            `analysis_${row.submissionId}`,
          submissionId:
            row.submissionId,
          assignmentId:
            row.assignmentId,
          studentKey:
            row.studentKey,
          analysisVersion:
            "mock-old-logic-v1",
          status:
            "complete",
          metrics: {
            wordCount:
              row.wordCount,
            writingEvents:
              row.writingEvents,
            pasteEvents:
              row.pasteEvents,
            coachMessages:
              row.coachMessages,
            feedbackRequests:
              row.feedbackRequests,
            durationSeconds:
              row.durationSeconds,
          },
          cefrLevel:
            row.cefrLevel,
          calculatedAt: now,
          updatedAt: now,
        })
      );

    persistData(
      {
        ...data,
        processAnalyses:
          nextAnalyses,
        adminProcessAnalysisRun: {
          completedAt: now,
          processed:
            nextAnalyses.length,
          skipped:
            submissions.length -
            nextAnalyses.length,
          failed: 0,
        },
      },
      `Process analyses recomputed: ${nextAnalyses.length} eligible submissions processed.`
    );
  }

  function buildPseudonyms() {
    const keys =
      uniqueBy(
        processMetricRows,
        (row) =>
          row.studentKey
      )
        .map(
          (row) =>
            row.studentKey
        )
        .filter(Boolean)
        .sort();

    return new Map(
      keys.map(
        (key, index) => [
          key,
          `STU-${String(
            index + 1
          ).padStart(3, "0")}`,
        ]
      )
    );
  }

  function downloadProcessMetrics() {
    try {
      const pseudonyms =
        buildPseudonyms();

      const rows =
        processMetricRows.map(
          (row) => ({
            pseudonym:
              pseudonyms.get(
                row.studentKey
              ) || "STU-UNKNOWN",
            assignment_id:
              row.assignmentId,
            class_code:
              row.classCode,
            cefr_level:
              row.cefrLevel,
            attempt:
              row.attempt,
            status:
              row.status,
            word_count:
              row.wordCount,
            duration_seconds:
              row.durationSeconds,
            writing_events:
              row.writingEvents,
            paste_events:
              row.pasteEvents,
            coach_messages:
              row.coachMessages,
            feedback_requests:
              row.feedbackRequests,
            submitted_at:
              row.submittedAt ||
              "",
          })
        );

      downloadCsv(
        "praxis-process-metrics.csv",
        rows
      );

      setSystemMessage(
        "Pseudonymized process-metrics CSV downloaded."
      );

      setSystemError("");
    } catch (error) {
      setSystemError(
        error.message
      );

      setSystemMessage("");
    }
  }

  function downloadReflections() {
    try {
      const pseudonyms =
        buildPseudonyms();

      const rows =
        eligibleSubmissions
          .map((submission) => {
            const reflection =
              getReflectionText(
                submission
              );

            if (!reflection) {
              return null;
            }

            const assignment =
              assignmentById.get(
                String(
                  submission?.assignmentId ||
                    submission?.assignment_id
                )
              );

            const key =
              getStudentKey(
                submission
              );

            return {
              pseudonym:
                pseudonyms.get(
                  key
                ) ||
                "STU-UNKNOWN",
              assignment_id:
                assignment?.id ||
                submission?.assignmentId ||
                "",
              class_code:
                assignment?.classCode ||
                submission?.classCode ||
                "",
              cefr_level:
                getAssignmentLevel(
                  assignment || {}
                ),
              reflection,
              submitted_at:
                submission?.resubmittedAt ||
                submission?.submittedAt ||
                "",
            };
          })
          .filter(Boolean);

      downloadCsv(
        "praxis-student-reflections.csv",
        rows
      );

      setSystemMessage(
        "Pseudonymized student-reflections CSV downloaded."
      );

      setSystemError("");
    } catch (error) {
      setSystemError(
        error.message
      );

      setSystemMessage("");
    }
  }

  function handleViewAsTeacher(
    instructor
  ) {
    const payload = {
      teacherId:
        instructor.id,
      teacherKey:
        instructor.key,
      teacherName:
        instructor.name,
      teacherEmail:
        instructor.email,
      returnPath:
        location.pathname ||
        "/admin",
      createdAt:
        new Date().toISOString(),
    };

    navigate("/teacher", {
      state: {
        adminViewAsTeacher:
          payload,
      },
    });
  }

  function copyDevelopmentSnapshot() {
    const snapshot =
      JSON.stringify(
        data,
        null,
        2
      );

    navigator.clipboard
      ?.writeText(snapshot)
      .then(() => {
        setSystemMessage(
          "Development snapshot copied. It may contain identifiable mock data and must not be used as a research export."
        );

        setSystemError("");
      })
      .catch(() => {
        setSystemError(
          "Could not copy the development snapshot."
        );

        setSystemMessage("");
      });
  }

  const hierarchyTitle =
    selectedAssignment
      ? selectedAssignment.title
      : selectedClass
      ? selectedClass.name
      : selectedTeacher
      ? selectedTeacher.name
      : "Instructors";

  return (
    <div className="admin-dashboard relative h-screen w-screen overflow-hidden bg-[#F8FAFC] font-sans text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900 md:flex">
      <style>{`
        .admin-dashboard .font-serif,
        .admin-dashboard .font-mono {
          font-family: inherit;
        }

        .admin-dashboard .uppercase {
          text-transform: none;
        }

        .admin-dashboard .tracking-widest,
        .admin-dashboard .tracking-wider,
        .admin-dashboard .tracking-wide {
          letter-spacing: normal;
        }

        .blueprint-grid {
          background-image:
            linear-gradient(
              to right,
              rgba(37, 99, 235, 0.045) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(37, 99, 235, 0.045) 1px,
              transparent 1px
            );
          background-size: 3rem 3rem;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation:
            fadeInUp 0.35s
            cubic-bezier(
              0.16,
              1,
              0.3,
              1
            )
            both;
        }
      `}</style>

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close admin menu"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[1px] md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col justify-between border-r border-blue-100 bg-[#F6F9FF] text-slate-700 shadow-xl transition-transform duration-200 md:relative md:z-20 md:w-64 md:translate-x-0 ${
          isSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-blue-100/80 px-5 py-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <img
                src="/praxis-logo.png"
                alt="Praxis logo"
                className="h-9 w-9 object-contain"
              />
            </div>

            <div>
              <h1 className="text-xl font-bold leading-none tracking-tight">
                <span className="text-slate-900">pr</span>
                <span className="text-blue-600">a</span>
                <span className="text-slate-900">x</span>
                <span className="text-blue-600">i</span>
                <span className="text-slate-900">s</span>
              </h1>

              <p className="mt-1.5 text-xs font-medium text-slate-500">
                Your admin space
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-7 overflow-y-auto p-4">
            <div className="space-y-1.5">
              <span className="mb-2 block px-2 text-xs font-semibold text-slate-600">
                Oversight
              </span>

              <AdminNavButton
                active={
                  activeTab ===
                  "overview"
                }
                icon={BarChart3}
                label="Overview"
                onClick={() => {
                  setIsSidebarOpen(false);
                  setActiveTab("overview");
                  resetHierarchy();
                }}
              />

              <AdminNavButton
                active={
                  activeTab ===
                  "instructors"
                }
                icon={
                  GraduationCap
                }
                label="Instructors"
                badge={
                  stats.instructors
                }
                onClick={
                  openInstructors
                }
              />

              <AdminNavButton
                active={
                  activeTab ===
                  "research"
                }
                icon={
                  FlaskConical
                }
                label="Research"
                badge={
                  stats.eligibleResearchSubmissions
                }
                badgeTone="indigo"
                onClick={() => {
                  setIsSidebarOpen(false);

                  setActiveTab(
                    "research"
                  );

                  resetHierarchy();
                }}
              />
            </div>

          </div>
        </div>

        <div className="relative border-t border-blue-100 bg-white/60 p-4">
          {isAccountMenuOpen && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-4 right-4 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-100 px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-md shadow-blue-600/20">
                    {getInitials(currentAdminName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">
                      {currentAdminName}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] text-slate-400">
                      {currentAdminEmail}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1 p-2">
                <button
                  type="button"
                  onClick={
                    openPasswordPanel
                  }
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition-all hover:bg-blue-50 hover:text-blue-700"
                >
                  <KeyRound className="h-4 w-4 text-blue-600" />

                  <span className="flex-1">
                    Change Password
                  </span>

                </button>

                <button
                  type="button"
                  onClick={
                    handleLogout
                  }
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition-all hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={openBugReportForm}
            className="mb-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-500 transition-all hover:bg-white hover:text-blue-700"
            aria-label="Report a bug"
          >
            <Megaphone className="h-4 w-4 text-slate-400" />
            <span className="flex-1">Share feedback</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setIsAccountMenuOpen(
                (current) =>
                  !current
              )
            }
            className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
              isAccountMenuOpen
                ? "border-blue-200 bg-white shadow-sm"
                : "border-transparent hover:border-blue-100 hover:bg-white"
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-md shadow-blue-600/20">
              {getInitials(
                currentAdminName
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-medium text-slate-400">
                Welcome back,
              </p>
              <h4 className="truncate text-xs font-bold text-slate-800">
                {currentAdminName}
              </h4>
            </div>

            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                isAccountMenuOpen
                  ? "rotate-180 text-blue-600"
                  : ""
              }`}
            />
          </button>
        </div>
      </aside>

      <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-4 sm:px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-500">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 md:hidden"
              aria-label="Open admin menu"
              aria-expanded={isSidebarOpen}
            >
              {isSidebarOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>

            <span className="hidden sm:inline">
              Workspace
            </span>

            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-300 sm:inline" />

            <span className="truncate font-semibold text-slate-950">
              {activeTab ===
              "instructors"
                ? hierarchyTitle
                : `${activeTab.charAt(0).toUpperCase()}${activeTab.slice(1)}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={
                () => {
                  setIsSidebarOpen(false);
                  refreshData();
                }
              }
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </header>

        <div className="blueprint-grid relative flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8">
          <div className="relative z-10 mx-auto flex min-h-full max-w-7xl flex-col space-y-7">
            {(systemMessage ||
              systemError) && (
              <div
                className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${
                  systemError
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                }`}
              >
                {systemError ? (
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                )}

                <span className="flex-1">
                  {systemError ||
                    systemMessage}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setSystemMessage(
                      ""
                    );

                    setSystemError(
                      ""
                    );
                  }}
                  className="rounded-lg p-1 opacity-60 hover:bg-white hover:opacity-100"
                  aria-label="Dismiss message"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {activeTab ===
              "overview" && (
              <AdminOverview
                instructors={remoteTeachers}
                stats={stats}
                benchmarkData={adminCefrBenchmarks}
                benchmarkLoading={adminCefrBenchmarksLoading}
                benchmarkError={adminCefrBenchmarksError}
                assignmentTypes={adminAssignmentTypes}
                assignmentTypesLoading={adminAssignmentTypesLoading}
                assignmentTypesError={adminAssignmentTypesError}
                onAddAssignmentType={addAdminAssignmentType}
                onRemoveAssignmentType={removeAdminAssignmentType}
                onOpenInstructors={openInstructors}
                onOpenResearch={() => {
                  setActiveTab("research");
                  resetHierarchy();
                }}
              />
            )}

            {activeTab ===
              "instructors" && (
              <InstructorsHierarchy
                isLoading={isLoadingAdminData}
                instructors={
                  filteredInstructors
                }
                teacherSearch={
                  teacherSearch
                }
                setTeacherSearch={
                  setTeacherSearch
                }
                selectedTeacher={
                  selectedTeacher
                }
                selectedClass={
                  selectedClass
                }
                selectedAssignment={
                  selectedAssignment
                }
                selectedSubmission={
                  selectedSubmission
                }
                selectedClassAssignments={
                  selectedClassAssignments
                }
                selectedClassStudents={
                  filteredClassStudents
                }
                selectedClassSubmissions={
                  selectedClassSubmissions
                }
                selectedAssignmentSubmissions={
                  selectedAssignmentSubmissions
                }
                classStudentSearch={
                  classStudentSearch
                }
                setClassStudentSearch={
                  setClassStudentSearch
                }
                onSelectTeacher={
                  selectTeacher
                }
                onSelectClass={
                  selectClass
                }
                onSelectAssignment={
                  selectAssignment
                }
                onSelectSubmission={
                  setSelectedSubmissionId
                }
                onBack={
                  backFromHierarchy
                }
                onViewAsTeacher={
                  handleViewAsTeacher
                }
                onToggleTest={(
                  student
                ) =>
                  updateStudentFlags(
                    student,
                    {
                      isTestAccount:
                        !student.isTestAccount,
                    }
                  )
                }
                onToggleResearchExclusion={(
                  student
                ) =>
                  updateStudentFlags(
                    student,
                    {
                      excludeFromResearch:
                        !student.excludeFromResearch,
                    }
                  )
                }
                onResearchWithdrawal={
                  deleteStudentResearchData
                }
              />
            )}

            {activeTab ===
              "research" && (
              <ResearchPanel
                stats={stats}
                benchmarks={
                  cefrBenchmarks
                }
                analyses={
                  processAnalyses
                }
                lastRun={
                  data.adminProcessAnalysisRun ||
                  null
                }
                withdrawalLog={
                  withdrawalLog
                }
                onRecompute={
                  recomputeProcessAnalyses
                }
                onDownloadMetrics={
                  downloadProcessMetrics
                }
                onDownloadReflections={
                  downloadReflections
                }
              />
            )}

            {activeTab ===
              "exports" && (
              <ResearchExportsPanel
                withdrawalLog={withdrawalLog}
                onDownloadMetrics={downloadProcessMetrics}
                onDownloadReflections={downloadReflections}
              />
            )}
          </div>
        </div>
      </main>

      {isPasswordPanelOpen && (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
            <button
              type="button"
              onClick={closePasswordPanel}
              className="absolute right-5 top-5 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close password form"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
              <KeyRound className="h-6 w-6" />
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-bold text-slate-900">
                Change Password
              </h3>

              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Change your account password directly from this dashboard. No OTP is required while you are already signed in.
              </p>
            </div>

            <form
              onSubmit={
                handlePasswordUiSubmit
              }
              className="mt-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-new-password"
                  className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400"
                >
                  New password
                </label>

                <input
                  id="admin-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(
                      event.target.value
                    );

                    setPasswordUiMessage("");
                  }}
                  placeholder="At least 10 characters"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="admin-confirm-password"
                  className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400"
                >
                  Confirm password
                </label>

                <input
                  id="admin-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(
                      event.target.value
                    );

                    setPasswordUiMessage("");
                  }}
                  placeholder="Repeat the new password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {passwordUiMessage && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3 text-xs font-semibold text-blue-700">
                  {passwordUiMessage}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={
                    closePasswordPanel
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700"
                >
                  <KeyRound className="h-4 w-4" />
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBugReportOpen && (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={closeBugReportForm}
              disabled={isSubmittingBugReport}
              className="absolute right-5 top-5 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Close bug-report form"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600">
                <Bug className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Report a Bug
                </h3>

                <p className="max-w-lg text-xs leading-relaxed text-slate-500">
                  Describe what happened. Praxis automatically includes your current admin section and selected instructor, class, assignment, or submission context.
                </p>
              </div>

              <form
                onSubmit={handleBugReportSubmit}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-bug-description"
                    className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400"
                  >
                    What happened?
                  </label>

                  <textarea
                    id="admin-bug-description"
                    value={bugDescription}
                    disabled={isSubmittingBugReport}
                    onChange={(event) => {
                      setBugDescription(
                        event.target.value
                      );

                      if (bugReportError) {
                        setBugReportError("");
                      }

                      if (bugReportSuccess) {
                        setBugReportSuccess("");
                      }
                    }}
                    rows={5}
                    maxLength={1500}
                    placeholder="Example: I opened a class, but the assignment list did not load."
                    className="w-full resize-y rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3.5 text-sm leading-6 text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Include the action and what you expected.</span>

                    <span className="font-mono">
                      {bugDescription.length}/1500
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Picture
                      <span className="ml-1 normal-case tracking-normal text-slate-300">
                        optional
                      </span>
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      PNG, JPG, or WebP only · maximum 3 MB
                    </p>
                  </div>

                  {!bugScreenshot ? (
                    <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-7 text-center transition-all hover:border-blue-300 hover:bg-blue-50/50">
                      <input
                        key={bugFileInputKey}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={isSubmittingBugReport}
                        onChange={handleBugScreenshotChange}
                        className="sr-only"
                      />

                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600 shadow-sm transition-transform group-hover:-translate-y-0.5">
                        <ImagePlus className="h-5 w-5" />
                      </div>

                      <p className="mt-3 text-xs font-bold text-slate-700">
                        Upload a picture
                      </p>

                      <p className="mt-1 text-[10px] text-slate-400">
                        Click to choose a screenshot of the issue
                      </p>
                    </label>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <div className="relative bg-slate-950/5 p-3">
                        <img
                          src={bugScreenshot.dataUrl}
                          alt="Bug screenshot preview"
                          className="max-h-64 w-full rounded-xl border border-slate-200 bg-white object-contain"
                        />

                        <button
                          type="button"
                          onClick={removeBugScreenshot}
                          disabled={isSubmittingBugReport}
                          className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/95 text-slate-500 shadow-md transition-all hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Remove uploaded picture"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-700">
                            {bugScreenshot.name}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {formatBugFileSize(
                              bugScreenshot.size
                            )}
                          </p>
                        </div>

                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">
                          Picture ready
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {bugReportError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

                    <span className="font-semibold leading-relaxed">
                      {bugReportError}
                    </span>
                  </div>
                )}

                {bugReportSuccess && (
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

                    <span className="font-semibold leading-relaxed">
                      {bugReportSuccess}
                    </span>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeBugReportForm}
                    disabled={isSubmittingBugReport}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isSubmittingBugReport ||
                      bugDescription.trim().length < 10
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />

                    {isSubmittingBugReport
                      ? "Sending report..."
                      : "Send Report"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   OVERVIEW
========================================================= */

function OverviewPanel({
  stats,
  instructors,
  processMetricRows,
  onOpenInstructors,
  onOpenResearch,
}) {
  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Admin overview
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Monitor instructor workspaces and research-governance status without changing instructor-owned assignments or student submission statuses.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          icon={GraduationCap}
          label="Instructors"
          value={stats.instructors}
          description={`${stats.classes} classes`}
          tone="blue"
        />

        <AdminMetricCard
          icon={Users}
          label="Students"
          value={stats.students}
          description={`${stats.testAccounts} test accounts`}
          tone="sky"
        />

        <AdminMetricCard
          icon={BookOpen}
          label="Assignments"
          value={stats.assignments}
          description={`${stats.pendingReviews} pending instructor reviews`}
          tone="indigo"
        />

        <AdminMetricCard
          icon={FlaskConical}
          label="Research eligible"
          value={
            stats.eligibleResearchSubmissions
          }
          description={`${stats.excludedStudents} excluded students`}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Instructor workspaces"
          subtitle="Open an instructor to inspect their classes and assignments."
          rightAction={
            <button
              type="button"
              onClick={onOpenInstructors}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              View instructors
              <ChevronRight className="h-4 w-4" />
            </button>
          }
        >
          {instructors.length ===
          0 ? (
            <EmptyState text="No instructor workspaces found." />
          ) : (
            <div className="space-y-3">
              {instructors
                .slice(0, 5)
                .map((instructor) => (
                  <div
                    key={instructor.key}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-mono text-xs font-black text-white">
                        {getInitials(
                          instructor.name
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {instructor.name}
                        </p>

                        <p className="truncate font-mono text-[10px] text-slate-400">
                          {instructor.email ||
                            "No email"}{" "}
                          ·{" "}
                          {instructor.classes.length}{" "}
                          classes
                        </p>
                      </div>
                    </div>

                    <span className="font-mono text-[10px] font-bold text-blue-700">
                      {instructor.assignments.length}{" "}
                      assignments
                    </span>
                  </div>
                ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Research readiness"
          subtitle="Only eligible, current, genuinely submitted work enters research analytics."
          rightAction={
            <button
              type="button"
              onClick={onOpenResearch}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Research tools
              <ChevronRight className="h-4 w-4" />
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <MiniStat
              label="Eligible records"
              value={
                processMetricRows.length
              }
            />

            <MiniStat
              label="Submitted attempts"
              value={stats.submissions}
            />

            <MiniStat
              label="Test accounts"
              value={
                stats.testAccounts
              }
            />

            <MiniStat
              label="Research excluded"
              value={
                stats.excludedStudents
              }
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* =========================================================
   TEACHER HIERARCHY
========================================================= */


function AdminOverview({
  instructors = [],
  stats = {},
  benchmarkData = {},
  benchmarkLoading = false,
  benchmarkError = "",
  assignmentTypes = [],
  assignmentTypesLoading = false,
  assignmentTypesError = "",
  onAddAssignmentType,
  onRemoveAssignmentType,
  onOpenInstructors,
  onOpenResearch,
}) {
  const [newAssignmentType, setNewAssignmentType] =
    useState("");

  const [isAddingAssignmentType, setIsAddingAssignmentType] =
    useState(false);

  async function handleAddAssignmentType(event) {
    event.preventDefault();

    if (!newAssignmentType.trim()) {
      return;
    }

    setIsAddingAssignmentType(true);

    try {
      const saved =
        await onAddAssignmentType?.(
          newAssignmentType
        );

      if (saved) {
        setNewAssignmentType("");
      }
    } finally {
      setIsAddingAssignmentType(false);
    }
  }

  const teachers =
    safeArray(instructors);

  const realCourseCount =
    teachers.reduce(
      (sum, teacher) =>
        sum +
        Number(
          teacher?.classCount ??
            safeArray(teacher?.classes).length
        ),
      0
    );

  const realAssignmentCount =
    teachers.reduce(
      (sum, teacher) =>
        sum +
        Number(
          teacher?.assignmentCount ??
            safeArray(teacher?.assignments).length
        ),
      0
    );

  const studentIds = new Set();

  teachers.forEach((teacher) => {
    safeArray(teacher?.students).forEach(
      (student) => {
        const id =
          student?.id ||
          student?.studentId ||
          student?.student_id ||
          student?.email;

        if (id) {
          studentIds.add(String(id));
        }
      }
    );
  });

  const realStudentCount =
    studentIds.size ||
    teachers.reduce(
      (sum, teacher) =>
        sum +
        Number(
          teacher?.studentCount || 0
        ),
      0
    );

  /*
   * Keep existing operational data real.
   * Temporary fallback values only fill an empty pilot environment.
   */
  const cards = [
    {
      label: "Instructors",
      value:
        Number(stats?.instructors) ||
        teachers.length ||
        4,
      icon: GraduationCap,
    },
    {
      label: "Courses",
      value:
        realCourseCount || 7,
      icon: Layers,
    },
    {
      label: "Students",
      value:
        realStudentCount || 84,
      icon: Users,
    },
    {
      label: "Assignments",
      value:
        realAssignmentCount || 21,
      icon: BookOpen,
    },
  ];

  const realLevels =
    Object.keys(
      benchmarkData || {}
    ).filter(
      (level) =>
        benchmarkData?.[level]
    );

  // Temporary pilot mode.
  // Change to false when Praxis cohort data is ready for production display.
  const FORCE_PILOT_BENCHMARKS = true;

  const usingDemoBenchmarks =
    FORCE_PILOT_BENCHMARKS ||
    realLevels.length === 0;

  const displayedBenchmarks =
    usingDemoBenchmarks
      ? ADMIN_DEMO_BENCHMARK_DATA
      : benchmarkData;

  const displayLevels = [
    "A0",
    "A1",
    "A2",
    "B1",
    "B2",
    "C1",
    "C2",
  ].filter(
    (level) =>
      displayedBenchmarks?.[level]
  );

  function renderStatus(
    measured,
    range
  ) {
    if (
      measured === null ||
      measured === undefined ||
      !range
    ) {
      return (
        <span className="font-bold text-slate-300">
          —
        </span>
      );
    }

    if (Number(measured) < range[0]) {
      return (
        <span
          className="font-black text-red-600"
          title="Below benchmark range"
        >
          ▼
        </span>
      );
    }

    if (Number(measured) > range[1]) {
      return (
        <span
          className="font-black text-amber-600"
          title="Above benchmark range"
        >
          ▲
        </span>
      );
    }

    return (
      <span
        className="font-black text-emerald-600"
        title="Within benchmark range"
      >
        ✓
      </span>
    );
  }

  function formatMetric(
    value,
    unit
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return "no data";
    }

    return unit
      ? `${value} ${unit}`
      : String(value);
  }

  return (
    <div className="animate-fade-in-up space-y-6">

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
                Praxis administration
              </p>

              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-amber-700">
                Pilot
              </span>
            </div>

            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Admin — All Teachers
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Overview of teaching activity,
              submissions, and writing-process data.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenInstructors}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
          >
            <GraduationCap className="h-4 w-4" />
            View all instructors
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
          {cards.map(
            ({
              label,
              value,
              icon: Icon,
            }) => (
              <div
                key={label}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
                  <Icon className="h-3.5 w-3.5" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black leading-none tracking-tight text-slate-950">
                      {value}
                    </span>

                    <span className="truncate text-[11px] font-semibold text-slate-500">
                      {label}
                    </span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </section>


      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-950">
                Writing Process — CEFR Benchmark Comparison
              </h3>

              {usingDemoBenchmarks && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-medium text-blue-700">
                  All classes · 4 levels with data
                </span>
              )}
            </div>

            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Median measured values
              (included submissions only, ≥50 words)
              vs. placeholder benchmarks.
              {" "}
              <span className="font-bold text-emerald-600">
                ✓
              </span>
              {" "}within range,{" "}
              <span className="font-bold text-red-600">
                ▼
              </span>
              {" "}below,{" "}
              <span className="font-bold text-amber-600">
                ▲
              </span>
              {" "}above.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenResearch}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800"
          >
            Research
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {benchmarkLoading ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            Updating writing process analytics in the background…
          </div>
        ) : (
          <>
            {benchmarkError && (
              <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                Real benchmark data could not be loaded.
                Demo pilot data is shown temporarily.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left font-bold text-slate-500">
                      Metric
                    </th>

                    {displayLevels.map(
                      (level) => {
                        const data =
                          displayedBenchmarks[level];

                        return (
                          <th
                            key={level}
                            className="min-w-[125px] px-4 py-3 text-center"
                          >
                            <span className="text-sm font-black text-slate-900">
                              {level}
                            </span>

                            <br />

                            <span className="font-mono text-[9px] font-medium text-slate-400">
                              {Number(
                                data?.included ||
                                  0
                              )}{" "}
                              incl. /{" "}
                              {Number(
                                data?.total ||
                                  0
                              )}{" "}
                              total
                            </span>
                          </th>
                        );
                      }
                    )}
                  </tr>
                </thead>

                <tbody>
                  {ADMIN_PROCESS_METRICS.map(
                    (metric, index) => (
                      <tr
                        key={metric.key}
                        className={`border-b border-slate-100 ${
                          index % 2 === 0
                            ? "bg-slate-50/50"
                            : "bg-white"
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-700">
                          {metric.label}
                        </td>

                        {displayLevels.map(
                          (level) => {
                            const data =
                              displayedBenchmarks[
                                level
                              ];

                            const measured =
                              data?.measured?.[
                                metric.key
                              ];

                            const range =
                              ADMIN_PRELIMINARY_COHORTS[
                                level
                              ]?.[
                                metric.rangeKey
                              ];

                            return (
                              <td
                                key={`${metric.key}-${level}`}
                                className="px-4 py-3 text-center"
                              >
                                <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                                  {renderStatus(
                                    measured,
                                    range
                                  )}

                                  <span>
                                    {formatMetric(
                                      measured,
                                      metric.unit
                                    )}
                                  </span>
                                </div>

                                {range && (
                                  <p className="mt-1 font-mono text-[9px] text-slate-400">
                                    bench:{" "}
                                    {range[0]}–
                                    {range[1]}
                                  </p>
                                )}
                              </td>
                            );
                          }
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-blue-600" />

                    <h4 className="text-sm font-bold text-slate-900">
                      Research data exports
                    </h4>
                  </div>

                  <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">
                    De-identified CSVs for pilot reporting.
                    Rows use research-safe identifiers and exclude
                    test accounts and research-excluded students.
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <a
                    href="/api/admin/research/process-metrics.csv"
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 text-[11px] font-bold text-blue-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download process metrics CSV
                  </a>

                  <a
                    href="/api/admin/research/reflections.csv"
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 text-[11px] font-bold text-blue-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download reflections CSV
                  </a>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-200/70 pt-3">
                <p className="text-[10px] leading-5 text-slate-400">
                  Benchmarks are placeholder values bootstrapped
                  from L2 literature. Replace with Praxis cohort
                  data once sample sizes are sufficient.
                </p>
              </div>
            </div>
          </>
        )}
      </section>





      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-950">
              Assignment types
            </h3>

            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Custom types added here appear in every teacher's
              “Assignment type” dropdown, alongside the built-in ones.
            </p>
          </div>

          <form
            onSubmit={handleAddAssignmentType}
            className="flex w-full gap-2 sm:w-auto"
          >
            <input
              type="text"
              value={newAssignmentType}
              onChange={(event) =>
                setNewAssignmentType(
                  event.target.value
                )
              }
              maxLength={40}
              placeholder="New assignment type"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 sm:w-48"
            />

            <button
              type="submit"
              disabled={
                isAddingAssignmentType ||
                !newAssignmentType.trim()
              }
              className="shrink-0 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAddingAssignmentType
                ? "Adding..."
                : "+ Add type"}
            </button>
          </form>
        </div>

        <div className="border-t border-slate-100 px-5 py-3.5">
          {assignmentTypesError && (
            <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {assignmentTypesError}
            </div>
          )}

          {assignmentTypesLoading ? (
            <p className="text-xs text-slate-400">
              Loading assignment types...
            </p>
          ) : assignmentTypes.length === 0 ? (
            <p className="text-xs text-slate-400">
              No custom types yet. The built-in types are always available.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assignmentTypes.map(
                (type) => (
                  <div
                    key={type.id}
                    className="inline-flex items-center overflow-hidden rounded-lg border border-blue-100 bg-blue-50 text-xs font-semibold text-blue-700"
                  >
                    <span className="px-3 py-1.5">
                      {String(
                        type.value || ""
                      )
                        .split(" ")
                        .map(
                          (part) =>
                            part
                              ? part.charAt(0).toUpperCase() +
                                part.slice(1)
                              : part
                        )
                        .join(" ")}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        onRemoveAssignmentType?.(
                          type
                        )
                      }
                      className="border-l border-blue-100 px-2 py-1.5 text-blue-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${type.value}`}
                      title={`Remove ${type.value}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}


function InstructorsHierarchy({
  isLoading,
  instructors,
  teacherSearch,
  setTeacherSearch,
  selectedTeacher,
  selectedClass,
  selectedAssignment,
  selectedSubmission,
  selectedClassAssignments,
  selectedClassStudents,
  selectedClassSubmissions,
  selectedAssignmentSubmissions,
  classStudentSearch,
  setClassStudentSearch,
  onSelectTeacher,
  onSelectClass,
  onSelectAssignment,
  onSelectSubmission,
  onBack,
  onViewAsTeacher,
  onToggleTest,
  onToggleResearchExclusion,
  onResearchWithdrawal,
}) {
  if (!selectedTeacher) {
    return (
      <Panel
        title="Instructor Workspaces"
        subtitle="Select an instructor, then inspect their classes, assignments, students, submissions, and process evidence."
      >
        <div className="mb-4">
          <SearchInput
            value={teacherSearch}
            onChange={setTeacherSearch}
            placeholder="Search instructors..."
          />
        </div>

        {isLoading && instructors.length === 0 ? (
          <EmptyState text="Loading instructors..." />
        ) : instructors.length === 0 ? (
          <EmptyState text="No instructors found." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Instructor
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Email
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Classes
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Assignments
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Students
                    </th>
                    <th className="w-24 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {instructors.map((instructor) => (
                    <tr
                      key={instructor.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectTeacher(instructor)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectTeacher(instructor);
                        }
                      }}
                      className="group cursor-pointer bg-white transition-colors hover:bg-blue-50/50 focus:bg-blue-50/50 focus:outline-none"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-mono text-[11px] font-black text-white">
                            {getInitials(instructor.name)}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {instructor.name}
                            </p>
                            {instructor.is_test_account && (
                              <span className="mt-0.5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-700">
                                Test account
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] text-slate-500">
                          {instructor.email || "No email"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex min-w-8 justify-center rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700">
                          {instructor.classes.length}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex min-w-8 justify-center rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700">
                          {instructor.assignmentCount ?? instructor.assignments.length}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex min-w-8 justify-center rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700">
                          {instructor.studentCount ?? instructor.students.length}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition-colors group-hover:border-blue-200 group-hover:text-blue-700">
                          View
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
    );
  }

  if (!selectedClass) {
    return (
      <div className="animate-fade-in-up space-y-4">
        <HierarchyBackButton
          label="Back to Instructors"
          onClick={onBack}
        />

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-mono text-xs font-black text-white">
                  {getInitials(selectedTeacher.name)}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-slate-950">
                    {selectedTeacher.name}
                  </h2>

                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                    {selectedTeacher.email || "Email not available"}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onViewAsTeacher(
                  selectedTeacher
                )
              }
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
            >
              <Eye className="h-4 w-4" />
              View as Instructor
            </button>
          </div>

          <div className="flex flex-wrap gap-2 px-5 py-3">
            <span className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
              <Layers className="h-3.5 w-3.5" />
              {selectedTeacher.classes.length}
              {selectedTeacher.classes.length === 1 ? " Course" : " Courses"}
            </span>

            <span className="inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800">
              <BookOpen className="h-3.5 w-3.5" />
              {selectedTeacher.assignmentCount ?? selectedTeacher.assignments.length}
              {(selectedTeacher.assignmentCount ?? selectedTeacher.assignments.length) === 1
                ? " Assignment"
                : " Assignments"}
            </span>

            <span className="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
              <Users className="h-3.5 w-3.5" />
              {selectedTeacher.studentCount ?? selectedTeacher.students.length}
              {(selectedTeacher.studentCount ?? selectedTeacher.students.length) === 1
                ? " Student"
                : " Students"}
            </span>
          </div>
        </section>

        <Panel
          title="Courses"
          subtitle="Open a course to review its assignments, enrolled students, submissions, and activity."
        >
          {selectedTeacher.classes.length === 0 ? (
            <EmptyState text="This instructor has no courses." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Course
                      </th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Assignments
                      </th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Students
                      </th>
                      <th className="w-24 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {selectedTeacher.classes.map((course) => {
                      const assignmentCount =
                        course.assignmentCount ??
                        selectedTeacher.assignments.filter(
                          (assignment) =>
                            classMatchesAssignment(
                              course,
                              assignment
                            )
                        ).length;

                      const studentCount =
                        course.studentCount ?? 0;

                      return (
                        <tr
                          key={course.id}
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            onSelectClass(
                              course
                            )
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" ||
                              event.key === " "
                            ) {
                              event.preventDefault();

                              onSelectClass(
                                course
                              );
                            }
                          }}
                          className="group cursor-pointer bg-white transition-colors hover:bg-blue-50/50 focus:bg-blue-50/50 focus:outline-none"
                        >
                          <td className="px-4 py-3.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">
                                {course.name || "Untitled Course"}
                              </p>

                              {course.code && (
                                <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                                  {course.code}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex min-w-8 justify-center rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700">
                              {assignmentCount}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex min-w-8 justify-center rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700">
                              {studentCount}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition-colors group-hover:border-blue-200 group-hover:text-blue-700">
                              View
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  if (!selectedAssignment) {
    return (
      <div className="animate-fade-in-up space-y-5">
        <HierarchyBackButton
          label={`Back to ${selectedTeacher.name}`}
          onClick={onBack}
        />

        <Panel
          title={
            selectedClass.name ||
            "Class"
          }
          subtitle={`${selectedClass.code || "Course"} · ${selectedClass.semester || "Semester"}`}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdminMetricCard
              icon={BookOpen}
              label="Assignments"
              value={
                selectedClassAssignments.length
              }
              description="Instructor-owned writing tasks"
              tone="blue"
            />

            <AdminMetricCard
              icon={Users}
              label="Students"
              value={
                selectedClassStudents.length
              }
              description="Class members"
              tone="sky"
            />

            <AdminMetricCard
              icon={FileText}
              label="Attempts"
              value={
                selectedClassSubmissions.length
              }
              description="All stored submission attempts"
              tone="indigo"
            />
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel
            title="Assignments"
            subtitle="Inspect assignment submissions without editing instructor-owned status or publication settings."
          >
            {selectedClassAssignments.length ===
            0 ? (
              <EmptyState text="No assignments in this class." />
            ) : (
              <div className="space-y-3">
                {selectedClassAssignments.map(
                  (assignment) => {
                    const assignmentSubmissions =
                      selectedClassSubmissions.filter(
                        (submission) =>
                          assignmentMatchesSubmission(
                            assignment,
                            submission
                          )
                      );

                    const grouped =
                      groupAssignmentSubmissions(
                        assignmentSubmissions
                      );

                    const pending =
                      grouped.filter(
                        (group) => {
                          const current =
                            group.current;

                          const status =
                            normalizeSubmissionStatus(
                              current?.status
                            );

                          return (
                            current &&
                            [
                              "Submitted",
                              "Late",
                            ].includes(
                              status
                            ) &&
                            getSubmissionEvidence(
                              current
                            )
                          );
                        }
                      ).length;

                    return (
                      <button
                        key={
                          assignment.id
                        }
                        type="button"
                        onClick={() =>
                          onSelectAssignment(
                            assignment
                          )
                        }
                        className="group flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-left transition-all hover:border-blue-200 hover:bg-white"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {assignment.title ||
                              "Untitled Assignment"}
                          </p>

                          <p className="mt-1 font-mono text-[10px] text-slate-400">
                            {
                              grouped.length
                            }{" "}
                            students ·{" "}
                            {
                              assignmentSubmissions.length
                            }{" "}
                            attempts ·{" "}
                            {pending} pending
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <StatusBadge
                            status={normalizeAssignmentStatus(
                              assignment
                            )}
                          />

                          <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" />
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </Panel>

          <Panel
            title="Students and Research Controls"
            subtitle="Research flags are admin-only. They are invisible to instructors and do not change the student’s Praxis experience."
          >
            <div className="mb-4">
              <SearchInput
                value={
                  classStudentSearch
                }
                onChange={
                  setClassStudentSearch
                }
                placeholder="Search students..."
              />
            </div>

            {selectedClassStudents.length ===
            0 ? (
              <EmptyState text="No enrolled students found." />
            ) : (
              <div className="space-y-3">
                {selectedClassStudents.map(
                  (student) => (
                    <StudentResearchRow
                      key={
                        student.key
                      }
                      student={
                        student
                      }
                      onToggleTest={() =>
                        onToggleTest(
                          student
                        )
                      }
                      onToggleResearchExclusion={() =>
                        onToggleResearchExclusion(
                          student
                        )
                      }
                      onResearchWithdrawal={() =>
                        onResearchWithdrawal(
                          student
                        )
                      }
                    />
                  )
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    );
  }

  const grouped =
    groupAssignmentSubmissions(
      selectedAssignmentSubmissions
    );

  return (
    <div className="animate-fade-in-up space-y-5">
      <HierarchyBackButton
        label={`Back to ${selectedClass.name}`}
        onClick={onBack}
      />

      <Panel
        title={
          selectedAssignment.title ||
          "Assignment"
        }
        subtitle="Admin inspection is read-only. Grading, reopening, status changes, and publication remain instructor responsibilities."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <MiniStat
            label="Students"
            value={grouped.length}
          />

          <MiniStat
            label="Attempts"
            value={
              selectedAssignmentSubmissions.length
            }
          />

          <MiniStat
            label="Published"
            value={
              normalizeAssignmentStatus(
                selectedAssignment
              )
            }
          />

          <MiniStat
            label="CEFR"
            value={
              getAssignmentLevel(
                selectedAssignment
              )
            }
          />
        </div>
      </Panel>

      <Panel
        title="Student Submissions"
        subtitle="Inspect current and previous attempts together."
      >
        {grouped.length === 0 ? (
          <EmptyState text="No submissions found for this assignment." />
        ) : (
          <div className="space-y-3">
            {grouped.map(
              (group) => {
                const current =
                  group.current;

                const metrics =
                  current
                    ? buildProcessMetrics({
                        submission:
                          current,
                        assignment:
                          selectedAssignment,
                      })
                    : null;

                return (
                  <div
                    key={
                      group.studentKey
                    }
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-mono text-xs font-black text-white">
                          {getInitials(
                            group.studentName
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {group.studentName}
                          </p>

                          <p className="truncate font-mono text-[10px] text-slate-400">
                            {group.studentEmail ||
                              "No email"}{" "}
                            ·{" "}
                            {group.attempts.length}{" "}
                            attempt
                            {group.attempts.length ===
                            1
                              ? ""
                              : "s"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {current && (
                          <StatusBadge
                            status={normalizeSubmissionStatus(
                              current.status
                            )}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            onSelectSubmission(
                              current?.id ||
                                group.attempts[0]
                                  ?.id
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                          Inspect
                        </button>
                      </div>
                    </div>

                    {metrics && (
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 md:grid-cols-5">
                        <MiniStat
                          label="Words"
                          value={
                            metrics.wordCount
                          }
                        />

                        <MiniStat
                          label="Writing events"
                          value={
                            metrics.writingEvents
                          }
                        />

                        <MiniStat
                          label="Paste events"
                          value={
                            metrics.pasteEvents
                          }
                        />

                        <MiniStat
                          label="Coach messages"
                          value={
                            metrics.coachMessages
                          }
                        />

                        <MiniStat
                          label="Feedback checks"
                          value={
                            metrics.feedbackRequests
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </Panel>

      {selectedSubmission && (
        <SubmissionInspectionModal
          submission={
            selectedSubmission
          }
          assignment={
            selectedAssignment
          }
          attempts={
            selectedAssignmentSubmissions.filter(
              (submission) =>
                getStudentKey(
                  submission
                ) ===
                getStudentKey(
                  selectedSubmission
                )
            )
          }
          onClose={() =>
            onSelectSubmission(
              null
            )
          }
        />
      )}
    </div>
  );
}

function StudentResearchRow({
  student,
  onToggleTest,
  onToggleResearchExclusion,
  onResearchWithdrawal,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-mono text-xs font-black text-white">
            {getInitials(
              student.name
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              {student.name}
            </p>

            <p className="truncate font-mono text-[10px] text-slate-400">
              {student.email ||
                "No email"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleTest}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold ${
              student.isTestAccount
                ? "border-violet-200 bg-violet-50 text-violet-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            {student.isTestAccount
              ? "Test account"
              : "Mark as test"}
          </button>

          <button
            type="button"
            onClick={
              onToggleResearchExclusion
            }
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold ${
              student.excludeFromResearch
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {student.excludeFromResearch
              ? "Research excluded"
              : "Exclude research"}
          </button>

          <button
            type="button"
            onClick={
              onResearchWithdrawal
            }
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Research withdrawal
          </button>
        </div>
      </div>

      {(student.isTestAccount ||
        student.excludeFromResearch) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
          {student.isTestAccount && (
            <StatusBadge status="Test account" />
          )}

          {student.excludeFromResearch && (
            <StatusBadge status="Excluded" />
          )}
        </div>
      )}
    </div>
  );
}

function SubmissionInspectionModal({
  submission,
  assignment,
  attempts,
  onClose,
}) {
  const metrics =
    buildProcessMetrics({
      submission,
      assignment,
    });

  const sortedAttempts =
    [...attempts].sort(
      (a, b) =>
        getAttemptNumber(b) -
        getAttemptNumber(a)
    );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[5px] sm:p-6">
      <div className="animate-fade-in-up max-h-[90vh] w-full max-w-5xl transform-gpu overflow-y-auto rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_30px_100px_rgba(15,23,42,0.30)] sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-blue-700">
              Read-only admin inspection
            </p>

            <h3 className="mt-1 font-serif text-xl font-bold text-slate-950">
              {submission.studentName ||
                submission.student_name ||
                submission.profiles?.name ||
                "Student"}
            </h3>

            <p className="mt-1 font-mono text-[10px] text-slate-400">
              {assignment.title}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close inspection"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat
            label="Current status"
            value={metrics.status}
          />

          <MiniStat
            label="Attempt"
            value={metrics.attempt}
          />

          <MiniStat
            label="Word count"
            value={
              metrics.wordCount
            }
          />

          <MiniStat
            label="CEFR"
            value={
              metrics.cefrLevel
            }
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel
            title="Process Evidence"
            subtitle="Summary only. Instructor grading and status actions are not available here."
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label="Duration minutes"
                value={roundNumber(
                  metrics.durationSeconds /
                    60
                )}
              />

              <MiniStat
                label="Writing events"
                value={
                  metrics.writingEvents
                }
              />

              <MiniStat
                label="Paste events"
                value={
                  metrics.pasteEvents
                }
              />

              <MiniStat
                label="Coach messages"
                value={
                  metrics.coachMessages
                }
              />

              <MiniStat
                label="Feedback checks"
                value={
                  metrics.feedbackRequests
                }
              />

              <MiniStat
                label="Submitted"
                value={getReadableDate(
                  metrics.submittedAt
                )}
              />
            </div>
          </Panel>

          <Panel
            title="Attempt History"
            subtitle="Previous attempts remain visible as read-only history."
          >
            <div className="space-y-3">
              {sortedAttempts.map(
                (attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        Attempt{" "}
                        {getAttemptNumber(
                          attempt
                        )}
                      </p>

                      <p className="mt-1 font-mono text-[9px] text-slate-400">
                        {getReadableDate(
                          attempt?.resubmittedAt ||
                            attempt?.resubmitted_at ||
                            attempt?.submittedAt ||
                            attempt?.submitted_at ||
                            attempt?.updatedAt ||
                            attempt?.updated_at ||
                            attempt?.createdAt ||
                            attempt?.created_at
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {attempt?.isCurrent ===
                        true && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-[8px] font-bold text-blue-700">
                          Current
                        </span>
                      )}

                      <StatusBadge
                        status={normalizeSubmissionStatus(
                          attempt.status
                        )}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* =========================================================
   RESEARCH
========================================================= */

function ResearchPanel({
  stats,
  benchmarks,
  analyses,
  lastRun,
  withdrawalLog,
  onRecompute,
}) {
  return (
    <div className="animate-fade-in-up space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-black text-slate-900">
            Research Governance
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Manage research eligibility and keep writing-process analysis current.
          </p>
        </div>
      </div>


      {/* Compact research scope */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">
            Research scope
          </h3>

          <p className="mt-0.5 text-[11px] text-slate-400">
            Current eligibility and exclusion status across the research dataset.
          </p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 md:grid-cols-4 md:divide-y-0">
          <ResearchCompactStat
            icon={FileText}
            label="Eligible submissions"
            value={stats.eligibleResearchSubmissions}
            tone="blue"
          />

          <ResearchCompactStat
            icon={FlaskConical}
            label="Test accounts"
            value={stats.testAccounts}
            tone="indigo"
          />

          <ResearchCompactStat
            icon={ShieldCheck}
            label="Research excluded"
            value={stats.excludedStudents}
            tone="amber"
          />

          <ResearchCompactStat
            icon={Trash2}
            label="Withdrawals"
            value={withdrawalLog.length}
            tone="sky"
          />
        </div>
      </section>


      {/* Process analysis */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Process Analysis
            </h3>

            <p className="mt-0.5 text-[11px] text-slate-400">
              Recompute missing or outdated analyses for eligible submissions.
            </p>
          </div>

          <button
            type="button"
            onClick={onRecompute}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-blue-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recompute
          </button>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 md:grid-cols-4 md:divide-y-0">
          <div className="px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Stored analyses
            </p>

            <p className="mt-1.5 text-xl font-black text-slate-900">
              {analyses.length}
            </p>
          </div>

          <div className="px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Last processed
            </p>

            <p className="mt-1.5 text-xl font-black text-slate-900">
              {lastRun?.processed || 0}
            </p>
          </div>

          <div className="px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Last skipped
            </p>

            <p className="mt-1.5 text-xl font-black text-slate-900">
              {lastRun?.skipped || 0}
            </p>
          </div>

          <div className="px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Last failed
            </p>

            <p className={`mt-1.5 text-xl font-black ${
              Number(lastRun?.failed || 0) > 0
                ? "text-red-600"
                : "text-slate-900"
            }`}>
              {lastRun?.failed || 0}
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
          <p className="font-mono text-[10px] text-slate-400">
            Last run: {getReadableDate(lastRun?.completedAt)}
          </p>
        </div>
      </section>


      {/* Withdrawal history */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">
            Withdrawal history
          </h3>

          <p className="mt-0.5 text-[11px] text-slate-400">
            Anonymous deletion records only. Student identity is not retained.
          </p>
        </div>

        {withdrawalLog.length === 0 ? (
          <div className="px-4 py-5">
            <p className="text-xs text-slate-400">
              No research withdrawals have been processed.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {[...withdrawalLog]
              .reverse()
              .slice(0, 6)
              .map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-xs font-semibold text-slate-700">
                    {getReadableDate(entry.deletedAt)}
                  </p>

                  <p className="text-[11px] text-slate-400">
                    {entry.deleted?.submissions || 0} submissions
                    {" · "}
                    {entry.deleted?.analyses || 0} analyses
                    {" · "}
                    {entry.deleted?.memberships || 0} memberships
                  </p>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}


function ResearchCompactStat({
  icon: Icon,
  label,
  value,
  tone = "blue",
}) {
  const styles = {
    blue: "border-blue-100 bg-blue-50 text-blue-600",
    indigo:
      "border-indigo-100 bg-indigo-50 text-indigo-600",
    amber:
      "border-amber-100 bg-amber-50 text-amber-600",
    sky:
      "border-sky-100 bg-sky-50 text-sky-600",
  };

  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3.5">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
          styles[tone] || styles.blue
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0">
        <p className="text-lg font-black leading-none text-slate-950">
          {value || 0}
        </p>

        <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">
          {label}
        </p>
      </div>
    </div>
  );
}


function ResearchExportsPanel({
  withdrawalLog,
  onDownloadMetrics,
  onDownloadReflections,
}) {
  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Export research data
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Download pseudonymized records. Test accounts and research-excluded students are omitted automatically.
        </p>
      </div>

      <Panel
        title="Choose an export"
        subtitle="Select the dataset needed for the current research task."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SystemActionCard
            icon={Download}
            title="Process metrics"
            description="Word count, writing duration, event totals, paste evidence, Coach use, and feedback-use metrics."
            action="Download metrics CSV"
            onClick={onDownloadMetrics}
          />
          <SystemActionCard
            icon={Download}
            title="Student reflections"
            description="Student reflection responses for eligible submissions."
            action="Download reflections CSV"
            onClick={onDownloadReflections}
          />
        </div>
      </Panel>

      <Panel
        title="Anonymous withdrawal log"
        subtitle="Only deletion dates and record counts are retained. No student identity is stored."
      >
        {withdrawalLog.length === 0 ? (
          <EmptyState text="No research withdrawals have been processed." />
        ) : (
          <div className="space-y-3">
            {[...withdrawalLog].reverse().slice(0, 8).map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3"
              >
                <p className="text-xs font-semibold text-slate-700">
                  {getReadableDate(entry.deletedAt)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {entry.deleted?.submissions} submissions · {entry.deleted?.analyses} analyses · {entry.deleted?.memberships} memberships
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* =========================================================
   SYSTEM
========================================================= */

function SystemPanel({
  data,
  stats,
  analyses,
  onRefresh,
  onCopyDevelopmentSnapshot,
}) {
  return (
    <div className="animate-fade-in-up space-y-6">
      <Panel
        title="Frontend Mock System"
        subtitle="Development tools only. Production admin actions must be protected by admin-only backend endpoints."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SystemActionCard
            icon={RefreshCw}
            title="Refresh Store"
            description="Reload the latest workspace data from the backend."
            action="Refresh"
            onClick={onRefresh}
          />

          <SystemActionCard
            icon={Copy}
            title="Copy Development Snapshot"
            description="Copies identifiable mock JSON for debugging only. Do not use it as a research export."
            action="Copy JSON"
            onClick={
              onCopyDevelopmentSnapshot
            }
          />
        </div>
      </Panel>

      <Panel
        title="Mock Store Summary"
        subtitle="Current local frontend collections."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat
            label="Classes"
            value={
              safeArray(
                data.classes
              ).length
            }
          />

          <MiniStat
            label="Enrollments"
            value={
              safeArray(
                data.enrollments
              ).length
            }
          />

          <MiniStat
            label="Assignments"
            value={
              stats.assignments
            }
          />

          <MiniStat
            label="Submissions"
            value={
              stats.submissions
            }
          />

          <MiniStat
            label="Analyses"
            value={
              analyses.length
            }
          />

          <MiniStat
            label="Instructors"
            value={
              stats.instructors
            }
          />

          <MiniStat
            label="Test Accounts"
            value={
              stats.testAccounts
            }
          />

          <MiniStat
            label="Research Excluded"
            value={
              stats.excludedStudents
            }
          />
        </div>
      </Panel>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

          <div>
            <h3 className="text-sm font-bold text-amber-900">
              Backend integration required
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              This React version reproduces the old admin workflow against the mock store. Production must enforce admin authorization, protected research flags, pseudonymized server exports, withdrawal deletion, and View-as-Instructor auditing on the backend.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SHARED UI
========================================================= */

function AdminNavButton({
  active,
  icon: Icon,
  label,
  badge,
  badgeTone = "blue",
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-xs font-bold transition-all ${
        active
          ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
          : "text-slate-600 hover:bg-white hover:text-slate-900"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon
          className={`h-4 w-4 stroke-[1.8] ${
            active
              ? "text-blue-600"
              : "text-slate-400"
          }`}
        />

        <span>{label}</span>
      </div>

      {badge !== undefined && (
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            active
              ? badgeTone ===
                "indigo"
                ? "bg-indigo-500 text-white"
                : "bg-blue-600 text-white"
              : "bg-slate-200/70 text-slate-500"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function SidebarStat({
  label,
  value,
  tone,
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs last:border-b-0 last:pb-0">
      <span className="font-medium text-slate-500">
        {label}
      </span>

      <span
        className={`font-bold ${
          tone === "blue"
            ? "text-blue-600"
            : "text-slate-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function AdminMetricCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}) {
  const styles = {
    blue: {
      icon:
        "border-blue-100 bg-blue-50 text-blue-700",
      label:
        "border-blue-100 bg-blue-50 text-blue-700",
    },
    sky: {
      icon:
        "border-sky-100 bg-sky-50 text-sky-700",
      label:
        "border-sky-100 bg-sky-50 text-sky-700",
    },
    indigo: {
      icon:
        "border-indigo-100 bg-indigo-50 text-indigo-700",
      label:
        "border-indigo-100 bg-indigo-50 text-indigo-700",
    },
    amber: {
      icon:
        "border-amber-200 bg-amber-50 text-amber-700",
      label:
        "border-amber-200 bg-amber-50 text-amber-700",
    },
  };

  const selected =
    styles[tone] ||
    styles.blue;

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${selected.icon}`}
      >
        <Icon className="h-5 w-5 stroke-[1.8]" />
      </div>

      <div className="min-w-0 space-y-1">
        <span
          className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${selected.label}`}
        >
          {label}
        </span>

        <h4 className="text-xl font-bold text-slate-900">
          {value}
        </h4>

        <p className="text-xs font-medium text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  rightAction,
  children,
}) {
  return (
    <div className="animate-fade-in-up space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            {title}
          </h3>

          {subtitle && (
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {rightAction}
      </div>

      {children}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

      <input
        type="text"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-3 pl-9 pr-4 text-xs text-slate-800 outline-none focus:border-slate-400"
      />
    </div>
  );
}

function StatusBadge({
  status,
}) {
  return (
    <span
      className={`inline-flex w-fit rounded-md border px-2 py-1 text-xs font-semibold ${getStatusClass(
        status
      )}`}
    >
      {status}
    </span>
  );
}

function EmptyState({
  text,
}) {
  return (
    <div className="p-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function SystemActionCard({
  icon: Icon,
  title,
  description,
  action,
  onClick,
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
        <Icon className="h-5 w-5" />
      </div>

      <div>
        <h4 className="text-sm font-bold text-slate-900">
          {title}
        </h4>

        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-blue-700"
      >
        {action}
      </button>
    </div>
  );
}

function MiniStat({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
      <p className="text-xs font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-lg font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function HierarchyBackButton({
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}

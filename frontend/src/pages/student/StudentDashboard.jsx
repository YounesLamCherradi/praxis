import React, {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  Bell,
  BookOpen,
  Bug,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  ImagePlus,
  KeyRound,
  Layers,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkle,
  Trash2,
  X,
} from "lucide-react";

import { useStudentWorkspace } from "../../hooks/useStudentWorkspace";
import { useAuth } from "../../contexts/AuthContext";
import {
  getPraxisData,
  savePraxisData,
} from "../../services/praxisMockStore";
import { joinCourseByCode } from "../../services/courseApi";
import { createBugReport } from "../../services/reportApi";
import { queryClient, queryKeys } from "../../queryClient";

const AssignmentTray = lazy(() => import("./AssignmentTray.jsx"));
const ActiveAssignmentWorkflow = lazy(
  () => import("./ActiveAssignmentWorkflow.jsx")
);

function normalizeCourseCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function getCourseCode(course = {}) {
  return normalizeCourseCode(
    course.code ||
      course.courseCode ||
      course.classCode ||
      course.joinCode ||
      ""
  );
}

function getStudentEmail(authUser, authProfile) {
  return (
    authUser?.email ||
    authProfile?.email ||
    authProfile?.studentEmail ||
    "student@aui.ma"
  )
    .trim()
    .toLowerCase();
}

function getStudentName(authUser, authProfile) {
  return (
    authProfile?.fullName ||
    authProfile?.name ||
    authProfile?.studentName ||
    authUser?.user_metadata?.full_name ||
    authUser?.user_metadata?.name ||
    "Student Account"
  );
}

function normalizeStudentDashboardStatus(value) {
  const status = String(value || "draft")
    .trim()
    .toLowerCase();

  if (status === "in progress") {
    return "draft";
  }

  return status;
}

function hasDashboardSubmissionEvidence(submission = {}) {
  return Boolean(
    submission.submittedAt ||
      submission.resubmittedAt ||
      String(
        submission.submittedText ||
          submission.submissionText ||
          ""
      ).trim()
  );
}

function submissionBelongsToStudent(
  submission = {},
  studentEmail = ""
) {
  const submissionEmail = String(
    submission.studentEmail ||
      submission.email ||
      ""
  )
    .trim()
    .toLowerCase();

  /*
   * Older single-student mock records may not contain studentEmail.
   * Keep those records visible, but never include a record belonging to
   * another explicit student.
   */
  return (
    !submissionEmail ||
    submissionEmail ===
      String(studentEmail || "")
        .trim()
        .toLowerCase()
  );
}

function formatRelativeTime(value) {
  if (!value) return "Recently";

  const timestamp =
    new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const elapsed = Math.max(
    0,
    Date.now() - timestamp
  );

  const minutes = Math.floor(
    elapsed / 60000
  );

  if (minutes < 1) return "Just now";
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(value).toLocaleDateString(
    [],
    {
      month: "short",
      day: "numeric",
    }
  );
}

function getStudentNotificationReadKey(
  studentEmail = ""
) {
  const normalizedEmail =
    String(studentEmail || "student")
      .trim()
      .toLowerCase();

  return `praxis_student_notification_reads::${normalizedEmail}`;
}

function readStudentNotificationIds(
  studentEmail = ""
) {
  void studentEmail;
  return new Set();
}

function persistStudentNotificationIds(
  studentEmail = "",
  notificationIds = new Set()
) {
  void studentEmail;
  void notificationIds;
}

function getNotificationTimestamp(
  value
) {
  const timestamp =
    value
      ? new Date(value).getTime()
      : 0;

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

const BUG_SCREENSHOT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const BUG_SCREENSHOT_MAX_BYTES =
  3 * 1024 * 1024;

function formatBugFileSize(bytes = 0) {
  const size = Number(bytes || 0);

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(
    size /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function readBugScreenshot(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: String(reader.result || ""),
      });
    };

    reader.onerror = () => {
      reject(
        new Error(
          "The screenshot could not be read."
        )
      );
    };

    reader.readAsDataURL(file);
  });
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledDeepLinkRef = useRef("");
  const restoringDeepLinkRef = useRef(false);

  const {
    signOut,
    user: authUser,
    profile: authProfile,
  } = useAuth() || {};

  const {
    classes = [],
    currentClassId = "__all__",
    setCurrentClassId,
    selectedAssignmentId,
    setSelectedAssignmentId,
    closeStudentAssignment,
    openStudentAssignment,
    studentStep,
    rememberStudentStep,
    activeAssignment,
    assignments = [],
    submissions = [],
    refreshStudentWorkspace,
    workspaceSyncState = { status: "ready", error: "" },
  } = useStudentWorkspace();

  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [courseCodeInput, setCourseCodeInput] = useState("");
  const [enrollError, setEnrollError] = useState("");
  const [enrollSuccess, setEnrollSuccess] = useState("");
  const [isJoiningCourse, setIsJoiningCourse] = useState(false);

  useEffect(() => {
    const assignmentId = String(searchParams.get("assignment") || "").trim();
    const requestedCourseId = String(searchParams.get("course") || "").trim();
    if (!assignmentId) return undefined;

    const deepLinkKey = `${requestedCourseId}:${assignmentId}`;
    if (handledDeepLinkRef.current === deepLinkKey) return undefined;

    const assignment = assignments.find(
      (item) => String(item.id) === assignmentId
    );
    if (!assignment) return undefined;

    let active = true;
    const targetCourseId =
      assignment.classId || requestedCourseId || "__all__";
    if (targetCourseId && targetCourseId !== "__all__") {
      setCurrentClassId(String(targetCourseId));
    }

    handledDeepLinkRef.current = deepLinkKey;
    restoringDeepLinkRef.current = true;
    openStudentAssignment(assignmentId).then((opened) => {
      if (active && !opened) {
        handledDeepLinkRef.current = "";
        restoringDeepLinkRef.current = false;
        return;
      }

      const requestedStep = Number(searchParams.get("step"));
      if (
        active &&
        opened &&
        Number.isInteger(requestedStep) &&
        requestedStep >= 1 &&
        requestedStep <= 4 &&
        typeof rememberStudentStep === "function"
      ) {
        rememberStudentStep(assignmentId, requestedStep);
      }

      restoringDeepLinkRef.current = false;
    });

    return () => {
      active = false;
    };
  }, [
    assignments,
    openStudentAssignment,
    rememberStudentStep,
    searchParams,
    setCurrentClassId,
  ]);

  useEffect(() => {
    if (restoringDeepLinkRef.current) return;

    const requestedAssignmentId = String(
      searchParams.get("assignment") || ""
    ).trim();
    const requestedCourseId = String(searchParams.get("course") || "").trim();
    const requestedDeepLinkKey = `${requestedCourseId}:${requestedAssignmentId}`;

    // Do not erase a valid deep link while its assignment data is still loading.
    if (
      !selectedAssignmentId &&
      requestedAssignmentId &&
      handledDeepLinkRef.current !== requestedDeepLinkKey
    ) {
      return;
    }

    const next = new URLSearchParams(searchParams);

    if (currentClassId && currentClassId !== "__all__") {
      next.set("course", String(currentClassId));
    } else {
      next.delete("course");
    }

    if (selectedAssignmentId) {
      next.set("assignment", String(selectedAssignmentId));
      next.set("step", String(Math.min(4, Math.max(1, Number(studentStep || 1)))));
    } else {
      next.delete("assignment");
      next.delete("step");
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [
    currentClassId,
    searchParams,
    selectedAssignmentId,
    setSearchParams,
    studentStep,
  ]);

  const [readNotificationIds, setReadNotificationIds] =
    useState(() => new Set());

  const [isBugReportOpen, setIsBugReportOpen] =
    useState(false);

  const [bugDescription, setBugDescription] =
    useState("");

  const [bugScreenshot, setBugScreenshot] =
    useState(null);

  const [bugReportError, setBugReportError] =
    useState("");

  const [bugReportSuccess, setBugReportSuccess] =
    useState("");

  const [isSubmittingBugReport, setIsSubmittingBugReport] =
    useState(false);

  const [bugFileInputKey, setBugFileInputKey] =
    useState(0);

  const [isAccountMenuOpen, setIsAccountMenuOpen] =
    useState(false);

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(false);

  const [isPasswordPanelOpen, setIsPasswordPanelOpen] =
    useState(false);

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [passwordUiMessage, setPasswordUiMessage] =
    useState("");

  const studentEmail = useMemo(
    () => getStudentEmail(authUser, authProfile),
    [authUser, authProfile]
  );

  const studentName = useMemo(
    () => getStudentName(authUser, authProfile),
    [authUser, authProfile]
  );

  useEffect(() => {
    setReadNotificationIds(
      readStudentNotificationIds(
        studentEmail
      )
    );

    function handleNotificationStorage(
      event
    ) {
      if (
        event.key ===
        getStudentNotificationReadKey(
          studentEmail
        )
      ) {
        setReadNotificationIds(
          readStudentNotificationIds(
            studentEmail
          )
        );
      }
    }

    window.addEventListener(
      "storage",
      handleNotificationStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleNotificationStorage
      );
    };
  }, [studentEmail]);

  const activeAssignmentIds = useMemo(
    () =>
      new Set(
        assignments.map((assignment) =>
          String(assignment?.id)
        )
      ),
    [assignments]
  );

  const currentStudentSubmissions = useMemo(
    () =>
      submissions.filter((submission) => {
        if (!submission) return false;
        if (submission.isCurrent === false) return false;

        if (
          !activeAssignmentIds.has(
            String(submission.assignmentId)
          )
        ) {
          return false;
        }

        return submissionBelongsToStudent(
          submission,
          studentEmail
        );
      }),
    [
      submissions,
      activeAssignmentIds,
      studentEmail,
    ]
  );

  const totalAssignmentsCount = assignments.length;

  const draftCount = useMemo(
    () =>
      currentStudentSubmissions.filter(
        (submission) => {
          const status =
            normalizeStudentDashboardStatus(
              submission.status
            );

          if (
            status === "draft" ||
            status === "reopened" ||
            status === "missing"
          ) {
            return true;
          }

          return (
            status === "late" &&
            !hasDashboardSubmissionEvidence(
              submission
            )
          );
        }
      ).length,
    [currentStudentSubmissions]
  );

  /*
   * This mirrors the instructor dashboard review-inbox rule:
   * only current Submitted/Late attempts from current assignments count.
   * On the student side, the list is additionally restricted to this student.
   */
  const pendingReviewSubmissions = useMemo(
    () =>
      currentStudentSubmissions.filter(
        (submission) => {
          const status =
            normalizeStudentDashboardStatus(
              submission.status
            );

          return (
            (
              status === "submitted" ||
              status === "late"
            ) &&
            hasDashboardSubmissionEvidence(
              submission
            )
          );
        }
      ),
    [currentStudentSubmissions]
  );

  const pendingReviewCount =
    pendingReviewSubmissions.length;

  const feedbackReadyCount = useMemo(
    () =>
      currentStudentSubmissions.filter(
        (submission) => {
          const status =
            normalizeStudentDashboardStatus(
              submission.status
            );

          return Boolean(
            status === "graded" ||
              submission.reviewedAt ||
              submission.teacherReviewedAt ||
              submission.teacherReview?.savedAt ||
              submission.teacher_review?.savedAt
          );
        }
      ).length,
    [currentStudentSubmissions]
  );

  const submittedCount = useMemo(
    () =>
      currentStudentSubmissions.filter(
        (submission) => {
          const status =
            normalizeStudentDashboardStatus(
              submission.status
            );

          return (
            status === "submitted" ||
            status === "graded" ||
            (
              status === "late" &&
              hasDashboardSubmissionEvidence(
                submission
              )
            )
          );
        }
      ).length,
    [currentStudentSubmissions]
  );

  const studentNotifications = useMemo(() => {
    const currentSubmissionByAssignment =
      new Map(
        currentStudentSubmissions.map(
          (submission) => [
            String(
              submission.assignmentId
            ),
            submission,
          ]
        )
      );

    const notifications = [];

    assignments.forEach((assignment) => {
      if (!assignment?.id) return;

      const assignmentId = String(
        assignment.id
      );

      const submission =
        currentSubmissionByAssignment.get(
          assignmentId
        ) || null;

      const matchedCourse =
        classes.find(
          (course) =>
            String(course?.id) ===
            String(assignment.classId)
        ) || null;

      const courseCode =
        assignment.classCode ||
        assignment.courseCode ||
        getCourseCode(matchedCourse) ||
        "COURSE";

      const assignmentTitle =
        assignment.title ||
        assignment.name ||
        "Assignment";

      /*
       * New assignment:
       * StudentWorkspaceContext already exposes only published assignments.
       * Once a student has a current submission/draft, this is no longer a
       * "new assignment" notification.
       */
      if (!submission) {
        const openedAt =
          assignment.publishedAt ||
          assignment.openedAt ||
          assignment.availableAt ||
          assignment.createdAt ||
          null;

        notifications.push({
          id: [
            "new-assignment",
            assignmentId,
            openedAt || "published",
          ].join("::"),
          type: "new_assignment",
          title: "New assignment opened",
          message: `${courseCode} · ${assignmentTitle}`,
          createdAt: openedAt,
          assignmentId:
            assignment.id,
          courseId:
            assignment.classId || null,
        });

        return;
      }

      const status =
        normalizeStudentDashboardStatus(
          submission.status
        );

      if (status === "reopened") {
        const reopenedAt =
          submission.reopenedAt ||
          submission.revisionRequestedAt ||
          submission.updatedAt ||
          null;

        notifications.push({
          id: [
            "assignment-reopened",
            submission.id ||
              assignmentId,
            reopenedAt ||
              submission.attemptNumber ||
              "current",
          ].join("::"),
          type: "reopened",
          title: "Assignment reopened",
          message: `${courseCode} · ${assignmentTitle}`,
          createdAt: reopenedAt,
          assignmentId:
            assignment.id,
          courseId:
            assignment.classId || null,
        });
      }

      if (status === "graded") {
        const gradedAt =
          submission.gradedAt ||
          submission.reviewedAt ||
          submission.teacherReviewedAt ||
          submission.teacherReview?.savedAt ||
          submission.teacher_review?.savedAt ||
          submission.updatedAt ||
          null;

        notifications.push({
          id: [
            "assignment-graded",
            submission.id ||
              assignmentId,
            gradedAt || "graded",
          ].join("::"),
          type: "graded",
          title: "Assignment graded",
          message: `${courseCode} · ${assignmentTitle}`,
          createdAt: gradedAt,
          assignmentId:
            assignment.id,
          courseId:
            assignment.classId || null,
        });
      }
    });

    return notifications
      .filter(
        (notification) =>
          !readNotificationIds.has(
            String(notification.id)
          )
      )
      .sort(
        (a, b) =>
          getNotificationTimestamp(
            b.createdAt
          ) -
          getNotificationTimestamp(
            a.createdAt
          )
      );
  }, [
    assignments,
    classes,
    currentStudentSubmissions,
    readNotificationIds,
  ]);

  // Keep the assignment shell stable while students move between tabs.
  // Changing the page max-width for Draft only made Draft & Feedback jump
  // horizontally when AI Feedback opened.
  const useWideDraftWorkspace = Boolean(selectedAssignmentId);

  function markStudentNotificationRead(
    notificationId
  ) {
    if (!notificationId) return;

    setReadNotificationIds(
      (current) => {
        const next = new Set(
          current
        );

        next.add(
          String(notificationId)
        );

        persistStudentNotificationIds(
          studentEmail,
          next
        );

        return next;
      }
    );
  }

  function openStudentNotification(
    notification
  ) {
    if (!notification) return;

    setIsSidebarOpen(false);

    /*
     * One click performs the full expected action:
     * save/close any current assignment, select the correct course,
     * mark the notification read, and open the target assignment.
     */
    if (
      typeof closeStudentAssignment ===
      "function"
    ) {
      closeStudentAssignment();
    } else if (
      typeof setSelectedAssignmentId ===
      "function"
    ) {
      setSelectedAssignmentId(null);
    }

    if (
      typeof setCurrentClassId ===
      "function"
    ) {
      setCurrentClassId(
        notification.courseId ||
          "__all__"
      );
    }

    markStudentNotificationRead(
      notification.id
    );

    if (
      typeof openStudentAssignment ===
      "function"
    ) {
      openStudentAssignment(
        notification.assignmentId
      );
    }
  }

  function resetBugReportForm() {
    setBugDescription("");
    setBugScreenshot(null);
    setBugReportError("");
    setBugReportSuccess("");
    setBugFileInputKey(
      (current) => current + 1
    );
  }

  function openBugReportForm() {
    setIsSidebarOpen(false);
    resetBugReportForm();
    setIsBugReportOpen(true);
  }

  function closeBugReportForm() {
    if (isSubmittingBugReport) {
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
        (current) => current + 1
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
        (current) => current + 1
      );
      setBugReportError(
        "The picture must be 3 MB or smaller."
      );
      return;
    }

    try {
      const screenshot =
        await readBugScreenshot(file);

      setBugScreenshot(
        screenshot
      );
    } catch (error) {
      setBugScreenshot(null);
      setBugFileInputKey(
        (current) => current + 1
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
      (current) => current + 1
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

    if (description.length < 10) {
      setBugReportError(
        "Please describe the issue in at least 10 characters."
      );
      return;
    }

    setIsSubmittingBugReport(true);

    try {
      const now =
        new Date().toISOString();

      const selectedCourse =
        classes.find(
          (course) =>
            String(course?.id) ===
            String(currentClassId)
        ) || null;

      const report = {
        id: `bug_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,

        status: "open",
        priority: "normal",

        reporterRole: "student",
        reporterName: studentName,
        reporterEmail: studentEmail,

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
            : "/student",

        classId:
          currentClassId === "__all__"
            ? null
            : currentClassId,

        classCode:
          selectedCourse
            ? getCourseCode(
                selectedCourse
              )
            : null,

        assignmentId:
          selectedAssignmentId ||
          null,

        assignmentTitle:
          activeAssignment?.title ||
          activeAssignment?.name ||
          null,

        studentStep:
          selectedAssignmentId
            ? Number(
                studentStep || 1
              )
            : null,

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
        (current) => current + 1
      );

      window.setTimeout(() => {
        setIsBugReportOpen(false);
        setBugReportSuccess("");
      }, 1100);
    } catch (error) {
      setBugReportError(
        "The report could not be saved. Try a smaller picture or submit without a picture."
      );
    } finally {
      setIsSubmittingBugReport(false);
    }
  }

  function navigateToCourseWorkspace(
    nextClassId
  ) {
    setIsSidebarOpen(false);

    /*
     * Course navigation is real navigation, not only a filter change:
     * save/close the active assignment, then show the requested course list.
     */
    if (
      typeof closeStudentAssignment ===
      "function"
    ) {
      closeStudentAssignment();
    } else if (
      typeof setSelectedAssignmentId ===
      "function"
    ) {
      setSelectedAssignmentId(null);
    }

    if (
      typeof setCurrentClassId ===
      "function"
    ) {
      setCurrentClassId(nextClassId);
    }
  }

  function toggleAccountMenu() {
    setIsAccountMenuOpen(
      (current) => !current
    );
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

  async function handlePasswordUiSubmit(event) {
    event.preventDefault();

    if (newPassword.length < 10) {
      setPasswordUiMessage(
        "Use at least 10 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordUiMessage(
        "The passwords do not match."
      );
      return;
    }

    setPasswordUiMessage("Updating password...");

    try {
      const response = await fetch("/api/auth/update-password", {
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

  async function handleLogout() {
    setIsAccountMenuOpen(false);

    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  function openEnrollModal() {
    setIsSidebarOpen(false);
    setCourseCodeInput("");
    setEnrollError("");
    setEnrollSuccess("");
    setIsEnrollOpen(true);
  }

  function closeEnrollModal() {
    if (isJoiningCourse) return;

    setIsEnrollOpen(false);
    setCourseCodeInput("");
    setEnrollError("");
    setEnrollSuccess("");
  }

  function courseIsAlreadyJoined(course, enrollments = []) {
    const targetCourseId = String(course?.id || "");
    const targetCourseCode = getCourseCode(course);

    const existsInWorkspace = classes.some((joinedCourse) => {
      const sameId =
        targetCourseId &&
        String(joinedCourse?.id || "") === targetCourseId;

      const sameCode =
        targetCourseCode &&
        getCourseCode(joinedCourse) === targetCourseCode;

      return sameId || sameCode;
    });

    if (existsInWorkspace) {
      return true;
    }

    return enrollments.some((enrollment) => {
      const enrollmentEmail = String(
        enrollment?.studentEmail ||
          enrollment?.email ||
          ""
      )
        .trim()
        .toLowerCase();

      const sameStudent = enrollmentEmail === studentEmail;

      const sameClassId =
        targetCourseId &&
        String(enrollment?.classId || enrollment?.courseId || "") ===
          targetCourseId;

      const enrollmentCode = normalizeCourseCode(
        enrollment?.classCode ||
          enrollment?.courseCode ||
          enrollment?.code ||
          ""
      );

      const sameClassCode =
        targetCourseCode &&
        enrollmentCode === targetCourseCode;

      return sameStudent && (sameClassId || sameClassCode);
    });
  }

  async function handleEnrollCourseCode(event) {
    event.preventDefault();

    setEnrollError("");
    setEnrollSuccess("");

    const enteredCode = normalizeCourseCode(courseCodeInput);

    if (!enteredCode) {
      setEnrollError("Please enter a valid course code.");
      return;
    }

    setIsJoiningCourse(true);

    try {
      const data = getPraxisData();

      const allCourses = Array.isArray(data.classes)
        ? data.classes
        : [];

      const enrollments = Array.isArray(data.enrollments)
        ? data.enrollments
        : [];

      const localMatchedCourse = allCourses.find((course) => {
        return getCourseCode(course) === enteredCode;
      });

      let matchedCourse = localMatchedCourse;

      try {
        const joined = await joinCourseByCode(enteredCode);
        await queryClient.invalidateQueries({ queryKey: queryKeys.studentCourses });
        matchedCourse = localMatchedCourse
          ? {
              ...joined.class,
              ...localMatchedCourse,
              code: joined.class.code,
              backendId: joined.class.id,
            }
          : joined.class;
      } catch (apiError) {
        // Courses created before the Supabase migration remain joinable on the
        // same browser until the instructor next opens their dashboard.
        if (!localMatchedCourse || apiError?.status !== 404) {
          throw apiError;
        }
      }

      if (matchedCourse.isPublished === false) {
        setEnrollError(
          "This course is currently unpublished. Please contact your instructor."
        );
        return;
      }

      if (courseIsAlreadyJoined(matchedCourse, enrollments)) {
        setEnrollError("You are already enrolled in this course.");

        navigateToCourseWorkspace(
          matchedCourse.id
        );

        return;
      }

      const now = new Date().toISOString();
      const matchedCourseCode = getCourseCode(matchedCourse);

      const newEnrollment = {
        id: `enrollment_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,

        studentEmail,
        studentName,

        classId: matchedCourse.id,
        courseId: matchedCourse.id,

        classCode: matchedCourseCode,
        courseCode: matchedCourseCode,

        className:
          matchedCourse.name ||
          matchedCourse.title ||
          matchedCourseCode,

        status: "active",
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const updatedEnrollments = [...enrollments, newEnrollment];
      const courseAlreadyCached = allCourses.some(
        (course) => String(course?.id) === String(matchedCourse?.id)
      );

      savePraxisData({
        ...data,
        classes: courseAlreadyCached
          ? allCourses
          : [...allCourses, matchedCourse],
        enrollments: updatedEnrollments,
      });

      setEnrollSuccess(
        `${matchedCourseCode} verified. The course workspace is now available.`
      );

      setCourseCodeInput("");

      navigateToCourseWorkspace(
        matchedCourse.id
      );

      if (typeof refreshStudentWorkspace === "function") {
        await Promise.resolve(refreshStudentWorkspace());
      }

      window.setTimeout(() => {
        setIsEnrollOpen(false);
        setEnrollSuccess("");

        /*
         * Reload only when the workspace context does not expose a refresh
         * function. This ensures the newly joined course appears immediately.
         */
        if (typeof refreshStudentWorkspace !== "function") {
          window.location.reload();
        }
      }, 1400);
    } catch (error) {
      console.error("Course enrollment failed:", error);

      setEnrollError(error?.message ||
        "The course could not be joined. Please refresh the page and try again."
      );
    } finally {
      setIsJoiningCourse(false);
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#F8FAFC] font-sans antialiased text-slate-950 selection:bg-blue-100 selection:text-blue-900 md:flex">
      {workspaceSyncState.status === "loading" && classes.length === 0 && (
        <div className="fixed inset-0 z-[2147483640] flex items-center justify-center bg-[#F8FAFC]/90 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            Loading your courses and assignments…
          </div>
        </div>
      )}

      {workspaceSyncState.status === "error" && workspaceSyncState.error && (
        <div className="fixed left-1/2 top-4 z-[2147483641] w-[min(92vw,640px)] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-semibold text-amber-900 shadow-lg">
          {workspaceSyncState.error}
        </div>
      )}

      <style>{`
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
            transform: translateY(12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulseBreathe {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }

          50% {
            opacity: 0.85;
            transform: scale(0.96);
          }
        }

        .animate-fade-in-up {
          animation:
            fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .status-pulse {
          animation:
            pulseBreathe 2s infinite ease-in-out;
        }

        .glow-box-draft:hover {
          box-shadow:
            0 12px 30px -10px rgba(37, 99, 235, 0.16),
            0 0 0 1px rgba(37, 99, 235, 0.24);
          border-color: rgba(37, 99, 235, 0.35);
        }

        .glow-box-pending:hover {
          box-shadow:
            0 12px 30px -10px rgba(79, 70, 229, 0.16),
            0 0 0 1px rgba(79, 70, 229, 0.24);
          border-color: rgba(79, 70, 229, 0.35);
        }

        .glow-box-verified:hover {
          box-shadow:
            0 12px 30px -10px rgba(14, 165, 233, 0.16),
            0 0 0 1px rgba(14, 165, 233, 0.24);
          border-color: rgba(14, 165, 233, 0.35);
        }
      `}</style>

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close course menu"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[1px] md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 h-screen w-[17rem] bg-slate-950 text-slate-200 shadow-2xl transition-transform duration-200 md:relative md:z-20 md:w-68 md:translate-x-0 ${
          isSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col justify-between">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white border border-blue-400/20 shadow-md shadow-blue-500/10 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/praxis-logo.png"
                alt="Praxis logo"
                className="w-9 h-9 object-contain"
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight leading-none">
                <span className="text-blue-400">p</span>
                <span className="text-white">raxis</span>
              </h1>

              <p className="text-[9px] font-mono font-bold text-blue-300 uppercase tracking-wider mt-1.5">
                Student Dashboard
              </p>
            </div>
          </div>

          <div className="p-5 space-y-7 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-3 mb-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block">
                  Active Courses
                </span>

                <button
                  type="button"
                  onClick={openEnrollModal}
                  className="text-[10px] font-mono font-bold text-blue-300 hover:text-white flex items-center gap-0.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Join
                </button>
              </div>

              <button
                type="button"
                onClick={() => navigateToCourseWorkspace("__all__")}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left group cursor-pointer border ${
                  currentClassId === "__all__"
                    ? "bg-blue-600/15 text-white border-blue-400/30 shadow-inner"
                    : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers
                    className={`w-4 h-4 stroke-[1.8] ${
                      currentClassId === "__all__"
                        ? "text-blue-300"
                        : "text-slate-500"
                    }`}
                  />

                  <span>All Courses</span>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    currentClassId === "__all__"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {totalAssignmentsCount}
                </span>
              </button>

              {classes.map((course) => {
                const classCount = assignments.filter(
                  (assignment) =>
                    assignment &&
                    String(assignment.classId) ===
                      String(course.id)
                ).length;

                const isSelected =
                  String(currentClassId) === String(course.id);

                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => navigateToCourseWorkspace(course.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left group cursor-pointer border ${
                      isSelected
                        ? "bg-blue-600/15 text-white border-blue-400/30 shadow-inner"
                        : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <BookOpen
                        className={`w-4 h-4 stroke-[1.8] shrink-0 ${
                          isSelected
                            ? "text-blue-300"
                            : "text-slate-500"
                        }`}
                      />

                      <span className="truncate">
                        {course.name
                          ? course.name.split(":")[0]
                          : getCourseCode(course) || course.id}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {classCount}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-5 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-slate-500">
                    Notifications
                  </span>

                  {studentNotifications.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.9)]" />
                  )}
                </div>

                <span
                  className={`inline-flex min-w-6 items-center justify-center rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-black ${
                    studentNotifications.length > 0
                      ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
                      : "border-slate-800 bg-slate-900 text-slate-600"
                  }`}
                >
                  {studentNotifications.length > 9
                    ? "9+"
                    : studentNotifications.length}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-slate-950/70 shadow-[0_14px_34px_-24px_rgba(37,99,235,0.8)]">
                <div className="flex items-center gap-2.5 border-b border-slate-800/80 px-3.5 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                    <Bell className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-200">
                      Assignment updates
                    </p>

                    <p className="truncate text-[8px] text-slate-500">
                      Open, reopened, and graded
                    </p>
                  </div>
                </div>

                {studentNotifications.length === 0 ? (
                  <div className="flex flex-col items-center px-4 py-5 text-center">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/80 text-slate-500">
                      <Bell className="h-4 w-4" />
                    </div>

                    <p className="mt-3 text-[10px] font-bold text-slate-300">
                      No new notifications
                    </p>

                    <p className="mt-1 max-w-[170px] text-[9px] leading-relaxed text-slate-600">
                      New, reopened, or graded assignments will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 p-2">
                    {studentNotifications.map(
                      (notification) => {
                        const isReopened =
                          notification.type ===
                          "reopened";

                        const isGraded =
                          notification.type ===
                          "graded";

                        const NotificationIcon =
                          isReopened
                            ? RotateCcw
                            : isGraded
                            ? BadgeCheck
                            : BookOpen;

                        const tone =
                          isReopened
                            ? {
                                icon: "border-violet-500/25 bg-violet-500/10 text-violet-300",
                                line: "bg-violet-400",
                              }
                            : isGraded
                            ? {
                                icon: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
                                line: "bg-emerald-400",
                              }
                            : {
                                icon: "border-blue-500/25 bg-blue-500/10 text-blue-300",
                                line: "bg-blue-400",
                              };

                        return (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() =>
                              openStudentNotification(
                                notification
                              )
                            }
                            className="group relative flex w-full items-start gap-2.5 overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/55 px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:border-slate-700 hover:bg-slate-900 hover:shadow-lg"
                          >
                            <span
                              className={`absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full ${tone.line}`}
                            />

                            <div
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${tone.icon}`}
                            >
                              <NotificationIcon className="h-4 w-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[10px] font-bold leading-tight text-slate-200">
                                  {notification.title}
                                </p>

                                <span className="shrink-0 font-mono text-[8px] text-slate-600">
                                  {formatRelativeTime(
                                    notification.createdAt
                                  )}
                                </span>
                              </div>

                              <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-slate-500">
                                {notification.message}
                              </p>

                              <span className="mt-1.5 inline-flex items-center gap-1 text-[8px] font-bold text-blue-300 transition-colors group-hover:text-blue-200">
                                Open assignment
                                <ChevronRight className="h-3 w-3" />
                              </span>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="relative border-t border-slate-800/80 bg-slate-950/20 p-4">
          {isAccountMenuOpen && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-4 right-4 z-50 overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-950 shadow-[0_24px_55px_rgba(0,0,0,0.45)]">
              <div className="border-b border-slate-800 px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-mono font-black text-white shadow-md shadow-blue-600/20">
                    ST
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">
                      {studentName}
                    </p>

                    <p className="mt-0.5 truncate text-[9px] font-mono text-slate-400">
                      {studentEmail}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1 p-2">
                <button
                  type="button"
                  onClick={openPasswordPanel}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 transition-all hover:bg-blue-500/10 hover:text-blue-200"
                >
                  <KeyRound className="h-4 w-4 text-blue-300" />

                  <span className="flex-1">
                    Change Password
                  </span>

                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[8px] font-mono text-slate-500">
                    UI ready
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 transition-all hover:bg-rose-500/10 hover:text-rose-300"
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
            className="mb-2 flex w-full items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2.5 text-left text-xs font-bold text-slate-300 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-200"
            aria-label="Report a bug"
          >
            <Megaphone className="h-4 w-4 text-blue-300" />
            <span className="flex-1">Report a Bug</span>
          </button>

          <button
            type="button"
            onClick={toggleAccountMenu}
            className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
              isAccountMenuOpen
                ? "border-blue-500/40 bg-blue-500/10"
                : "border-transparent hover:border-slate-800 hover:bg-slate-900/70"
            }`}
            aria-expanded={isAccountMenuOpen}
            aria-label="Open student account menu"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-mono font-black text-white shadow-md shadow-blue-600/20">
              ST
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="truncate text-xs font-bold text-white">
                {studentName}
              </h4>

              <p className="truncate text-[9px] font-mono text-slate-400">
                {studentEmail}
              </p>
            </div>

            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                isAccountMenuOpen
                  ? "rotate-180 text-blue-300"
                  : ""
              }`}
            />
          </button>
        </div>

        </div>
      </aside>

      <main className="relative flex h-screen min-w-0 w-full flex-1 flex-col overflow-hidden">
        <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-4 sm:px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-500">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 md:hidden"
              aria-label="Open course menu"
              aria-expanded={isSidebarOpen}
            >
              {isSidebarOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>

            <span className="hidden sm:inline">Workspace</span>

            <ChevronRight className="hidden h-3.5 w-3.5 text-slate-300 sm:inline" />

            <span className="truncate font-bold text-slate-950">
              {currentClassId === "__all__"
                ? "All Course Workspaces"
                : classes.find(
                    (course) =>
                      String(course.id) ===
                      String(currentClassId)
                  )?.name || "Course Workspace"}
            </span>
          </div>

        </header>

        <div
          className={`flex-1 overflow-y-auto relative blueprint-grid ${
            useWideDraftWorkspace ? "p-5 2xl:p-6" : "p-8"
          }`}
        >
          <div
            className={`mx-auto min-h-full w-full flex flex-col relative z-10 space-y-8 transition-[max-width] duration-300 ${
              useWideDraftWorkspace
                ? "max-w-[1500px]"
                : "max-w-7xl"
            }`}
          >
            {!selectedAssignmentId && (
              <div className="bg-gradient-to-r from-blue-50 to-white border border-blue-100/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in-up">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkle className="w-4 h-4 text-blue-600" />
                    Course Access Window
                  </h3>

                  <p className="text-xs text-slate-500 max-w-xl">
                    Has your instructor provided a course code? Enter
                    it to load your writing workspace and assigned
                    prompts.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openEnrollModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-600/20 cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]"
                >
                  Enter Course Code
                </button>
              </div>
            )}

            <Suspense
              fallback={
                <div
                  className="flex min-h-48 items-center justify-center text-sm font-semibold text-slate-500"
                  role="status"
                >
                  Loading workspace…
                </div>
              }
            >
              {selectedAssignmentId ? (
                <ActiveAssignmentWorkflow />
              ) : (
                <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up [animation-delay:100ms]">
                  <StudentMetricCard
                    cardType="draft"
                    icon={FileText}
                    label="Active Drafts"
                    value={`${draftCount || 0} Workspaces`}
                    description="Unlocked prompts ready for student drafting steps."
                    tone="blue"
                    pulse
                  />

                  <StudentMetricCard
                    cardType="pending"
                    icon={Clock}
                    label="Awaiting Review"
                    value={`${pendingReviewCount} Tasks`}
                    description="Submitted work currently waiting for instructor review."
                    tone="indigo"
                  />

                  <StudentMetricCard
                    cardType="verified"
                    icon={ShieldCheck}
                    label="Submitted Work"
                    value={`${submittedCount} Complete`}
                    description="Completed submissions with process visibility attached."
                    tone="sky"
                  />
                </div>

                <div className="space-y-2 animate-fade-in-up [animation-delay:150ms]">
                  <div className="space-y-1">
                    <h2 className="font-serif text-2xl font-black text-slate-900">
                      Course Assignment Workspaces
                    </h2>

                    <p className="text-xs text-slate-400 font-medium">
                      Select an active assignment to start drafting,
                      receive AI guidance, and submit your work.
                    </p>
                  </div>

                    <AssignmentTray />
                  </div>
                </div>
              )}
            </Suspense>
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
              onSubmit={handlePasswordUiSubmit}
              className="mt-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="student-new-password"
                  className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400"
                >
                  New password
                </label>

                <input
                  id="student-new-password"
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
                  htmlFor="student-confirm-password"
                  className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400"
                >
                  Confirm password
                </label>

                <input
                  id="student-confirm-password"
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
                  onClick={closePasswordPanel}
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
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 animate-in fade-in zoom-in-95 duration-150">
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
                  Describe what happened. Praxis automatically includes your current course, assignment, and workflow step.
                </p>
              </div>

              <form
                onSubmit={handleBugReportSubmit}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor="student-bug-description"
                    className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400"
                  >
                    What happened?
                  </label>

                  <textarea
                    id="student-bug-description"
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
                    placeholder="Example: I clicked Continue to Feedback, but the page stayed on Step 2."
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
                    <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
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
                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0" />

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

      {isEnrollOpen && (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={closeEnrollModal}
              disabled={isJoiningCourse}
              className="absolute right-5 top-5 text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Close join-course modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
                <BookOpen className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Join an Instructor&apos;s Course
                </h3>

                <p className="text-xs leading-relaxed text-slate-500">
                  Enter the course code issued by your instructor to
                  access the course workspace and assigned writing
                  prompts.
                </p>
              </div>

              <form
                onSubmit={handleEnrollCourseCode}
                className="space-y-4 pt-2"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                    Course access code
                  </label>

                  <input
                    type="text"
                    value={courseCodeInput}
                    disabled={isJoiningCourse}
                    onChange={(event) => {
                      setCourseCodeInput(
                        normalizeCourseCode(event.target.value)
                      );

                      if (enrollError) {
                        setEnrollError("");
                      }

                      if (enrollSuccess) {
                        setEnrollSuccess("");
                      }
                    }}
                    placeholder="e.g. FAS1949"
                    autoComplete="off"
                    maxLength={12}
                    className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3.5 text-xs font-mono uppercase text-slate-900 shadow-inner transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {enrollError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

                    <span className="font-semibold leading-relaxed">
                      {enrollError}
                    </span>
                  </div>
                )}

                {enrollSuccess && (
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0" />

                    <span className="font-semibold leading-relaxed">
                      {enrollSuccess}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isJoiningCourse ||
                    !normalizeCourseCode(courseCodeInput)
                  }
                  className="w-full rounded-xl bg-blue-600 py-3.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isJoiningCourse
                    ? "Checking course..."
                    : "Verify Code & Join Course"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentMetricCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
  cardType,
  pulse,
}) {
  const toneStyles = {
    blue: {
      icon: "bg-blue-50 border-blue-100 text-blue-600",
      label: "text-blue-700 bg-blue-50 border-blue-100",
    },

    indigo: {
      icon: "bg-indigo-50 border-indigo-100 text-indigo-600",
      label:
        "text-indigo-700 bg-indigo-50 border-indigo-100",
    },

    sky: {
      icon: "bg-sky-50 border-sky-100 text-sky-600",
      label: "text-sky-700 bg-sky-50 border-sky-100",
    },
  };

  const styles = toneStyles[tone] || toneStyles.blue;

  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl p-5 flex items-start gap-4 transition-all duration-300 hover:-translate-y-1 ${
        cardType ? `glow-box-${cardType}` : ""
      } cursor-default`}
    >
      <div
        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${styles.icon}`}
      >
        <Icon className="w-5 h-5 stroke-[1.8]" />
      </div>

      <div className="space-y-1 min-w-0">
        <span
          className={`text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded border inline-block ${
            styles.label
          } ${pulse ? "status-pulse" : ""}`}
        >
          {label}
        </span>

        <h4 className="text-xl font-serif font-bold text-slate-900">
          {value}
        </h4>

        <p className="text-[11px] text-slate-400 font-medium">
          {description}
        </p>
      </div>
    </div>
  );
}

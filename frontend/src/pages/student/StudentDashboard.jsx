import {
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
import { authenticatedFetch } from "../../services/auth";
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

function getCourseDisplayName(course = {}) {
  const courseName = String(
    course.name || course.courseName || course.className || ""
  ).trim();
  const courseCode = getCourseCode(course);

  if (!courseName) return courseCode || "Course";

  const nameParts = courseName.split(":");
  if (
    nameParts.length > 1 &&
    normalizeCourseCode(nameParts[0]) === courseCode
  ) {
    return nameParts.slice(1).join(":").trim() || courseName;
  }

  return courseName;
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
    authUser?.full_name ||
    authUser?.fullName ||
    authUser?.name ||
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
  const [showStudentNewPassword, setShowStudentNewPassword] = useState(false);
  const [showStudentConfirmPassword, setShowStudentConfirmPassword] = useState(false);
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
  const hasJoinedCourses = classes.length > 0;

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

  const [isDeleteAccountOpen, setIsDeleteAccountOpen] =
    useState(false);

  const [deleteAccountConfirmation, setDeleteAccountConfirmation] =
    useState("");

  const [deleteAccountError, setDeleteAccountError] =
    useState("");

  const [isDeletingAccount, setIsDeletingAccount] =
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
    const syncReadStateTimeoutId = window.setTimeout(
      () =>
        setReadNotificationIds(
          readStudentNotificationIds(studentEmail)
        ),
      0
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
      window.clearTimeout(syncReadStateTimeoutId);
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

      const courseName = matchedCourse
        ? getCourseDisplayName(matchedCourse)
        : assignment.className || assignment.courseName || "Course";

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
          message: `${courseName} · ${assignmentTitle}`,
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
          message: `${courseName} · ${assignmentTitle}`,
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
          message: `${courseName} · ${assignmentTitle}`,
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
    } catch {
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

  async function handleLogout() {
    setIsAccountMenuOpen(false);

    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  function handleDeleteOwnAccount() {
    setIsAccountMenuOpen(false);
    setDeleteAccountConfirmation("");
    setDeleteAccountError("");
    setIsDeletingAccount(false);
    setIsDeleteAccountOpen(true);
  }

  function closeDeleteAccountModal() {
    if (isDeletingAccount) return;

    setIsDeleteAccountOpen(false);
    setDeleteAccountConfirmation("");
    setDeleteAccountError("");
  }

  async function confirmDeleteOwnAccount() {
    const confirmation =
      String(deleteAccountConfirmation || "")
        .trim()
        .toUpperCase();

    if (confirmation !== "DELETE") {
      setDeleteAccountError(
        "Type DELETE exactly to confirm."
      );
      return;
    }

    setIsDeletingAccount(true);
    setDeleteAccountError("");

    try {
      const response =
        await authenticatedFetch(
          "/api/auth/account",
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              confirmation: "DELETE",
            }),
            timeoutMs: 20_000,
            retryDelaysMs: [],
          }
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (
        !response.ok ||
        data?.error
      ) {
        setDeleteAccountError(
          data?.error ||
          "Could not delete this account."
        );
        return;
      }

      setIsDeleteAccountOpen(false);

      window.location.assign(
        "/signup"
      );

    } catch (error) {
      setDeleteAccountError(
        error?.name === "AbortError"
          ? "The request took too long. Please try again."
          : "Could not delete this account. Please try again."
      );

    } finally {
      setIsDeletingAccount(false);
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
        await queryClient.invalidateQueries({ queryKey: queryKeys.studentWorkspace });
        matchedCourse = localMatchedCourse
          ? {
              ...joined.class,
              ...localMatchedCourse,
              code: joined.class.code,
              backendId: joined.class.id,
            }
          : joined.class;
      } catch (apiError) {
        // Courses created before the current database migration remain joinable on the
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
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#F8FAFC] font-sans antialiased text-slate-950 selection:bg-blue-100 selection:text-blue-900 md:flex">
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
          className="fixed inset-0 z-30 touch-none bg-slate-950/45 backdrop-blur-[1px] md:hidden"
        />
      )}

      <aside
        aria-label="Student course navigation"
        className={`fixed inset-y-0 left-0 z-40 h-[100dvh] w-[min(86vw,16rem)] border-r border-blue-100 bg-[#F6F9FF] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-slate-700 shadow-xl transition-transform duration-200 will-change-transform md:relative md:z-20 md:h-full md:w-56 md:pb-0 md:pt-0 xl:w-60 2xl:w-64 md:translate-x-0 ${
          isSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col justify-between">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-3 border-b border-blue-100/80 px-5 py-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <img
                src="/praxis-logo.png"
                alt="Praxis logo"
                className="w-9 h-9 object-contain"
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight leading-none">
                <span className="text-slate-900">pr</span>
                <span className="text-blue-700">a</span>
                <span className="text-slate-900">x</span>
                <span className="text-blue-700">i</span>
                <span className="text-slate-900">s</span>
              </h1>

              <p className="mt-1 text-[10px] font-medium text-slate-500">
                Your writing space
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 touch-pan-y space-y-5 overflow-y-auto overscroll-contain p-3.5 pb-5 sm:space-y-6 sm:p-4">
            <div className="space-y-1.5">
              <div className="mb-2 flex items-center px-2">
                <span className="text-xs font-bold text-slate-700">
                  My courses
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigateToCourseWorkspace("__all__")}
                className={`group flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-3 text-left text-xs font-bold transition-all ${
                  currentClassId === "__all__"
                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers
                    className={`w-4 h-4 stroke-[1.8] ${
                      currentClassId === "__all__"
                        ? "text-blue-600"
                        : "text-slate-400"
                    }`}
                  />

                  <span>All Courses</span>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    currentClassId === "__all__"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200/70 text-slate-500"
                  }`}
                >
                  {totalAssignmentsCount}
                </span>
              </button>

              <div className="relative ml-5 space-y-1 border-l border-blue-200/80 pb-1 pl-3 pt-2">
                <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  Joined courses
                </p>

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
                    className={`group relative flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2.5 text-left text-[11px] font-semibold transition-all before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-blue-200/80 ${
                      isSelected
                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                        : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2 truncate">
                      <BookOpen
                        className={`h-3.5 w-3.5 shrink-0 stroke-[1.8] ${
                          isSelected
                            ? "text-blue-600"
                            : "text-slate-400"
                        }`}
                      />

                      <span className="truncate">
                        {getCourseDisplayName(course)}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200/70 text-slate-500"
                      }`}
                    >
                      {classCount}
                    </span>
                  </button>
                );
              })}
              </div>
            </div>

            <div className="space-y-2.5 border-t border-blue-100 pt-5">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    Updates
                  </span>

                  {studentNotifications.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.9)]" />
                  )}
                </div>

                <span
                  className={`inline-flex min-w-6 items-center justify-center rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-black ${
                    studentNotifications.length > 0
                      ? "border-blue-200 bg-blue-100 text-blue-700"
                      : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {studentNotifications.length > 9
                    ? "9+"
                    : studentNotifications.length}
                </span>
              </div>

              <div
                className={
                  studentNotifications.length === 0
                    ? "overflow-hidden rounded-lg border border-blue-100 bg-white/70 sm:rounded-2xl sm:bg-white sm:shadow-sm"
                    : "space-y-1.5"
                }
              >
                {studentNotifications.length === 0 ? (
                  <div className="flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3.5 sm:py-3.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 sm:h-9 sm:w-9 sm:rounded-xl">
                      <BadgeCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold leading-tight text-slate-700 sm:text-[10px]">
                        You’re up to date
                      </p>
                      <p className="mt-0.5 text-[8px] leading-tight text-slate-400 sm:text-[9px]">
                        No new course updates.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
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
                                icon: "border-violet-200 bg-violet-50 text-violet-600",
                                line: "bg-violet-400",
                              }
                            : isGraded
                            ? {
                                icon: "border-emerald-200 bg-emerald-50 text-emerald-600",
                                line: "bg-emerald-400",
                              }
                            : {
                                icon: "border-blue-200 bg-blue-50 text-blue-600",
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
                            className="group relative flex w-full items-center gap-1.5 overflow-hidden rounded-lg border border-slate-100 bg-white/70 px-2 py-1.5 text-left transition-all hover:border-blue-100 hover:bg-blue-50/60 sm:items-start sm:gap-2.5 sm:rounded-xl sm:bg-slate-50/70 sm:px-3 sm:py-2.5 sm:hover:-translate-y-px sm:hover:shadow-sm"
                          >
                            <span
                              className={`absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r-full sm:bottom-2 sm:top-2 ${tone.line}`}
                            />

                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border sm:mt-0.5 sm:h-8 sm:w-8 sm:rounded-xl ${tone.icon}`}
                            >
                              <NotificationIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-1 text-[9px] font-bold leading-tight text-slate-700 sm:text-[10px]">
                                  {notification.title}
                                </p>

                                <span className="shrink-0 text-[7px] text-slate-400 sm:text-[8px]">
                                  {formatRelativeTime(
                                    notification.createdAt
                                  )}
                                </span>
                              </div>

                              <p className="mt-0.5 line-clamp-1 text-[8px] leading-4 text-slate-500 sm:mt-1 sm:line-clamp-2 sm:text-[9px] sm:leading-relaxed">
                                {notification.message}
                              </p>

                              <span className="mt-1.5 hidden items-center gap-1 text-[8px] font-bold text-blue-600 transition-colors group-hover:text-blue-700 sm:inline-flex">
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

        <div className="relative border-t border-blue-100 bg-white/60 p-4">
          {isAccountMenuOpen && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-4 right-4 z-50 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-xl">
              <div className="border-b border-slate-100 px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-mono font-black text-white shadow-md shadow-blue-600/20">
                    ST
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">
                      {studentName}
                    </p>

                    <p className="mt-0.5 truncate text-[9px] text-slate-400">
                      {studentEmail}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1 p-2">
                <button
                  type="button"
                  onClick={openPasswordPanel}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-600 transition-all hover:bg-blue-50 hover:text-blue-700"
                >
                  <KeyRound className="h-4 w-4 text-blue-500" />

                  <span className="flex-1">
                    Change Password
                  </span>

                </button>

                <button
                  type="button"
                  onClick={handleDeleteOwnAccount}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-red-600 transition-all hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />

                  <span className="flex-1">
                    Delete Account
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-600 transition-all hover:bg-rose-50 hover:text-rose-600"
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
            className="mb-1 inline-flex min-h-8 w-fit max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[9px] font-semibold text-slate-400 transition-all hover:bg-white hover:text-blue-700 sm:mb-2 sm:min-h-10 sm:w-full sm:gap-2.5 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs sm:font-medium sm:text-slate-500"
            aria-label="Report a bug"
          >
            <Megaphone className="h-3.5 w-3.5 shrink-0 text-slate-400 sm:h-4 sm:w-4" />
            <span>Share feedback</span>
          </button>

          <button
            type="button"
            onClick={toggleAccountMenu}
            className={`flex min-h-10 w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-all sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-3 ${
              isAccountMenuOpen
                ? "border-blue-200 bg-white shadow-sm"
                : "border-transparent hover:border-blue-100 hover:bg-white"
            }`}
            aria-expanded={isAccountMenuOpen}
            aria-label="Open student account menu"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 font-mono text-[10px] font-black text-white shadow-sm shadow-blue-600/20 sm:h-9 sm:w-9 sm:rounded-xl sm:text-xs sm:shadow-md">
              ST
            </div>

            <div className="min-w-0 flex-1">
              <p className="hidden text-[9px] font-medium text-slate-400 sm:block">
                Welcome back,
              </p>

              <h4 className="truncate text-[10px] font-bold leading-tight text-slate-800 sm:text-xs">
                {studentName === "Student Account" ? "My account" : studentName}
              </h4>
            </div>

            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform sm:h-4 sm:w-4 ${
                isAccountMenuOpen
                  ? "rotate-180 text-blue-600"
                  : ""
              }`}
            />
          </button>
        </div>

        </div>
      </aside>

      <main className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        <header className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-2.5 sm:h-16 sm:px-4 md:px-5 xl:px-6 2xl:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-xs font-medium text-slate-500">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 md:hidden"
              aria-label={
                isSidebarOpen
                  ? "Close course menu"
                  : "Open course menu"
              }
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

            <span className="min-w-0 flex-1 truncate font-bold text-slate-950">
              {currentClassId === "__all__"
                ? "All Course Workspaces"
                : classes.find(
                    (course) =>
                      String(course.id) ===
                      String(currentClassId)
                  )
                  ? getCourseDisplayName(
                      classes.find(
                        (course) =>
                          String(course.id) === String(currentClassId)
                      )
                    )
                  : "Course Workspace"}
            </span>
          </div>

          {hasJoinedCourses && !selectedAssignmentId && (
            <button
              type="button"
              onClick={openEnrollModal}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-2.5 text-[11px] font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.98] sm:h-auto sm:gap-2 sm:px-4 sm:py-2 sm:text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Enter Course Code</span>
              <span className="sm:hidden">Join</span>
            </button>
          )}

        </header>

        <div
          className={`flex-1 overflow-y-auto relative blueprint-grid ${
            useWideDraftWorkspace ? "p-2.5 sm:p-4 2xl:p-6" : "p-3 sm:p-4 lg:p-5 xl:p-6 2xl:p-8"
          }`}
        >
          <div
            className={`mx-auto min-h-full w-full flex flex-col relative z-10 space-y-4 lg:space-y-5 xl:space-y-6 2xl:space-y-8 transition-[max-width] duration-300 ${
              useWideDraftWorkspace
                ? "max-w-[1500px]"
                : "max-w-7xl"
            }`}
          >
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
                hasJoinedCourses ? (
                <div className="space-y-4 animate-fade-in-up [animation-delay:100ms]">
                  <AssignmentTray />
                </div>
                ) : (
                  <section className="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-4 animate-fade-in-up sm:min-h-[58vh] sm:py-0">
                    <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-blue-100 bg-white px-4 py-8 text-center shadow-xl shadow-blue-950/5 sm:rounded-3xl sm:px-10 sm:py-14">
                      <div
                        aria-hidden="true"
                        className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-blue-100/60 blur-2xl"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-sky-100/60 blur-2xl"
                      />

                      <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 shadow-sm sm:h-16 sm:w-16">
                        <BookOpen className="h-7 w-7" />
                      </div>

                      <p className="relative mt-5 text-[11px] font-bold text-blue-600">
                        Welcome to Praxis
                      </p>

                      <h2 className="relative mt-1 text-xl font-black text-slate-900 sm:text-3xl">
                        Join your first course
                      </h2>

                      <p className="relative mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-500">
                        Enter the course code provided by your instructor to
                        see your assignments and begin writing.
                      </p>

                      <button
                        type="button"
                        onClick={openEnrollModal}
                        className="relative mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg active:translate-y-0 sm:mt-7 sm:px-6 sm:py-3"
                      >
                        <Plus className="h-4 w-4" />
                        Enter Course Code
                      </button>

                      <p className="relative mt-4 text-[10px] text-slate-400">
                        You can find the code in your instructor’s invitation.
                      </p>
                    </div>
                  </section>
                )
              )}
            </Suspense>
          </div>
        </div>
      </main>

      {isPasswordPanelOpen && (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-3 xl:p-4">
          <div className="relative max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl sm:max-h-[92dvh] sm:p-5 2xl:rounded-3xl 2xl:p-7">
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

                <div className="relative">
                  <input
                    id="student-new-password"
                    type={showStudentNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(
                        event.target.value
                      );
                      setPasswordUiMessage("");
                    }}
                    placeholder="At least 10 characters"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-11 py-3 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                  <button
                    type="button"
                    data-password-toggle="showStudentNewPassword"
                    onClick={() => setShowStudentNewPassword((current) => !current)}
                    aria-label={showStudentNewPassword ? "Hide password" : "Show password"}
                    aria-pressed={showStudentNewPassword}
                    title={showStudentNewPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 z-10 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-blue-600 focus:text-blue-600 focus:outline-none cursor-pointer"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                      <circle cx="12" cy="12" r="2.5" />
                      {showStudentNewPassword && <path d="M4 4l16 16" />}
                    </svg>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="student-confirm-password"
                  className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400"
                >
                  Confirm password
                </label>

                <div className="relative">
                  <input
                    id="student-confirm-password"
                    type={showStudentConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(
                        event.target.value
                      );
                      setPasswordUiMessage("");
                    }}
                    placeholder="Repeat the new password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-11 py-3 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                  <button
                    type="button"
                    data-password-toggle="showStudentConfirmPassword"
                    onClick={() => setShowStudentConfirmPassword((current) => !current)}
                    aria-label={showStudentConfirmPassword ? "Hide password" : "Show password"}
                    aria-pressed={showStudentConfirmPassword}
                    title={showStudentConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 z-10 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-blue-600 focus:text-blue-600 focus:outline-none cursor-pointer"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                      <circle cx="12" cy="12" r="2.5" />
                      {showStudentConfirmPassword && <path d="M4 4l16 16" />}
                    </svg>
                  </button>
                </div>
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
        <div className="fixed inset-0 z-[2147483647] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-3 xl:p-4">
          <div className="relative max-h-[92dvh] w-full touch-pan-y overflow-y-auto overscroll-contain rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[92dvh] sm:max-w-xl sm:rounded-2xl 2xl:rounded-3xl animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150">

            <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 px-3 py-3 backdrop-blur sm:px-5 sm:py-4">
              <div className="flex items-start gap-2.5 pr-9">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 sm:h-11 sm:w-11 sm:rounded-2xl">
                  <Bug className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                    Report a Bug
                  </h3>

                  <p className="mt-0.5 text-[10px] leading-4 text-slate-500 sm:text-xs sm:leading-relaxed">
                    Tell us what happened. Praxis includes your current course, assignment, and workflow step.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeBugReportForm}
                disabled={isSubmittingBugReport}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 sm:right-4 sm:top-4"
                aria-label="Close bug-report form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleBugReportSubmit}
              className="space-y-3.5 px-3 py-3 sm:space-y-5 sm:px-5 sm:py-5 2xl:px-8 2xl:py-6"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="student-bug-description"
                  className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]"
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
                  rows={4}
                  maxLength={1500}
                  placeholder="Example: I clicked Continue to Feedback, but the page stayed on Step 2."
                  className="min-h-[96px] w-full resize-y rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2.5 text-[13px] leading-5 text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[120px] sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-sm sm:leading-6"
                />

                <div className="flex items-start justify-between gap-3 text-[9px] text-slate-400 sm:text-[10px]">
                  <span className="leading-4">
                    Include the action and what you expected.
                  </span>

                  <span className="shrink-0 font-mono">
                    {bugDescription.length}/1500
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">
                      Picture
                      <span className="ml-1 normal-case tracking-normal text-slate-300">
                        optional
                      </span>
                    </p>

                    <p className="mt-0.5 text-[9px] text-slate-400 sm:mt-1 sm:text-[10px]">
                      PNG, JPG or WebP · max 3 MB
                    </p>
                  </div>
                </div>

                {!bugScreenshot ? (
                  <label className="group flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50 sm:flex-col sm:justify-center sm:rounded-2xl sm:px-5 sm:py-6 sm:text-center">
                    <input
                      key={bugFileInputKey}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={isSubmittingBugReport}
                      onChange={handleBugScreenshotChange}
                      className="sr-only"
                    />

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-600 shadow-sm transition-transform group-hover:-translate-y-0.5 sm:h-11 sm:w-11 sm:rounded-2xl">
                      <ImagePlus className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>

                    <div className="min-w-0 sm:text-center">
                      <p className="text-[11px] font-bold text-slate-700 sm:mt-2 sm:text-xs">
                        Upload screenshot
                      </p>

                      <p className="mt-0.5 text-[9px] leading-4 text-slate-400 sm:text-[10px]">
                        Tap to choose an image
                      </p>
                    </div>
                  </label>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:rounded-2xl">
                    <div className="relative bg-slate-950/5 p-2 sm:p-3">
                      <img
                        src={bugScreenshot.dataUrl}
                        alt="Bug screenshot preview"
                        className="max-h-40 w-full rounded-lg border border-slate-200 bg-white object-contain sm:max-h-64 sm:rounded-xl"
                      />

                      <button
                        type="button"
                        onClick={removeBugScreenshot}
                        disabled={isSubmittingBugReport}
                        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/70 bg-white/95 text-slate-500 shadow-md transition-all hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 sm:right-5 sm:top-5 sm:h-9 sm:w-9 sm:rounded-xl"
                        aria-label="Remove uploaded picture"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-bold text-slate-700 sm:text-xs">
                          {bugScreenshot.name}
                        </p>

                        <p className="mt-0.5 text-[9px] text-slate-400 sm:text-[10px]">
                          {formatBugFileSize(
                            bugScreenshot.size
                          )}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-700 sm:px-2.5 sm:py-1 sm:text-[9px]">
                        Ready
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {bugReportError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-700 sm:p-3 sm:text-xs">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

                  <span className="font-semibold leading-relaxed">
                    {bugReportError}
                  </span>
                </div>
              )}

              {bugReportSuccess && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-700 sm:p-3 sm:text-xs">
                  <CheckSquare className="mt-0.5 h-4 w-4 shrink-0" />

                  <span className="font-semibold leading-relaxed">
                    {bugReportSuccess}
                  </span>
                </div>
              )}

              <div className="sticky bottom-0 -mx-3 grid grid-cols-2 gap-2 border-t border-slate-100 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-4">
                <button
                  type="button"
                  onClick={closeBugReportForm}
                  disabled={isSubmittingBugReport}
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-3 sm:text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isSubmittingBugReport ||
                    bugDescription.trim().length < 10
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-[11px] font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-5 sm:py-3 sm:text-xs"
                >
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />

                  {isSubmittingBugReport
                    ? "Sending..."
                    : "Send Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteAccountOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeDeleteAccountModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-delete-account-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-red-100 bg-white shadow-2xl"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50/70 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <Trash2 className="h-5 w-5" />
                </div>

                <div>
                  <h2
                    id="student-delete-account-title"
                    className="text-base font-bold text-slate-950"
                  >
                    Delete student account
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Delete this newly created account and register again with the correct role.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeDeleteAccountModal}
                disabled={isDeletingAccount}
                aria-label="Close delete account dialog"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="truncate text-sm font-bold text-slate-800">
                  {studentName}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  {studentEmail}
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-bold text-amber-900">
                  Workshop account correction
                </p>

                <p className="mt-1 text-xs leading-5 text-amber-800">
                  This option is available only before submission data is created. Accounts containing academic work cannot be deleted here.
                </p>
              </div>

              <div>
                <label
                  htmlFor="student-delete-account-confirmation"
                  className="text-xs font-bold text-slate-700"
                >
                  Type DELETE to confirm
                </label>

                <input
                  id="student-delete-account-confirmation"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  value={deleteAccountConfirmation}
                  disabled={isDeletingAccount}
                  onChange={(event) => {
                    setDeleteAccountConfirmation(
                      event.target.value
                    );

                    if (deleteAccountError) {
                      setDeleteAccountError("");
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      String(
                        deleteAccountConfirmation ||
                        ""
                      )
                        .trim()
                        .toUpperCase() === "DELETE" &&
                      !isDeletingAccount
                    ) {
                      confirmDeleteOwnAccount();
                    }
                  }}
                  placeholder="DELETE"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {deleteAccountError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700"
                >
                  {deleteAccountError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
              <button
                type="button"
                onClick={closeDeleteAccountModal}
                disabled={isDeletingAccount}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteOwnAccount}
                disabled={
                  isDeletingAccount ||
                  String(
                    deleteAccountConfirmation ||
                    ""
                  )
                    .trim()
                    .toUpperCase() !== "DELETE"
                }
                className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-red-600/20 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isDeletingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEnrollOpen && (
        <div className="fixed inset-0 z-[2147483647] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-3 xl:p-4">
          <div className="relative max-h-[92dvh] w-full touch-pan-y overflow-y-auto overscroll-contain rounded-t-2xl border border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:max-h-[92dvh] sm:max-w-md sm:rounded-2xl sm:p-5 2xl:rounded-3xl 2xl:p-8 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={closeEnrollModal}
              disabled={isJoiningCourse}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-white hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 sm:right-5 sm:top-5 sm:h-auto sm:w-auto sm:border-0 sm:bg-transparent"
              aria-label="Close join-course modal"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <div className="space-y-3 sm:space-y-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 sm:h-12 sm:w-12 sm:rounded-2xl">
                <BookOpen className="h-4 w-4 sm:h-6 sm:w-6" />
              </div>

              <div className="space-y-1">
                <h3 className="pr-9 text-base font-bold leading-tight text-slate-900 sm:pr-0 sm:text-lg">
                  Join an Instructor&apos;s Course
                </h3>

                <p className="text-[11px] leading-5 text-slate-500 sm:text-xs sm:leading-relaxed">
                  Enter the course code issued by your instructor to
                  access the course workspace and assigned writing
                  prompts.
                </p>
              </div>

              <form
                onSubmit={handleEnrollCourseCode}
                className="space-y-3 pt-1 sm:space-y-4 sm:pt-2"
              >
                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">
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
                    className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2.5 font-mono text-[16px] uppercase text-slate-900 shadow-inner transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:py-3.5 sm:text-xs"
                  />
                </div>

                {enrollError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[10px] text-red-700 sm:rounded-xl sm:p-3 sm:text-xs">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

                    <span className="font-semibold leading-relaxed">
                      {enrollError}
                    </span>
                  </div>
                )}

                {enrollSuccess && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[10px] text-emerald-700 sm:rounded-xl sm:p-3 sm:text-xs">
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
                  className="min-h-10 w-full rounded-xl bg-blue-600 px-3 py-2.5 text-[11px] font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:py-3.5 sm:text-xs sm:hover:scale-[1.01] sm:disabled:hover:scale-100"
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
}) {
  const toneStyles = {
    blue: {
      icon: "bg-blue-50 border-blue-100 text-blue-600",
      label: "text-blue-700 bg-blue-50 border-blue-100",
    },
    indigo: {
      icon: "bg-indigo-50 border-indigo-100 text-indigo-600",
      label: "text-indigo-700 bg-indigo-50 border-indigo-100",
    },
    sky: {
      icon: "bg-sky-50 border-sky-100 text-sky-600",
      label: "text-sky-700 bg-sky-50 border-sky-100",
    },
  };
  const styles = toneStyles[tone] || toneStyles.blue;

  return (
    <div
      className={`flex cursor-default items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-300 hover:-translate-y-1 ${
        cardType ? `glow-box-${cardType}` : ""
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
      >
        <Icon className="h-5 w-5 stroke-[1.8]" />
      </div>
      <div className="min-w-0 space-y-1">
        <span
          className={`inline-block rounded border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest ${styles.label}`}
        >
          {label}
        </span>
        <h4 className="text-lg font-bold text-slate-900">
          {value}
        </h4>
        <p className="text-[11px] font-medium text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

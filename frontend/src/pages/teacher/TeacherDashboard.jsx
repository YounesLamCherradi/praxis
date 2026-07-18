import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import TeacherAssignments from "./TeacherAssignments";
import TeacherCommunication from "./TeacherCommunication";
import { useTeacherWorkspace } from "../../contexts/TeacherWorkspaceContext.jsx";

import { useNavigate } from "react-router-dom";
import {
  getPraxisData,
  savePraxisData,
} from "../../services/praxisMockStore";

import {
  Home,
  BookOpen,
  Layers,
  Archive,
  Bell,
  Bug,
  Clock3,
  FileCheck2,
  RotateCcw,
  LogOut,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Sparkle,
  ShieldAlert,
  CheckSquare,
  ShieldCheck,
  Settings,
  Edit3,
  UserPlus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Megaphone,
  MessageSquare,
  Send,
  Info,
} from "lucide-react";

function getTeacherSubmissionText(submission = {}) {
  return String(
    submission.submittedText ||
      submission.submissionText ||
      submission.finalText ||
      submission.content ||
      submission.draftText ||
      ""
  ).trim();
}

function hasTeacherSubmissionEvidence(submission = {}) {
  return Boolean(
    submission.submittedAt ||
      submission.resubmittedAt ||
      getTeacherSubmissionText(submission)
  );
}

function formatRelativeTime(value) {
  if (!value) return "Recently";

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days}d ago`;

  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}


const BUG_SCREENSHOT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const BUG_SCREENSHOT_MAX_BYTES = 3 * 1024 * 1024;

function formatBugFileSize(bytes = 0) {
  const size = Number(bytes || 0);

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
      reject(new Error("The screenshot could not be read."));
    };

    reader.readAsDataURL(file);
  });
}

function getTeacherIdentity(authUser, authProfile) {
  const email = String(
    authProfile?.email ||
      authUser?.email ||
      "instructor@aui.ma"
  ).trim();

  const name = String(
    authProfile?.full_name ||
      authProfile?.fullName ||
      authProfile?.name ||
      authUser?.user_metadata?.full_name ||
      authUser?.user_metadata?.name ||
      "Teacher Account"
  ).trim();

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return {
    email,
    name,
    initials: initials || "TR",
  };
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const {
    signOut,
    user: authUser,
    profile: authProfile,
  } = useAuth();

  const teacherIdentity = useMemo(
    () => getTeacherIdentity(authUser, authProfile),
    [authUser, authProfile]
  );

  const {
    classes = [],
    setClasses,
    assignments = [],
    setAssignments,
    submissions = [],
    setSubmissions,
    rubrics = [],
    setRubrics,
    setView,
  } = useTeacherWorkspace();

  const activeCourses = useMemo(
    () => classes.filter((course) => course?.archived !== true),
    [classes]
  );

  const activeCourseIds = useMemo(
    () => new Set(activeCourses.map((course) => String(course.id))),
    [activeCourses]
  );

  const activeCourseCodes = useMemo(
    () =>
      new Set(
        activeCourses
          .map((course) => String(course?.code || "").toUpperCase())
          .filter(Boolean)
      ),
    [activeCourses]
  );

  const activeAssignments = useMemo(
    () =>
      assignments.filter((assignment) => {
        const matchesId =
          assignment?.classId !== null &&
          assignment?.classId !== undefined &&
          activeCourseIds.has(String(assignment.classId));

        const classCode = String(assignment?.classCode || "").toUpperCase();
        const matchesCode = Boolean(
          classCode && activeCourseCodes.has(classCode)
        );

        return matchesId || matchesCode;
      }),
    [assignments, activeCourseIds, activeCourseCodes]
  );

  const activeAssignmentIds = useMemo(
    () => new Set(activeAssignments.map((assignment) => String(assignment.id))),
    [activeAssignments]
  );

  const [activeTab, setActiveTab] = useState("overview");

  const [assignmentWorkspaceRequest, setAssignmentWorkspaceRequest] = useState({
    mode: "browse",
    courseId: null,
    assignmentId: null,
    statusFilter: "All",
    requestId: 0,
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [classNameInput, setClassNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [semesterInput, setSemesterInput] = useState("Fall 2026");

  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [expandedClassId, setExpandedClassId] = useState(null);

  const [managedClass, setManagedClass] = useState(null);
  const [managerMode, setManagerMode] = useState("details");

  const [manageCourseForm, setManageCourseForm] = useState({
    name: "",
    description: "",
    semester: "Fall 2026",
  });

  const [studentNameToAdd, setStudentNameToAdd] = useState("");
  const [studentEmailToAdd, setStudentEmailToAdd] = useState("");

  const [managerError, setManagerError] = useState("");
  const [managerSuccess, setManagerSuccess] = useState("");
  const managerSuccessTimerRef = useRef(null);

  const [enrollments, setEnrollments] = useState(() => {
    return getPraxisData().enrollments || [];
  });


  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isPasswordPanelOpen, setIsPasswordPanelOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordUiMessage, setPasswordUiMessage] = useState("");

  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [bugDescription, setBugDescription] = useState("");
  const [bugScreenshot, setBugScreenshot] = useState(null);
  const [bugReportError, setBugReportError] = useState("");
  const [bugReportSuccess, setBugReportSuccess] = useState("");
  const [isSubmittingBugReport, setIsSubmittingBugReport] = useState(false);
  const [bugFileInputKey, setBugFileInputKey] = useState(0);

  function showManagerSuccess(message) {
    if (managerSuccessTimerRef.current) {
      window.clearTimeout(managerSuccessTimerRef.current);
    }

    setManagerSuccess(message);

    managerSuccessTimerRef.current = window.setTimeout(() => {
      setManagerSuccess("");
      managerSuccessTimerRef.current = null;
    }, 2600);
  }

  function refreshEnrollments() {
    const data = getPraxisData();
    setEnrollments(data.enrollments || []);
  }

  useEffect(() => {
    refreshEnrollments();

    const handleStorageChange = (event) => {
      if (!event.key || event.key === "praxis_mock_data") {
        refreshEnrollments();
      }
    };

    const handleFocus = () => {
      refreshEnrollments();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);

      if (managerSuccessTimerRef.current) {
        window.clearTimeout(managerSuccessTimerRef.current);
      }
    };
  }, []);

  function toggleAccountMenu() {
    setIsAccountMenuOpen((current) => !current);
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

  function handlePasswordUiSubmit(event) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setPasswordUiMessage("Use at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordUiMessage("The passwords do not match.");
      return;
    }

    setPasswordUiMessage(
      "Password update is ready for backend connection."
    );
  }

  function resetBugReportForm() {
    setBugDescription("");
    setBugScreenshot(null);
    setBugReportError("");
    setBugReportSuccess("");
    setBugFileInputKey((current) => current + 1);
  }

  function openBugReportForm() {
    resetBugReportForm();
    setIsBugReportOpen(true);
  }

  function closeBugReportForm() {
    if (isSubmittingBugReport) return;

    setIsBugReportOpen(false);
    resetBugReportForm();
  }

  async function handleBugScreenshotChange(event) {
    const file = event.target.files?.[0] || null;

    setBugReportError("");
    setBugReportSuccess("");

    if (!file) {
      setBugScreenshot(null);
      return;
    }

    if (!BUG_SCREENSHOT_TYPES.has(file.type)) {
      setBugScreenshot(null);
      setBugFileInputKey((current) => current + 1);
      setBugReportError(
        "Upload a PNG, JPG, or WebP picture only."
      );
      return;
    }

    if (file.size > BUG_SCREENSHOT_MAX_BYTES) {
      setBugScreenshot(null);
      setBugFileInputKey((current) => current + 1);
      setBugReportError("The picture must be 3 MB or smaller.");
      return;
    }

    try {
      const screenshot = await readBugScreenshot(file);
      setBugScreenshot(screenshot);
    } catch (error) {
      setBugScreenshot(null);
      setBugFileInputKey((current) => current + 1);
      setBugReportError(
        error?.message || "The picture could not be uploaded."
      );
    }
  }

  function removeBugScreenshot() {
    setBugScreenshot(null);
    setBugFileInputKey((current) => current + 1);
    setBugReportError("");
  }

  async function handleBugReportSubmit(event) {
    event.preventDefault();

    setBugReportError("");
    setBugReportSuccess("");

    const description = bugDescription.trim();

    if (description.length < 10) {
      setBugReportError(
        "Please describe the issue in at least 10 characters."
      );
      return;
    }

    setIsSubmittingBugReport(true);

    try {
      const data = getPraxisData();
      const bugReports = Array.isArray(data.bugReports)
        ? data.bugReports
        : [];
      const now = new Date().toISOString();

      const report = {
        id: `bug_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        status: "open",
        priority: "normal",
        reporterRole: "teacher",
        reporterName: teacherIdentity.name,
        reporterEmail: teacherIdentity.email,
        description,
        screenshot: bugScreenshot ? { ...bugScreenshot } : null,
        route:
          typeof window !== "undefined"
            ? window.location.pathname
            : "/teacher",
        teacherTab: activeTab,
        courseId: assignmentWorkspaceRequest?.courseId || null,
        assignmentId:
          assignmentWorkspaceRequest?.assignmentId || null,
        workspaceMode: assignmentWorkspaceRequest?.mode || null,
        createdAt: now,
        updatedAt: now,
      };

      savePraxisData({
        ...data,
        bugReports: [report, ...bugReports],
      });

      setBugReportSuccess("Your issue was reported successfully.");
      setBugDescription("");
      setBugScreenshot(null);
      setBugFileInputKey((current) => current + 1);

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

  async function handleLogout() {
    setIsAccountMenuOpen(false);

    try {
      await signOut();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }

  function buildCourseCodePrefix(courseName) {
    const words =
      String(courseName || "")
        .toUpperCase()
        .match(/[A-Z]+/g) || [];

    if (words.length >= 3) {
      return words
        .slice(0, 3)
        .map((word) => word[0])
        .join("");
    }

    const combinedLetters = words.join("");
    return `${combinedLetters}CRS`.slice(0, 3);
  }

  function generateUniqueCourseCode(courseName) {
    const prefix = buildCourseCodePrefix(courseName);
    const usedCodes = new Set(
      classes.map((course) => String(course?.code || "").toUpperCase())
    );

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const numericPart = String(Math.floor(1000 + Math.random() * 9000));
      const candidate = `${prefix}${numericPart}`;

      if (!usedCodes.has(candidate)) {
        return candidate;
      }
    }

    return `${prefix}${String(Date.now()).slice(-5)}`;
  }

  function computeCourseStatus(cls) {
    if (cls?.archived === true) {
      return {
        text: "Archived",
        styles: "bg-amber-500/10 text-amber-700 border-amber-500/20",
      };
    }

    if (cls?.isPublished === false) {
      return {
        text: "Unpublished",
        styles: "bg-slate-500/10 text-slate-500 border-slate-500/20",
      };
    }

    return {
      text: "Published",
      styles:
        "bg-blue-500/10 text-blue-600 border-blue-600/20 status-pulse",
    };
  }

  const handleCreateCourse = (e) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    const cleanName = classNameInput.trim();

    if (!cleanName) {
      setCreateError("Please enter a course name.");
      return;
    }

    try {
      const code = generateUniqueCourseCode(cleanName);

      const newClass = {
        id: "cls_" + Date.now(),
        name: cleanName,
        code,
        description:
          descriptionInput.trim() || "No course description specified.",
        semester: semesterInput,
        isPublished: true,
        archived: false,
        archivedAt: null,
      };

      if (typeof setClasses === "function") {
        setClasses([...classes, newClass]);
      }

      setCreateSuccess(`Course created. Access code: ${code}`);

      setClassNameInput("");
      setDescriptionInput("");

      window.setTimeout(() => {
        setIsCreateOpen(false);
        setCreateSuccess("");
      }, 2500);
    } catch (err) {
      console.error("Failed to create course:", err);
      setCreateError("Failed to create course.");
    }
  };

  const totalClassesCount = activeCourses.length;
  const totalAssignmentsCount = activeAssignments.length;

  const pendingReviews = useMemo(
    () =>
      submissions.filter((submission) => {
        if (submission?.isCurrent === false) return false;

        if (!activeAssignmentIds.has(String(submission?.assignmentId))) {
          return false;
        }

        const status = String(submission?.status || "")
          .trim()
          .toLowerCase();

        return (
          (status === "submitted" || status === "late") &&
          hasTeacherSubmissionEvidence(submission)
        );
      }),
    [submissions, activeAssignmentIds]
  );

  const pendingReviewsCount = pendingReviews.length;

  const sidebarNotifications = useMemo(() => {
    return pendingReviews
      .map((submission) => {
        const assignment =
          activeAssignments.find(
            (item) =>
              String(item?.id) ===
              String(submission?.assignmentId)
          ) || null;

        if (!assignment) return null;

        const studentLabel =
          submission?.studentName ||
          submission?.studentEmail ||
          "A student";

        const assignmentLabel =
          assignment?.title ||
          submission?.assignmentTitle ||
          "an assignment";

        const status = String(submission?.status || "")
          .trim()
          .toLowerCase();

        const isResubmission =
          Boolean(submission?.resubmittedAt) ||
          Number(submission?.attemptNumber || 1) > 1;

        const createdAt =
          submission?.resubmittedAt ||
          submission?.submittedAt ||
          submission?.updatedAt ||
          submission?.createdAt ||
          null;

        return {
          id: String(
            submission?.id ||
              `${submission?.assignmentId || "assignment"}::${
                submission?.studentEmail || "student"
              }`
          ),
          type: isResubmission
            ? "resubmission"
            : status === "late"
            ? "late"
            : "submission",
          title: isResubmission
            ? "Assignment resubmitted"
            : status === "late"
            ? "Late submission"
            : "New submission",
          studentLabel,
          assignmentLabel,
          message: `${studentLabel} · ${assignmentLabel}`,
          createdAt,
          assignmentId: assignment.id,
          courseId: assignment.classId || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;
        const bTime = b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;

        return bTime - aTime;
      });
  }, [pendingReviews, activeAssignments]);

  function createWorkspaceRequest(overrides = {}) {
    return {
      mode: "browse",
      courseId: null,
      assignmentId: null,
      statusFilter: "All",
      requestId: Date.now(),
      ...overrides,
    };
  }

  function openAssignmentList() {
    if (typeof setView === "function") {
      setView("list");
    }

    setAssignmentWorkspaceRequest(createWorkspaceRequest());
    setActiveTab("assignments");
  }

  function openCreateAssignment() {
    if (activeCourses.length === 0) {
      setCreateError(
        "Create an active course before creating an assignment."
      );
      setIsCreateOpen(true);
      return;
    }

    if (typeof setView === "function") {
      setView("create");
    }

    setAssignmentWorkspaceRequest(
      createWorkspaceRequest({ mode: "create" })
    );
    setActiveTab("assignments");
  }

  function openAssignmentReview(assignment) {
    if (!assignment) {
      openAssignmentList();
      return;
    }

    if (typeof setView === "function") {
      setView("list");
    }

    setAssignmentWorkspaceRequest(
      createWorkspaceRequest({
        mode: "review",
        courseId: assignment.classId || null,
        assignmentId: assignment.id,
        statusFilter: "Pending",
      })
    );

    setActiveTab("assignments");
  }

  function openPendingReviews() {
    const firstPendingSubmission = pendingReviews[0] || null;

    if (!firstPendingSubmission) {
      openAssignmentList();
      return;
    }

    const pendingAssignment =
      activeAssignments.find(
        (assignment) =>
          String(assignment?.id) ===
          String(firstPendingSubmission?.assignmentId)
      ) || null;

    openAssignmentReview(pendingAssignment);
  }

  function openSidebarNotification(notification) {
    const assignment =
      activeAssignments.find(
        (item) =>
          String(item?.id) ===
          String(notification?.assignmentId)
      ) || null;

    openAssignmentReview(assignment);
  }

  function getClassEnrollments(cls) {
    return enrollments.filter((enrollment) => {
      const sameClassId = String(enrollment.classId) === String(cls.id);

      const sameClassCode =
        enrollment.classCode?.toUpperCase() === cls.code?.toUpperCase();

      return sameClassId || sameClassCode;
    });
  }

  function openCourseManager(cls) {
    if (managerSuccessTimerRef.current) {
      window.clearTimeout(managerSuccessTimerRef.current);
      managerSuccessTimerRef.current = null;
    }

    setManagedClass(cls);
    setManagerMode("details");

    setManageCourseForm({
      name: cls.name || "",
      description: cls.description || "",
      semester: cls.semester || "Fall 2026",
    });

    setStudentNameToAdd("");
    setStudentEmailToAdd("");
    setManagerError("");
    setManagerSuccess("");
  }

  function closeCourseManager() {
    if (managerSuccessTimerRef.current) {
      window.clearTimeout(managerSuccessTimerRef.current);
      managerSuccessTimerRef.current = null;
    }

    setManagedClass(null);
    setManagerMode("details");
    setManagerError("");
    setManagerSuccess("");
  }

  function buildCourseInvite(course) {
    const lines = [
      `You are invited to join ${course.name} on Praxis.`,
      "",
      `Course: ${course.name}`,
      `Term: ${course.semester || "Course"}`,
      `Access code: ${course.code}`,
      "",
      "To join:",
      "1. Open Praxis and sign in to your student account.",
      '2. Select "Join Course".',
      `3. Enter the access code ${course.code}.`,
    ];

    if (course.isPublished === false) {
      lines.push(
        "",
        "Note: The course must be published before students can join."
      );
    }

    return lines.join("\n");
  }

  async function writeClipboardText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error("Clipboard copy failed.");
    }
  }

  async function copyCourseInvite(course) {
    if (!course) return;

    setManagerError("");
    setManagerSuccess("");

    if (course.archived === true) {
      setManagerError("Restore the course before copying a student invite.");
      return;
    }

    try {
      await writeClipboardText(buildCourseInvite(course));
      showManagerSuccess("Course invite copied. It is ready to paste into Canvas.");
    } catch (error) {
      console.error("Could not copy the course invite:", error);
      setManagerError("Could not copy the invite. Please try again.");
    }
  }

  function toggleManagedCoursePublication() {
    if (!managedClass) return;

    setManagerError("");
    setManagerSuccess("");

    if (managedClass.archived === true) {
      setManagerError("Restore the course before changing publication status.");
      return;
    }

    const updatedClass = {
      ...managedClass,
      isPublished: managedClass.isPublished === false,
    };

    const updatedClasses = classes.map((cls) =>
      String(cls.id) === String(managedClass.id) ? updatedClass : cls
    );

    const data = getPraxisData();

    savePraxisData({
      ...data,
      classes: updatedClasses,
    });

    if (typeof setClasses === "function") {
      setClasses(updatedClasses);
    }

    setManagedClass(updatedClass);

    showManagerSuccess(
      updatedClass.isPublished === false
        ? "Course unpublished."
        : "Course published."
    );
  }

  function toggleManagedCourseArchive() {
    if (!managedClass) return;

    setManagerError("");
    setManagerSuccess("");

    const willArchive = managedClass.archived !== true;
    const now = new Date().toISOString();

    const updatedClass = {
      ...managedClass,
      archived: willArchive,
      archivedAt: willArchive ? now : null,
      // Archived courses are removed from everyday teacher/student workflows.
      // Restored courses remain unpublished until the teacher publishes them.
      isPublished: willArchive ? false : managedClass.isPublished,
    };

    const updatedClasses = classes.map((cls) =>
      String(cls.id) === String(managedClass.id) ? updatedClass : cls
    );

    const data = getPraxisData();

    savePraxisData({
      ...data,
      classes: updatedClasses,
    });

    if (typeof setClasses === "function") {
      setClasses(updatedClasses);
    }

    setManagedClass(updatedClass);

    showManagerSuccess(
      willArchive
        ? "Course archived. It is now hidden from assignment and message selectors."
        : "Course restored. Publish it when students should access it again."
    );
  }

  function removeManagedCourse() {
    if (!managedClass) return;

    const confirmed = window.confirm(
      `Remove ${managedClass.code} from the active workspace? Course, assignment, rubric, and de-identified submission evidence will be archived.`
    );

    if (!confirmed) return;

    const data = getPraxisData();
    const archivedAt = new Date().toISOString();

    const updatedClasses = classes.filter(
      (cls) => String(cls.id) !== String(managedClass.id)
    );

    const relatedAssignmentIds = (data.assignments || [])
      .filter((assignment) => {
        const sameClassId =
          assignment.classId &&
          String(assignment.classId) === String(managedClass.id);

        const sameClassCode =
          assignment.classCode?.toUpperCase() ===
          managedClass.code?.toUpperCase();

        return sameClassId || sameClassCode;
      })
      .map((assignment) => String(assignment.id));

    const updatedEnrollments = (data.enrollments || []).filter((enrollment) => {
      const sameClassId = String(enrollment.classId) === String(managedClass.id);

      const sameClassCode =
        enrollment.classCode?.toUpperCase() ===
        managedClass.code?.toUpperCase();

      return !sameClassId && !sameClassCode;
    });

    const updatedAssignments = (data.assignments || []).filter((assignment) => {
      const sameClassId =
        assignment.classId &&
        String(assignment.classId) === String(managedClass.id);

      const sameClassCode =
        assignment.classCode?.toUpperCase() ===
        managedClass.code?.toUpperCase();

      return !sameClassId && !sameClassCode;
    });

    const removedSubmissions =
      (data.submissions || []).filter((submission) => {
        const belongsToDeletedAssignment =
          relatedAssignmentIds.includes(
            String(submission.assignmentId)
          );

        const sameClassCode =
          submission.classCode?.toUpperCase() ===
          managedClass.code?.toUpperCase();

        return belongsToDeletedAssignment || sameClassCode;
      });

    const updatedSubmissions =
      (data.submissions || []).filter((submission) =>
        !removedSubmissions.some(
          (removed) =>
            String(removed.id) ===
            String(submission.id)
        )
      );

    const removedRubrics =
      (data.rubrics || []).filter((rubric) =>
        relatedAssignmentIds.includes(
          String(rubric.assignmentId)
        )
      );

    const updatedRubrics =
      (data.rubrics || []).filter((rubric) =>
        !relatedAssignmentIds.includes(
          String(rubric.assignmentId)
        )
      );

    const courseArchive = [
      ...(data.courseArchive || []),
      {
        ...managedClass,
        archivedAt,
        archiveReason: "teacher_deleted",
        assignments: (data.assignments || []).filter((assignment) =>
          relatedAssignmentIds.includes(
            String(assignment.id)
          )
        ),
        rubrics: removedRubrics,
        submissions: removedSubmissions.map((submission) => ({
          ...submission,
          studentName: "Archived Student",
          studentEmail: null,
          userEmail: null,
          archivedAt,
          archiveReason: "course_deleted",
        })),
      },
    ];

    savePraxisData({
      ...data,
      classes: updatedClasses,
      enrollments: updatedEnrollments,
      assignments: updatedAssignments,
      submissions: updatedSubmissions,
      rubrics: updatedRubrics,
      courseArchive,
    });

    if (typeof setClasses === "function") {
      setClasses(updatedClasses);
    }

    if (typeof setAssignments === "function") {
      setAssignments(updatedAssignments);
    }

    if (typeof setSubmissions === "function") {
      setSubmissions(updatedSubmissions);
    }

    if (typeof setRubrics === "function") {
      setRubrics(updatedRubrics);
    }

    setEnrollments(updatedEnrollments);
    closeCourseManager();
  }

  function handleUpdateManagedCourse(e) {
    e.preventDefault();

    if (!managedClass) return;

    setManagerError("");
    setManagerSuccess("");

    const cleanName = manageCourseForm.name.trim();

    if (!cleanName) {
      setManagerError("Course name is required.");
      return;
    }

    const updatedClass = {
      ...managedClass,
      name: cleanName,
      description:
        manageCourseForm.description.trim() ||
        "No course description specified.",
      semester: manageCourseForm.semester,
      isPublished: managedClass.isPublished !== false,
    };

    const updatedClasses = classes.map((cls) =>
      String(cls.id) === String(managedClass.id) ? updatedClass : cls
    );

    if (typeof setClasses === "function") {
      setClasses(updatedClasses);
    }

    setManagedClass(updatedClass);

    const data = getPraxisData();

    const updatedEnrollments = (data.enrollments || []).map((enrollment) => {
      const sameClassId = String(enrollment.classId) === String(managedClass.id);

      const sameClassCode =
        enrollment.classCode?.toUpperCase() ===
        managedClass.code?.toUpperCase();

      if (!sameClassId && !sameClassCode) {
        return enrollment;
      }

      return {
        ...enrollment,
        classId: updatedClass.id,
        classCode: updatedClass.code,
        className: updatedClass.name,
      };
    });

    const updatedAssignments = (data.assignments || []).map((assignment) => {
      const sameClassId =
        assignment.classId &&
        String(assignment.classId) === String(managedClass.id);

      const sameClassCode =
        assignment.classCode?.toUpperCase() ===
        managedClass.code?.toUpperCase();

      if (!sameClassId && !sameClassCode) {
        return assignment;
      }

      return {
        ...assignment,
        classId: updatedClass.id,
        classCode: updatedClass.code,
        className: updatedClass.name,
      };
    });

    const updatedSubmissions = (data.submissions || []).map((submission) => {
      const sameClassCode =
        submission.classCode?.toUpperCase() ===
        managedClass.code?.toUpperCase();

      if (!sameClassCode) {
        return submission;
      }

      return {
        ...submission,
        classCode: updatedClass.code,
        className: updatedClass.name,
      };
    });

    savePraxisData({
      ...data,
      classes: updatedClasses,
      enrollments: updatedEnrollments,
      assignments: updatedAssignments,
      submissions: updatedSubmissions,
    });

    if (typeof setAssignments === "function") {
      setAssignments(updatedAssignments);
    }

    if (typeof setSubmissions === "function") {
      setSubmissions(updatedSubmissions);
    }

    setEnrollments(updatedEnrollments);
    showManagerSuccess("Course updated.");
  }

  function handleAddStudentToManagedCourse(e) {
    e.preventDefault();

    if (!managedClass) return;

    setManagerError("");
    setManagerSuccess("");

    const cleanName = studentNameToAdd.trim() || "Student";
    const cleanEmail = studentEmailToAdd.trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setManagerError("Please enter a valid student email.");
      return;
    }

    if (managedClass.archived === true) {
      setManagerError("Restore the course before adding students.");
      return;
    }

    if (managedClass.isPublished === false) {
      setManagerError("Publish the course before adding students.");
      return;
    }

    const classEnrollments = getClassEnrollments(managedClass);

    const alreadyEnrolled = classEnrollments.some(
      (enrollment) => enrollment.studentEmail?.toLowerCase() === cleanEmail
    );

    if (alreadyEnrolled) {
      setManagerError("This student is already enrolled in this course.");
      return;
    }

    const newEnrollment = {
      id: "enr_" + Date.now(),
      studentName: cleanName,
      studentEmail: cleanEmail,
      classId: managedClass.id,
      classCode: managedClass.code,
      className: managedClass.name,
      enrolledAt: new Date().toISOString(),
    };

    const data = getPraxisData();
    const updatedEnrollments = [...(data.enrollments || []), newEnrollment];

    savePraxisData({
      ...data,
      enrollments: updatedEnrollments,
    });

    setEnrollments(updatedEnrollments);
    setStudentNameToAdd("");
    setStudentEmailToAdd("");
    showManagerSuccess(`${cleanEmail} added to ${managedClass.code}.`);
  }

  function removeStudentFromManagedCourse(enrollmentId) {
    if (!managedClass) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this student from the course?"
    );

    if (!confirmed) return;

    const data = getPraxisData();

    const updatedEnrollments = (data.enrollments || []).filter(
      (enrollment) => String(enrollment.id) !== String(enrollmentId)
    );

    savePraxisData({
      ...data,
      enrollments: updatedEnrollments,
    });

    setEnrollments(updatedEnrollments);
    showManagerSuccess("Student removed from the course.");
  }

  const pageTitles = {
    overview: "Home",
    assignments: "Assignments",
    communication: "Messages",
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F8FAFC] flex font-sans antialiased text-slate-950 selection:bg-blue-100 selection:text-blue-900">
      <style>{`
        .blueprint-grid {
          background-image: linear-gradient(to right, rgba(37, 99, 235, 0.045) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(37, 99, 235, 0.045) 1px, transparent 1px);
          background-size: 3rem 3rem;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseBreathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(0.96); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .status-pulse {
          animation: pulseBreathe 2s infinite ease-in-out;
        }
        .glow-box-classes:hover {
          box-shadow: 0 12px 30px -10px rgba(37, 99, 235, 0.12), 0 0 0 1px rgba(37, 99, 235, 0.25);
          border-color: rgba(37, 99, 235, 0.35);
        }
        .glow-box-assignments:hover {
          box-shadow: 0 12px 30px -10px rgba(79, 70, 229, 0.12), 0 0 0 1px rgba(79, 70, 229, 0.25);
          border-color: rgba(79, 70, 229, 0.35);
        }
        .glow-box-reviews:hover {
          box-shadow: 0 12px 30px -10px rgba(14, 165, 233, 0.12), 0 0 0 1px rgba(14, 165, 233, 0.25);
          border-color: rgba(14, 165, 233, 0.35);
        }
      `}</style>

      <aside className="w-68 h-full bg-slate-950 text-slate-200 flex flex-col justify-between shrink-0 shadow-2xl relative z-20">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-6 border-b border-blue-900/30 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white border border-blue-400/20 shadow-md shadow-blue-900/30 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/praxis-logo.png"
                alt="Praxis logo"
                className="w-9 h-9 object-contain"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight leading-none">
                <span className="text-blue-400">p</span>
                <span className="text-white">raxis</span>
              </h1>

              <p className="text-[9px] font-mono font-bold text-blue-300 uppercase tracking-wider mt-1.5">
                Teacher Dashboard
              </p>
            </div>
          </div>

          <div className="p-5 space-y-7 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-3 mb-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block">
                  Create Course
                </span>

                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-blue-300 hover:border-blue-400 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <SidebarButton
                active={activeTab === "overview"}
                icon={Home}
                label="Home"
                onClick={() => setActiveTab("overview")}
              />

              <SidebarButton
                active={activeTab === "assignments"}
                icon={BookOpen}
                label="Assignments"
                badge={totalAssignmentsCount}
                onClick={openAssignmentList}
              />

              

              
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block px-3 mb-2">
                Engagement
              </span>

              <SidebarButton
                active={activeTab === "communication"}
                icon={MessageSquare}
                label="Messages"
                onClick={() => setActiveTab("communication")}
              />
            </div>

            <div className="pt-5 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-slate-500">
                    Notifications
                  </span>

                  {sidebarNotifications.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.9)]" />
                  )}
                </div>

                <span
                  className={`inline-flex min-w-6 items-center justify-center rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-black ${
                    sidebarNotifications.length > 0
                      ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
                      : "border-slate-800 bg-slate-900 text-slate-600"
                  }`}
                >
                  {sidebarNotifications.length > 9
                    ? "9+"
                    : sidebarNotifications.length}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-slate-950/70 shadow-[0_14px_34px_-24px_rgba(37,99,235,0.8)]">
                <div className="flex items-center justify-between border-b border-slate-800/80 px-3.5 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                      <Bell className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-200">
                        Review inbox
                      </p>
                      <p className="truncate text-[8px] text-slate-500">
                        Current-course activity
                      </p>
                    </div>
                  </div>

                  {sidebarNotifications.length > 0 && (
                    <button
                      type="button"
                      onClick={openPendingReviews}
                      className="rounded-lg border border-slate-700/80 bg-slate-900 px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wide text-blue-300 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10"
                    >
                      Open
                    </button>
                  )}
                </div>

                {sidebarNotifications.length === 0 ? (
                  <div className="flex flex-col items-center px-4 py-5 text-center">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/80 text-slate-500">
                      <Bell className="h-4 w-4" />
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-slate-700" />
                    </div>

                    <p className="mt-3 text-[10px] font-bold text-slate-300">
                      You are all caught up
                    </p>

                    <p className="mt-1 max-w-[170px] text-[9px] leading-relaxed text-slate-600">
                      New submissions and resubmissions from current courses will appear here.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 p-2">
                      {sidebarNotifications.slice(0, 3).map((notification) => {
                        const isResubmission =
                          notification.type === "resubmission";
                        const isLate = notification.type === "late";
                        const NotificationIcon = isResubmission
                          ? RotateCcw
                          : isLate
                          ? Clock3
                          : FileCheck2;

                        const tone = isResubmission
                          ? {
                              icon: "border-violet-500/25 bg-violet-500/10 text-violet-300",
                              line: "bg-violet-400",
                              chip: "border-violet-500/20 bg-violet-500/10 text-violet-300",
                            }
                          : isLate
                          ? {
                              icon: "border-amber-500/25 bg-amber-500/10 text-amber-300",
                              line: "bg-amber-400",
                              chip: "border-amber-500/20 bg-amber-500/10 text-amber-300",
                            }
                          : {
                              icon: "border-blue-500/25 bg-blue-500/10 text-blue-300",
                              line: "bg-blue-400",
                              chip: "border-blue-500/20 bg-blue-500/10 text-blue-300",
                            };

                        return (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() =>
                              openSidebarNotification(notification)
                            }
                            className="group relative flex w-full items-start gap-2.5 overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/55 px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:border-slate-700 hover:bg-slate-900 hover:shadow-lg"
                          >
                            <span
                              className={`absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full ${tone.line}`}
                            />

                            <div
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${tone.icon}`}
                            >
                              <NotificationIcon className="h-3.5 w-3.5" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-1.5">
                                <p className="min-w-0 flex-1 truncate text-[9.5px] font-bold text-slate-200 group-hover:text-white">
                                  {notification.title}
                                </p>

                                <span
                                  className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase tracking-wide ${tone.chip}`}
                                >
                                  {formatRelativeTime(notification.createdAt)}
                                </span>
                              </div>

                              <p className="mt-1 truncate text-[9px] font-semibold text-slate-400">
                                {notification.studentLabel}
                              </p>

                              <div className="mt-0.5 flex items-center gap-1">
                                <p className="min-w-0 flex-1 truncate text-[8px] text-slate-600">
                                  {notification.assignmentLabel}
                                </p>
                                <ChevronRight className="h-3 w-3 shrink-0 text-slate-700 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-400" />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={openPendingReviews}
                      className="flex w-full items-center justify-between border-t border-slate-800/80 px-3.5 py-2.5 text-left transition-colors hover:bg-blue-500/5"
                    >
                      <span className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Review queue
                      </span>

                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-300">
                        {sidebarNotifications.length} pending
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </button>
                  </>
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
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-mono font-black text-white shadow-md shadow-blue-600/20">
                    {teacherIdentity.initials}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">
                      {teacherIdentity.name}
                    </p>

                    <p className="mt-0.5 truncate text-[9px] font-mono text-slate-400">
                      {teacherIdentity.email}
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
                  <span className="flex-1">Change Password</span>
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
            onClick={toggleAccountMenu}
            className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
              isAccountMenuOpen
                ? "border-blue-500/40 bg-blue-500/10"
                : "border-transparent hover:border-slate-800 hover:bg-slate-900/70"
            }`}
            aria-expanded={isAccountMenuOpen}
            aria-label="Open teacher account menu"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-mono font-black text-white shadow-md shadow-blue-600/20">
              {teacherIdentity.initials}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="truncate text-xs font-bold text-white">
                {teacherIdentity.name}
              </h4>

              <p className="truncate text-[9px] font-mono text-slate-400">
                {teacherIdentity.email}
              </p>
            </div>

            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                isAccountMenuOpen ? "rotate-180 text-blue-300" : ""
              }`}
            />
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Workspace</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-950 font-bold uppercase tracking-wider font-mono">
              {pageTitles[activeTab] || "Teacher Workspace"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="bg-slate-950 hover:bg-slate-800 text-white font-sans text-xs font-bold px-4 py-2 rounded-xl transition-all tracking-wide flex items-center gap-1.5 shadow-sm cursor-pointer hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4" />
            Create Course
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative blueprint-grid">
          <div className="max-w-7xl mx-auto h-full flex flex-col relative z-10 space-y-8">
            {activeTab === "overview" && (
              <OverviewPanel
                classes={classes}
                totalClassesCount={totalClassesCount}
                totalAssignmentsCount={totalAssignmentsCount}
                pendingReviewsCount={pendingReviewsCount}
                computeCourseStatus={computeCourseStatus}
                getClassEnrollments={getClassEnrollments}
                expandedClassId={expandedClassId}
                setExpandedClassId={setExpandedClassId}
                openCourseManager={openCourseManager}
                onCreateAssignment={openCreateAssignment}
                onOpenReviews={openPendingReviews}
              />
            )}

            {activeTab === "assignments" && (
              <TeacherAssignments
                workspaceRequest={assignmentWorkspaceRequest}
              />
            )}

            {activeTab === "communication" && <TeacherCommunication />}
          </div>
        </div>
      </main>

      {isCreateOpen && (
        <CreateCourseModal
          classNameInput={classNameInput}
          setClassNameInput={setClassNameInput}
          descriptionInput={descriptionInput}
          setDescriptionInput={setDescriptionInput}
          semesterInput={semesterInput}
          setSemesterInput={setSemesterInput}
          createError={createError}
          createSuccess={createSuccess}
          handleCreateCourse={handleCreateCourse}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {managedClass && (
        <CourseManagerModal
          managedClass={managedClass}
          managerMode={managerMode}
          setManagerMode={setManagerMode}
          manageCourseForm={manageCourseForm}
          setManageCourseForm={setManageCourseForm}
          studentNameToAdd={studentNameToAdd}
          setStudentNameToAdd={setStudentNameToAdd}
          studentEmailToAdd={studentEmailToAdd}
          setStudentEmailToAdd={setStudentEmailToAdd}
          managerError={managerError}
          managerSuccess={managerSuccess}
          closeCourseManager={closeCourseManager}
          copyCourseInvite={copyCourseInvite}
          toggleManagedCoursePublication={toggleManagedCoursePublication}
          toggleManagedCourseArchive={toggleManagedCourseArchive}
          removeManagedCourse={removeManagedCourse}
          handleUpdateManagedCourse={handleUpdateManagedCourse}
          handleAddStudentToManagedCourse={handleAddStudentToManagedCourse}
          removeStudentFromManagedCourse={removeStudentFromManagedCourse}
          computeCourseStatus={computeCourseStatus}
          getClassEnrollments={getClassEnrollments}
        />
      )}


      <button
        type="button"
        onClick={openBugReportForm}
        className="fixed bottom-6 right-4 z-40 inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-[0_12px_34px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-[0_16px_40px_rgba(37,99,235,0.18)] focus:outline-none focus:ring-4 focus:ring-blue-500/15 sm:right-5 md:right-6 lg:right-8"
        aria-label="Report a bug"
      >
        <Megaphone className="h-4 w-4" />
        Report a Bug
      </button>

      {isPasswordPanelOpen && (
        <TeacherPasswordModal
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          passwordUiMessage={passwordUiMessage}
          setPasswordUiMessage={setPasswordUiMessage}
          onSubmit={handlePasswordUiSubmit}
          onClose={closePasswordPanel}
        />
      )}

      {isBugReportOpen && (
        <TeacherBugReportModal
          bugDescription={bugDescription}
          setBugDescription={setBugDescription}
          bugScreenshot={bugScreenshot}
          bugReportError={bugReportError}
          setBugReportError={setBugReportError}
          bugReportSuccess={bugReportSuccess}
          setBugReportSuccess={setBugReportSuccess}
          isSubmitting={isSubmittingBugReport}
          bugFileInputKey={bugFileInputKey}
          onScreenshotChange={handleBugScreenshotChange}
          onRemoveScreenshot={removeBugScreenshot}
          onSubmit={handleBugReportSubmit}
          onClose={closeBugReportForm}
        />
      )}
    </div>
  );
}

function OverviewPanel({
  classes,
  totalClassesCount,
  totalAssignmentsCount,
  pendingReviewsCount,
  computeCourseStatus,
  getClassEnrollments,
  expandedClassId,
  setExpandedClassId,
  openCourseManager,
  onCreateAssignment,
  onOpenReviews,
}) {
  const [courseFilter, setCourseFilter] = useState("current");

  const currentCourses = useMemo(
    () => classes.filter((course) => course?.archived !== true),
    [classes]
  );

  const pastCourses = useMemo(
    () => classes.filter((course) => course?.archived === true),
    [classes]
  );

  const displayedCourses =
    courseFilter === "past" ? pastCourses : currentCourses;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in-up">
        <button
          type="button"
          onClick={onCreateAssignment}
          className="group text-left rounded-2xl border border-slate-950 bg-slate-950 p-5 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-lg"
        >
          <div className="flex items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                <Plus className="h-5 w-5" />
              </div>

              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-blue-300">
                  Primary Action
                </p>

                <h2 className="mt-1 text-lg font-bold">
                  Create an assignment
                </h2>

                <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-300">
                  Build, configure, publish, and manage assignments for your
                  courses.
                </p>
              </div>
            </div>

            <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenReviews}
          disabled={pendingReviewsCount === 0}
          className={`group text-left rounded-2xl border p-5 shadow-sm transition-all ${
            pendingReviewsCount > 0
              ? "border-blue-200 bg-white hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
              : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-75"
          }`}
        >
          <div className="flex items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                <CheckSquare className="h-5 w-5" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-blue-700">
                    Review Work
                  </p>

                  {pendingReviewsCount > 0 && (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-bold text-white">
                      {pendingReviewsCount} pending
                    </span>
                  )}
                </div>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Grade student work
                </h2>

                <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
                  {pendingReviewsCount > 0
                    ? "Open the next assignment with pending submissions and continue grading."
                    : "There are no student submissions waiting for review."}
                </p>
              </div>
            </div>

            <ChevronRight
              className={`mt-1 h-5 w-5 shrink-0 transition-transform ${
                pendingReviewsCount > 0
                  ? "text-slate-300 group-hover:translate-x-1 group-hover:text-blue-600"
                  : "text-slate-300"
              }`}
            />
          </div>
        </button>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up [animation-delay:100ms]">
        <MetricCard
          cardType="classes"
          icon={Layers}
          label="Active Courses"
          value={`${totalClassesCount} Courses`}
          description="Current courses shown in everyday teacher workflows."
          tone="blue"
        />

        <MetricCard
          cardType="assignments"
          icon={BookOpen}
          label="Assignments"
          value={`${totalAssignmentsCount} Assignments`}
          description="Writing assignments configured for your courses."
          tone="indigo"
        />

        <MetricCard
          cardType="reviews"
          icon={ShieldCheck}
          label="Pending Reviews"
          value={`${pendingReviewsCount} Submissions`}
          description="Student submissions waiting for your review."
          tone="sky"
        />
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 animate-fade-in-up [animation-delay:150ms]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-slate-900">
              Courses & Access Codes
            </h3>

            <p className="text-xs text-slate-400 font-medium">
              Current courses are shown by default. Open Past to manage archived courses.
            </p>
          </div>

          <div
            className="inline-flex w-fit items-center rounded-xl border border-slate-200 bg-slate-50 p-1"
            role="group"
            aria-label="Filter courses"
          >
            <button
              type="button"
              onClick={() => setCourseFilter("current")}
              aria-pressed={courseFilter === "current"}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold transition-all ${
                courseFilter === "current"
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Current
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] ${
                  courseFilter === "current"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-slate-200/70 text-slate-500"
                }`}
              >
                {currentCourses.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCourseFilter("past")}
              aria-pressed={courseFilter === "past"}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold transition-all ${
                courseFilter === "past"
                  ? "bg-white text-amber-700 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Past
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] ${
                  courseFilter === "past"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-200/70 text-slate-500"
                }`}
              >
                {pastCourses.length}
              </span>
            </button>
          </div>
        </div>

        {displayedCourses.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-10 text-center text-xs text-slate-400 font-mono">
            {courseFilter === "current"
              ? 'No current courses. Use "Create Course" in the top-right corner to add one.'
              : "No past courses yet. Archived courses will appear here."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayedCourses.map((cls) => {
              const status = computeCourseStatus(cls);
              const classEnrollments = getClassEnrollments(cls);
              const isRosterOpen = expandedClassId === cls.id;

              return (
                <div
                  key={cls.id}
                  className={`p-5 border rounded-2xl flex flex-col justify-between space-y-4 transition-all hover:bg-white hover:shadow-md group ${
                    cls.archived === true
                      ? "bg-amber-50/40 border-amber-200/80"
                      : "bg-[#F8FAFC] border-slate-200/80"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                            {cls.semester}
                          </span>

                          <span
                            className={`text-[9px] font-mono border px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${status.styles}`}
                          >
                            {status.text}
                          </span>
                        </div>

                        <h5 className="text-xs font-black text-slate-900 tracking-wide uppercase font-sans truncate mt-1">
                          {cls.name}
                        </h5>
                      </div>

                      <span className="font-mono text-xs font-black bg-blue-600/10 text-blue-700 px-2 py-1 rounded border border-blue-600/20 shadow-inner shrink-0">
                        {cls.code}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 font-medium line-clamp-2 leading-relaxed">
                      {cls.description}
                    </p>

                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-200/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openCourseManager(cls)}
                        className="w-full flex items-center justify-center gap-2 bg-slate-950 border border-[#0B1320] rounded-xl px-3 py-2 text-[10px] font-mono font-bold text-white hover:bg-slate-800 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Manage Course
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedClassId(isRosterOpen ? null : cls.id)
                        }
                        className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-mono font-bold text-slate-600 hover:border-blue-600/40 hover:text-blue-600 transition-all"
                      >
                        <span>Students</span>
                        <span>{isRosterOpen ? "Hide" : "Show"}</span>
                      </button>
                    </div>

                    {isRosterOpen && (
                      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                        {classEnrollments.length === 0 ? (
                          <p className="text-[10px] text-slate-400 font-mono">
                            No students enrolled yet.
                          </p>
                        ) : (
                          classEnrollments.map((enrollment) => (
                            <div
                              key={enrollment.id}
                              className="flex items-center justify-between gap-2 bg-[#F8FAFC] border border-slate-100 rounded-lg px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-800 truncate">
                                  {enrollment.studentName || "Student"}
                                </p>

                                <p className="text-[9px] font-mono text-slate-400 truncate">
                                  {enrollment.studentEmail}
                                </p>
                              </div>

                              <span className="text-[8px] font-mono font-bold uppercase bg-blue-600/10 text-blue-600 px-2 py-0.5 rounded">
                                Enrolled
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateCourseModal({
  classNameInput,
  setClassNameInput,
  descriptionInput,
  setDescriptionInput,
  semesterInput,
  setSemesterInput,
  createError,
  createSuccess,
  handleCreateCourse,
  onClose,
}) {
  const canCreateCourse = Boolean(classNameInput.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
      />

      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-7 relative z-10 shadow-2xl flex flex-col gap-5 font-sans animate-fade-in-up my-8">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-blue-600 font-mono font-bold text-[10px] tracking-widest uppercase bg-blue-600/5 px-2 py-0.5 rounded border border-blue-600/10">
              <Sparkle className="w-3 h-3 text-blue-600 fill-blue-600" />
              Course Setup
            </div>

            <h3 className="font-serif text-xl font-black text-slate-900 mt-2">
              Create New Course
            </h3>

            <p className="text-xs text-slate-400 font-medium">
              Add the course name, semester, and an optional description.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close create course"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block px-1">
              Course Name
            </label>

            <input
              type="text"
              required
              autoFocus
              value={classNameInput}
              onChange={(e) => setClassNameInput(e.target.value)}
              placeholder="e.g. Moroccan Studies & Architecture"
              className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 rounded-xl px-4 py-3 text-xs focus:outline-none transition-all shadow-inner"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block px-1">
              Academic Semester
            </label>

            <select
              value={semesterInput}
              onChange={(e) => setSemesterInput(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:border-slate-400 cursor-pointer shadow-inner font-mono font-bold uppercase"
            >
              <option value="Fall 2026">Fall 2026</option>
              <option value="Spring 2027">Spring 2027</option>
              <option value="Summer 2027">Summer 2027</option>
              <option value="Fall 2027">Fall 2027</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block px-1">
              Course Description
              <span className="normal-case tracking-normal font-sans font-medium text-slate-300 ml-1">
                (optional)
              </span>
            </label>

            <textarea
              rows={3}
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder="Add a short description or important note..."
              className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none transition-all resize-none shadow-inner"
            />
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-[11px] leading-relaxed text-blue-800">
              Praxis creates a unique student access code automatically.
            </p>
          </div>

          {createError && (
            <div className="p-3 bg-red-500/5 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-sans">
              <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-red-600" />
              <span className="font-semibold">{createError}</span>
            </div>
          )}

          {createSuccess && (
            <div className="p-3 bg-blue-500/5 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-600 font-mono">
              <CheckSquare className="w-4.5 h-4.5 shrink-0" />
              <span>{createSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!canCreateCourse}
            className={`w-full font-sans text-xs font-bold py-3.5 rounded-xl shadow-md transition-all ${
              canCreateCourse
                ? "bg-slate-950 text-white hover:bg-slate-800 hover:scale-[1.01] cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            Create Course
          </button>
        </form>
      </div>
    </div>
  );
}

function CourseManagerModal({
  managedClass,
  managerMode,
  setManagerMode,
  manageCourseForm,
  setManageCourseForm,
  studentNameToAdd,
  setStudentNameToAdd,
  studentEmailToAdd,
  setStudentEmailToAdd,
  managerError,
  managerSuccess,
  closeCourseManager,
  copyCourseInvite,
  toggleManagedCoursePublication,
  toggleManagedCourseArchive,
  removeManagedCourse,
  handleUpdateManagedCourse,
  handleAddStudentToManagedCourse,
  removeStudentFromManagedCourse,
  computeCourseStatus,
  getClassEnrollments,
}) {
  const publicationTooltip =
    managedClass.isPublished === false
      ? "Make the course visible and allow students to join."
      : "Hide the course from students. Existing work is kept.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        onClick={closeCourseManager}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
      />

      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl relative z-10 shadow-2xl font-sans animate-fade-in-up my-8 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-blue-600 font-mono font-bold text-[10px] tracking-widest uppercase bg-blue-600/5 px-2 py-0.5 rounded border border-blue-600/10">
              <Settings className="w-3 h-3" />
              Course Manager
            </div>

            <h3 className="font-serif text-2xl font-black text-slate-900 mt-2">
              {managedClass.name}
            </h3>

            <p className="text-xs text-slate-400 font-mono mt-1">
              {managedClass.code} · {managedClass.semester || "Course"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={managedClass.archived === true}
              onClick={() => copyCourseInvite(managedClass)}
              className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
              title={
                managedClass.archived === true
                  ? "Restore the course before copying an invite"
                  : "Copy a student course invitation"
              }
            >
              <Copy className="w-4 h-4" />
              Copy Invite
            </button>

            <div className="relative group">
              <button
                type="button"
                disabled={managedClass.archived === true}
                onClick={toggleManagedCoursePublication}
                className={`inline-flex items-center gap-2 border text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  managedClass.isPublished === false
                    ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-white"
                }`}
              >
                {managedClass.isPublished === false ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}

                {managedClass.isPublished === false
                  ? "Publish Course"
                  : "Unpublish Course"}
              </button>

              <div className="pointer-events-none absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-600 shadow-xl opacity-0 translate-y-1 transition-all group-hover:opacity-100 group-hover:translate-y-0 z-30">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <span>{publicationTooltip}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleManagedCourseArchive}
              className={`inline-flex items-center gap-2 border text-xs font-bold px-4 py-2.5 rounded-xl transition-all ${
                managedClass.archived === true
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              <Archive className="w-4 h-4" />
              {managedClass.archived === true
                ? "Restore Course"
                : "Archive Course"}
            </button>

            <button
              type="button"
              onClick={removeManagedCourse}
              className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-100 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Remove Course
            </button>

            <button
              type="button"
              onClick={closeCourseManager}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {(managerError || managerSuccess) && (
          <div className="px-6 pt-4">
            <div
              role="status"
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                managerError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
              }`}
            >
              {managerError ? (
                <ShieldAlert className="h-4 w-4 shrink-0" />
              ) : (
                <CheckSquare className="h-4 w-4 shrink-0" />
              )}

              <span className="font-semibold">
                {managerError || managerSuccess}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-0">
          <div className="p-6 border-r border-slate-100">
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setManagerMode("details")}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  managerMode === "details"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Course Details
              </button>

              <button
                type="button"
                onClick={() => setManagerMode("students")}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  managerMode === "students"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Students
              </button>
            </div>

            {managerMode === "details" ? (
              <form onSubmit={handleUpdateManagedCourse} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Course Name
                  </label>

                  <input
                    value={manageCourseForm.name}
                    onChange={(e) =>
                      setManageCourseForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 uppercase font-mono rounded-xl px-4 py-3 text-xs focus:outline-none transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Semester
                  </label>

                  <select
                    value={manageCourseForm.semester}
                    onChange={(e) =>
                      setManageCourseForm((prev) => ({
                        ...prev,
                        semester: e.target.value,
                      }))
                    }
                    className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:border-slate-400 cursor-pointer shadow-inner font-mono font-bold uppercase"
                  >
                    <option value="Fall 2026">Fall 2026</option>
                    <option value="Spring 2027">Spring 2027</option>
                    <option value="Summer 2027">Summer 2027</option>
                    <option value="Fall 2027">Fall 2027</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Course Description
                  </label>

                  <textarea
                    rows={3}
                    value={manageCourseForm.description}
                    onChange={(e) =>
                      setManageCourseForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none transition-all resize-none shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-950 text-white hover:bg-slate-800 font-sans text-xs font-bold py-3.5 rounded-xl shadow-md transition-all hover:scale-[1.01]"
                >
                  Save Course Changes
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <form
                  onSubmit={handleAddStudentToManagedCourse}
                  className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-blue-600" />

                    <h4 className="text-sm font-bold text-slate-900">
                      Add Student Manually
                    </h4>
                  </div>

                  <input
                    value={studentNameToAdd}
                    onChange={(e) => setStudentNameToAdd(e.target.value)}
                    placeholder="Student name"
                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-slate-400"
                  />

                  <input
                    value={studentEmailToAdd}
                    onChange={(e) => setStudentEmailToAdd(e.target.value)}
                    placeholder="student@aui.ma"
                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-slate-400"
                  />

                  <button
                    type="submit"
                    className="w-full bg-slate-900 text-white text-xs font-bold rounded-xl py-3 hover:bg-slate-800 transition-all"
                  >
                    Add Student to Course
                  </button>
                </form>

                <div className="space-y-2">
                  {getClassEnrollments(managedClass).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                      No students enrolled in this course yet.
                    </div>
                  ) : (
                    getClassEnrollments(managedClass).map((enrollment) => (
                      <div
                        key={enrollment.id}
                        className="flex items-center justify-between gap-3 bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {enrollment.studentName || "Student"}
                          </p>

                          <p className="text-[10px] font-mono text-slate-400 truncate">
                            {enrollment.studentEmail}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeStudentFromManagedCourse(enrollment.id)
                          }
                          className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold px-3 py-2 rounded-xl hover:bg-red-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#F8FAFC] p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Course Access
                </p>

                <span
                  className={`inline-flex text-[9px] font-mono font-bold uppercase border px-2 py-1 rounded ${
                    computeCourseStatus(managedClass).styles
                  }`}
                >
                  {computeCourseStatus(managedClass).text}
                </span>
              </div>

              <p className="mt-4 text-3xl font-mono font-black tracking-wide text-blue-700">
                {managedClass.code}
              </p>

              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {managedClass.archived === true
                  ? "Archived courses are kept for records but hidden from assignment and message course selectors."
                  : "Students enter this code in Praxis to join the course."}
              </p>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherPasswordModal({
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  passwordUiMessage,
  setPasswordUiMessage,
  onSubmit,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
        <button
          type="button"
          onClick={onClose}
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
            The interface is ready. The password update will be connected to the backend later.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="teacher-new-password"
              className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400"
            >
              New password
            </label>

            <input
              id="teacher-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setPasswordUiMessage("");
              }}
              placeholder="At least 8 characters"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="teacher-confirm-password"
              className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400"
            >
              Confirm password
            </label>

            <input
              id="teacher-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
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
              onClick={onClose}
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
  );
}

function TeacherBugReportModal({
  bugDescription,
  setBugDescription,
  bugScreenshot,
  bugReportError,
  setBugReportError,
  bugReportSuccess,
  setBugReportSuccess,
  isSubmitting,
  bugFileInputKey,
  onScreenshotChange,
  onRemoveScreenshot,
  onSubmit,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
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
              Describe what happened. Praxis automatically includes your current teacher workspace and assignment context.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="teacher-bug-description"
                className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400"
              >
                What happened?
              </label>

              <textarea
                id="teacher-bug-description"
                value={bugDescription}
                disabled={isSubmitting}
                onChange={(event) => {
                  setBugDescription(event.target.value);
                  if (bugReportError) setBugReportError("");
                  if (bugReportSuccess) setBugReportSuccess("");
                }}
                rows={5}
                maxLength={1500}
                placeholder="Example: I clicked Review, but the submission workspace did not open."
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
                    disabled={isSubmitting}
                    onChange={onScreenshotChange}
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
                      onClick={onRemoveScreenshot}
                      disabled={isSubmitting}
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
                        {formatBugFileSize(bugScreenshot.size)}
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
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  isSubmitting || bugDescription.trim().length < 10
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? "Sending report..." : "Send Report"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function SidebarButton({
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
      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left group cursor-pointer border ${
        active
          ? "bg-slate-800/80 text-white border-slate-700 shadow-inner"
          : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800/30"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon
          className={`w-4 h-4 stroke-[1.8] ${
            active ? "text-blue-300" : "text-slate-500"
          }`}
        />

        <span>{label}</span>
      </div>

      {badge !== undefined && (
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
            active
              ? badgeTone === "blue"
                ? "bg-blue-500 text-white"
                : "bg-blue-600 text-white"
              : "bg-slate-800 text-slate-500"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function MetricCard({ icon: Icon, label, value, description, tone, cardType }) {
  const toneStyles = {
    blue: {
      icon: "bg-blue-50 border-blue-100 text-blue-700",
      label: "text-blue-700 bg-blue-50 border-blue-100",
    },
    indigo: {
      icon: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600",
      label: "text-indigo-700 bg-indigo-500/5 border-indigo-500/10",
    },
    sky: {
      icon: "bg-sky-50 border-sky-100 text-sky-700",
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
          className={`text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded border inline-block ${styles.label}`}
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
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  ClipboardCheck,
  Eye,
  Layers,
  Plus,
  Search,
} from "lucide-react";

import { useTeacherWorkspace } from "../../hooks/useTeacherWorkspace";

import {
  getAssignmentBuilderDraft,
} from "../../services/teacherApi";

const ASSIGNMENTS_PER_PAGE = 8;

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  const orderedPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  return orderedPages.flatMap((page, index) => {
    const previousPage = orderedPages[index - 1];
    return previousPage && page - previousPage > 1
      ? [`ellipsis-${previousPage}-${page}`, page]
      : [page];
  });
}

const CreateAssignmentModal = lazy(
  () => import("../../components/teacher/CreateAssignmentModal")
);
const TeacherAssignmentDetails = lazy(
  () => import("./TeacherAssignmentDetails")
);
const TeacherSubmissions = lazy(
  () => import("./submissions/TeacherSubmissions")
);

function WorkspaceLoading() {
  return (
    <div
      className="flex min-h-48 items-center justify-center text-sm font-semibold text-slate-500"
      role="status"
    >
      Loading workspace…
    </div>
  );
}

// --- Normalize Status and Submissions Helpers ---

function normalizeAssignmentStatus(assignment) {
  const rawValue =
    assignment?.status ||
      assignment?.publicationStatus ||
      assignment?.state ||
      "";
  const value = String(rawValue).toLowerCase();

  if (value) {
    if (
      value === "published" ||
      value === "active"
    ) {
      return "Published";
    }

    if (value === "scheduled") {
      return "Scheduled";
    }

    return "Draft";
  }

  if (assignment?.isPublished === true || assignment?.published === true) {
    return "Published";
  }
  return "Draft";
}

function getAssignmentLifecycleStatus(
  assignment,
  builderDraftAssignmentId = ""
) {
  const publicationStatus =
    normalizeAssignmentStatus(
      assignment
    );

  if (
    publicationStatus ===
    "Published"
  ) {
    return "Published";
  }

  if (
    publicationStatus ===
    "Scheduled"
  ) {
    return "Scheduled";
  }

  const assignmentId =
    String(
      assignment?.id || ""
    );

  const recoveryAssignmentId =
    String(
      builderDraftAssignmentId || ""
    );

  /*
   * The active builder recovery record is the authoritative
   * signal that creation has not been completed yet.
   */
  if (
    assignmentId &&
    recoveryAssignmentId &&
    assignmentId ===
      recoveryAssignmentId
  ) {
    return "Draft";
  }

  return "Unpublished";
}


function getAssignmentCriteriaCount(assignment = {}) {
  const schemaCriteria = Array.isArray(assignment?.rubricSchema?.criteria)
    ? assignment.rubricSchema.criteria
    : [];

  if (schemaCriteria.length > 0) {
    return schemaCriteria.length;
  }

  const rubricCriteria = Array.isArray(assignment?.rubric)
    ? assignment.rubric
    : [];

  return rubricCriteria.length;
}

function isAssignmentComplete(assignment = {}) {
  const title = String(assignment.title || "").trim();
  const description = String(
    assignment.description || assignment.instructions || ""
  ).trim();
  const dueDate = String(assignment.dueDate || assignment.deadline || "").trim();
  const level = String(
    assignment.studentLevel || assignment.languageLevel || ""
  ).trim();
  const type = String(
    assignment.assignmentType || assignment.assignment_type || ""
  ).trim();

  const minWords = Number(
    assignment.minWords ?? assignment.wordCountMin ?? assignment.word_count_min ?? 0
  );
  const maxWords = Number(
    assignment.maxWords ?? assignment.wordCountMax ?? assignment.word_count_max ?? 0
  );

  const hasClass = Boolean(
    assignment.classId ||
      String(assignment.classCode || "").trim() ||
      String(assignment.className || "").trim()
  );

  return Boolean(
    title &&
      title.toLowerCase() !== "untitled draft assignment" &&
      description &&
      dueDate &&
      level &&
      type &&
      hasClass &&
      minWords > 0 &&
      maxWords >= minWords &&
      getAssignmentCriteriaCount(assignment) > 0
  );
}

function normalizeSubmissionStatus(submission) {
  return String(submission?.status || "")
    .trim()
    .toLowerCase();
}

function getStatusStyles(status) {
  if (status === "Published") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "Draft") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "Scheduled") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (status === "Unpublished") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function assignmentMatchesClass(assignment, cls) {
  if (!assignment || !cls) return false;

  const sameClassId =
    assignment.classId &&
    cls.id &&
    String(assignment.classId) === String(cls.id);

  const sameClassCode =
    assignment.classCode?.toUpperCase() === cls.code?.toUpperCase();

  return sameClassId || sameClassCode;
}

function getAssignmentSubmissions(assignment, submissions) {
  return submissions.filter(
    (submission) =>
      String(submission.assignmentId) === String(assignment.id)
  );
}

function getSubmittedText(submission = {}) {
  return String(
    submission.submittedText ||
      submission.submissionText ||
      ""
  ).trim();
}

function hasSubmissionEvidence(submission = {}) {
  const submittedTimestamp =
    submission.submittedAt ||
    submission.resubmittedAt ||
    null;

  return Boolean(
    submittedTimestamp &&
      getSubmittedText(submission)
  );
}

function getAssignmentSubmissionMetrics(
  assignment,
  submissions,
  totalStudents = 0
) {
  const assignmentSubmissions =
    getAssignmentSubmissions(
      assignment,
      submissions
    );

  const actualSubmissions =
    assignmentSubmissions.filter(
      hasSubmissionEvidence
    );

  const students = new Set();
  let pending = 0;
  let graded = 0;

  actualSubmissions.forEach((submission) => {
    students.add(
      String(
        submission.studentEmail ||
          submission.userEmail ||
          submission.id ||
          "student"
      ).trim().toLowerCase()
    );

    const status = normalizeSubmissionStatus(submission);
    if (
      submission.isCurrent !== false &&
      (status === "submitted" || status === "late")
    ) pending += 1;
    if (submission.isCurrent !== false && status === "graded") {
      graded += 1;
    }
  });

  const submittedStudents = students.size;
  const rosterTotal = Math.max(Number(totalStudents || 0), submittedStudents);

  return {
    students: rosterTotal,
    submitted: submittedStudents,
    missing: Math.max(0, rosterTotal - submittedStudents),
    graded,
    attempts: actualSubmissions.length,
    pending,
  };
}

function getPendingSubmissionCount(
  assignment,
  submissions
) {
  return getAssignmentSubmissionMetrics(
    assignment,
    submissions
  ).pending;
}

function getDueDateLabel(assignment = {}) {
  const raw = String(
    assignment.dueDate ||
      assignment.deadline ||
      assignment.endDate ||
      ""
  ).trim();

  if (!raw) return "No due date";

  const explicitTime = String(
    assignment.dueTime ||
      assignment.deadlineTime ||
      ""
  ).trim();

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/
  );

  if (!match) return raw;

  const [, year, month, day, embeddedHour, embeddedMinute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  const dateLabel = new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(date);

  const timeText =
    explicitTime ||
    (embeddedHour !== undefined
      ? `${embeddedHour}:${embeddedMinute}`
      : "");

  if (!timeText) return dateLabel;

  const [hour, minute = "00"] =
    timeText.split(":");

  const time = new Date(
    2000,
    0,
    1,
    Number(hour),
    Number(minute)
  );

  const timeLabel = new Intl.DateTimeFormat(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(time);

  return `${dateLabel} · ${timeLabel}`;
}

// --- Main Assignments Component ---

export default function TeacherAssignments({
  workspaceRequest = null,
  onNavigationStateChange,
}) {
  const {
    view,
    setView,
    assignments = [],
    classes = [],
    submissions = [],
    addAssignment,
    updateAssignment,
    deleteAssignment,
    toggleAssignmentStatus,
    selectedAssignment,
    setSelectedAssignment,
    setSubmissionFilterAssignment,
    isWorkspaceLoading,
  } = useTeacherWorkspace();

  const [selectedClassId, setSelectedClassId] = useState("");

  useEffect(() => {
    /*
     * Do not re-fetch while the teacher is actively editing
     * the builder. Refresh once the assignment list becomes
     * active again.
     */
    if (
      view === "create" ||
      view === "edit"
    ) {
      return undefined;
    }

    let cancelled = false;

    async function refreshBuilderLifecycle() {
      try {
        const draft =
          await getAssignmentBuilderDraft();

        if (cancelled) {
          return;
        }

        setBuilderDraftAssignmentId(
          String(
            draft?.draftAssignmentId ||
              ""
          )
        );
      } catch (error) {
        console.warn(
          "Could not determine assignment builder state:",
          error
        );

        if (!cancelled) {
          setBuilderDraftAssignmentId(
            ""
          );
        }
      }
    }

    refreshBuilderLifecycle();

    return () => {
      cancelled = true;
    };
  }, [
    view,
    assignments.length,
  ]);

  const [pendingCreateCourseId, setPendingCreateCourseId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("All");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState("All");
  const [assignmentGradingFilter, setAssignmentGradingFilter] = useState("All");

  const [
    builderDraftAssignmentId,
    setBuilderDraftAssignmentId,
  ] = useState("");
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [statusChangeAssignmentId, setStatusChangeAssignmentId] = useState("");
  const [statusChangeMessage, setStatusChangeMessage] = useState("");
  const [assignmentPendingDelete, setAssignmentPendingDelete] = useState(null);
  const [isDeletingAssignment, setIsDeletingAssignment] = useState(false);
  const appliedWorkspaceRequestRef = useRef(0);
  const reviewReturnClassIdRef = useRef("");

  function closeStudentProgress() {
    setSelectedAssignmentId("");
    setSubmissionStatusFilter("All");
    setSelectedAssignment(null);
    setSubmissionFilterAssignment(null);
    setSelectedClassId(reviewReturnClassIdRef.current);
  }

  async function confirmAssignmentDelete() {
    if (!assignmentPendingDelete?.id || isDeletingAssignment) return;

    setIsDeletingAssignment(true);
    try {
      await deleteAssignment(assignmentPendingDelete.id);
      setAssignmentPendingDelete(null);
    } finally {
      setIsDeletingAssignment(false);
    }
  }

  async function handleToggleAssignmentStatus(assignment) {
    if (!assignment?.id || statusChangeAssignmentId) return;
    setStatusChangeAssignmentId(String(assignment.id));
    setStatusChangeMessage("");
    try {
      const updated = await toggleAssignmentStatus(assignment.id);
      setStatusChangeMessage(
        normalizeAssignmentStatus(updated) === "Published"
          ? "Assignment published."
          : "Assignment moved back to unpublished."
      );
    } catch (error) {
      setStatusChangeMessage(
        error?.message || "Assignment status could not be changed. Please try again."
      );
    } finally {
      setStatusChangeAssignmentId("");
    }
  }

  const activeClasses = useMemo(
    () => classes.filter((course) => course?.archived !== true),
    [classes]
  );

  const activeClassIds = useMemo(
    () => new Set(activeClasses.map((course) => String(course.id))),
    [activeClasses]
  );

  const activeClassCodes = useMemo(
    () =>
      new Set(
        activeClasses
          .map((course) => String(course?.code || "").toUpperCase())
          .filter(Boolean)
      ),
    [activeClasses]
  );

  const activeAssignments = useMemo(
    () =>
      assignments.filter((assignment) => {
        const matchesId =
          assignment?.classId !== null &&
          assignment?.classId !== undefined &&
          activeClassIds.has(String(assignment.classId));

        const code = String(assignment?.classCode || "").toUpperCase();
        const matchesCode = Boolean(code && activeClassCodes.has(code));

        return matchesId || matchesCode;
      }),
    [assignments, activeClassIds, activeClassCodes]
  );

  // Resolve selected class
  const selectedClass = useMemo(() => {
    if (!selectedClassId) return null;
    return (
      activeClasses.find((cls) => String(cls.id) === String(selectedClassId)) || null
    );
  }, [activeClasses, selectedClassId]);

  useEffect(() => {
    if (activeClasses.length === 1 && !selectedClassId) {
      setSelectedClassId(String(activeClasses[0].id));
      return;
    }

    if (
      selectedClassId &&
      !activeClasses.some(
        (course) => String(course.id) === String(selectedClassId)
      )
    ) {
      setSelectedClassId("");
      setSelectedAssignmentId("");
      setSubmissionStatusFilter("All");
    }
  }, [activeClasses, selectedClassId]);

  // Filter assignments based on the selected class
  const courseAssignments = useMemo(() => {
    if (!selectedClass) return [];
    return assignments.filter((assignment) =>
      assignmentMatchesClass(assignment, selectedClass)
    );
  }, [assignments, selectedClass]);

  // Resolve the active assignment selected
  const activeAssignment = useMemo(() => {
    return (
      courseAssignments.find(
        (assignment) => String(assignment.id) === String(selectedAssignmentId)
      ) || null
    );
  }, [courseAssignments, selectedAssignmentId]);

  // Keep the shared assignment/submission context aligned with the explicit selection.
  useEffect(() => {
    setSelectedAssignment(activeAssignment);
    setSubmissionFilterAssignment(activeAssignment);
  }, [
    activeAssignment,
    setSelectedAssignment,
    setSubmissionFilterAssignment,
  ]);

  useEffect(() => {
    if (typeof onNavigationStateChange !== "function") return;
    if (
      workspaceRequest?.requestId &&
      appliedWorkspaceRequestRef.current !== workspaceRequest.requestId
    ) {
      return;
    }

    onNavigationStateChange({
      courseId: selectedClassId || null,
      assignmentId: selectedAssignmentId || null,
      statusFilter: submissionStatusFilter,
    });
  }, [
    onNavigationStateChange,
    selectedAssignmentId,
    selectedClassId,
    submissionStatusFilter,
    workspaceRequest?.requestId,
  ]);

  // Never auto-select the first assignment. Clear only stale selections.
  useEffect(() => {
    if (!selectedAssignmentId) return;

    const isValid = courseAssignments.some(
      (assignment) =>
        String(assignment.id) === String(selectedAssignmentId)
    );

    if (!isValid) {
      setSelectedAssignmentId("");
      setSubmissionStatusFilter("All");
    }
  }, [courseAssignments, selectedAssignmentId]);

  // Handle navigation requests coming from Home or the sidebar.
  useEffect(() => {
    if (!workspaceRequest?.requestId) return;
    appliedWorkspaceRequestRef.current = workspaceRequest.requestId;

    const mode = workspaceRequest.mode || "browse";

    if (mode === "create") {
      setPendingCreateCourseId("");

      const requestedClass = activeClasses.find(
        (cls) => String(cls.id) === String(workspaceRequest.courseId)
      );
      setSelectedClassId(
        requestedClass
          ? String(requestedClass.id)
          : activeClasses.length === 1
            ? String(activeClasses[0].id)
            : ""
      );
      setSelectedAssignmentId("");
      setSubmissionStatusFilter("All");
      setSelectedAssignment(null);
      setSubmissionFilterAssignment(null);
      setView("create");
      return;
    }

    if (mode === "review") {
      const requestedAssignment =
        assignments.find(
          (assignment) =>
            String(assignment.id) ===
            String(workspaceRequest.assignmentId)
        ) || null;

      if (!requestedAssignment) {
        setSelectedClassId("");
        setSelectedAssignmentId("");
        setSubmissionStatusFilter("All");
        setView("list");
        return;
      }

      const requestedClass =
        activeClasses.find(
          (cls) =>
            String(cls.id) === String(workspaceRequest.courseId) ||
            assignmentMatchesClass(requestedAssignment, cls)
        ) || null;

      if (!requestedClass) {
        setSelectedClassId("");
        setSelectedAssignmentId("");
        setSubmissionStatusFilter("All");
        setSelectedAssignment(null);
        setSubmissionFilterAssignment(null);
        setView("list");
        return;
      }

      setSelectedClassId(String(requestedClass.id));
      setSelectedAssignmentId(String(requestedAssignment.id));
      setSubmissionStatusFilter(
        workspaceRequest.statusFilter || "Pending"
      );
      setSelectedAssignment(requestedAssignment);
      setSubmissionFilterAssignment(requestedAssignment);
      setView("list");
      return;
    }

    setSelectedClassId("");
    setSelectedAssignmentId("");
    setSubmissionStatusFilter("All");
    setSelectedAssignment(null);
    setSubmissionFilterAssignment(null);
    setView("list");
  }, [workspaceRequest?.requestId]);

  // Pending-review shortcut follows the same course scope as the list.
  //
  // All courses:
  //   -> count/search across every active assignment.
  //
  // Specific course:
  //   -> count/search only inside that course.
  const pendingScopeAssignments =
    selectedClass ? courseAssignments : activeAssignments;

  const totalPendingSubmissions = useMemo(() => {
    return pendingScopeAssignments.reduce(
      (sum, assignment) =>
        sum + getPendingSubmissionCount(assignment, submissions),
      0
    );
  }, [pendingScopeAssignments, submissions]);

  // Select the first assignment containing a pending review
  // inside the current course scope.
  const firstPendingAssignment = useMemo(() => {
    return (
      pendingScopeAssignments.find(
        (assignment) =>
          getPendingSubmissionCount(assignment, submissions) > 0
      ) || null
    );
  }, [pendingScopeAssignments, submissions]);

  // Action: Review Pending Shortcut
  function handleReviewPending() {
    if (!firstPendingAssignment) return;

    const relatedClass = activeClasses.find((cls) =>
      assignmentMatchesClass(firstPendingAssignment, cls)
    );

    if (!relatedClass) return;

    reviewReturnClassIdRef.current = selectedClassId;
    setSelectedClassId(String(relatedClass.id));
    setSelectedAssignmentId(String(firstPendingAssignment.id));
    setSubmissionStatusFilter("Pending");
    setSelectedAssignment(firstPendingAssignment);
    setSubmissionFilterAssignment(firstPendingAssignment);
    setView("list");
  }

  function handleCreateAssignmentFromList() {
    if (activeClasses.length === 0) return;

    setPendingCreateCourseId("");

    setSelectedClassId(
      activeClasses.length === 1
        ? String(activeClasses[0].id)
        : ""
    );

    setSelectedAssignmentId("");
    setSubmissionStatusFilter("All");
    setSelectedAssignment(null);
    setSubmissionFilterAssignment(null);

    setView("create");
  }

  if (isWorkspaceLoading) {
    return <WorkspaceLoading />;
  }

  const isNewUnappliedCreateRequest =
    workspaceRequest?.requestId &&
    appliedWorkspaceRequestRef.current !== workspaceRequest.requestId;

  const explicitCreateCourseId =
    workspaceRequest?.mode === "create"
      ? workspaceRequest?.courseId
      : null;

  const needsCourseSelectionForCreate =
    view === "create" &&
    activeClasses.length > 1 &&
    !explicitCreateCourseId &&
    (isNewUnappliedCreateRequest || !selectedClassId);

  if (needsCourseSelectionForCreate) {
    const pendingCourse =
      activeClasses.find(
        (courseItem) =>
          String(courseItem.id) ===
          String(pendingCreateCourseId)
      ) || null;

    function cancelCourseSelection() {
      setPendingCreateCourseId("");
      setSelectedClassId("");
      setSelectedAssignmentId("");
      setSubmissionStatusFilter("All");
      setSelectedAssignment(null);
      setSubmissionFilterAssignment(null);
      setView("list");
    }

    function continueWithSelectedCourse() {
      if (!pendingCourse) return;

      setSelectedClassId(String(pendingCourse.id));
      setSelectedAssignmentId("");
      setSubmissionStatusFilter("All");
      setSelectedAssignment(null);
      setSubmissionFilterAssignment(null);
    }

    return createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-stretch justify-center overflow-hidden bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-3 xl:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-picker-title"
      >
        <div className="flex h-[100dvh] w-full flex-col overflow-hidden border-0 bg-white shadow-2xl sm:h-auto sm:max-h-[88dvh] sm:max-w-3xl sm:rounded-[1.75rem] sm:border sm:border-slate-200">

          <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:static sm:gap-5 sm:border-b-0 sm:px-8 sm:py-5">
            <div>
              <h2
                id="course-picker-title"
                className="font-serif text-[18px] font-black leading-tight text-slate-950 sm:text-xl"
              >
                Create Assignment
              </h2>

              <p className="mt-0.5 max-w-[290px] text-[11px] leading-4 text-slate-500 sm:mt-1 sm:max-w-none sm:text-sm sm:leading-relaxed">
                <span className="sm:hidden">
                  Choose a course to continue.
                </span>
                <span className="hidden sm:inline">
                  Choose the course first, then choose how you would
                  like to create the assignment.
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={cancelCourseSelection}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              ×
            </button>
          </div>

          <div className="px-3 py-3 sm:border-t sm:border-slate-200 sm:px-8 sm:py-6">
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-[10px] sm:tracking-[0.16em]">
              Course
            </p>

            <h3 className="mt-0.5 font-serif text-[17px] font-black leading-tight text-slate-950 sm:mt-1 sm:text-2xl">
              Which course is this assignment for?
            </h3>

            <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:mt-2 sm:text-sm">
              Select one course to continue.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-8 sm:pb-7">
            <label className="block">
              <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:mb-2 sm:text-[10px]">
                Select course
              </span>

              <div className="relative">
                <select
                  value={pendingCreateCourseId}
                  onChange={(event) =>
                    setPendingCreateCourseId(event.target.value)
                  }
                  className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-10 text-[16px] font-semibold text-slate-900 outline-none transition-all hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 sm:h-auto sm:rounded-xl sm:px-4 sm:py-3.5 sm:pr-11 sm:text-sm sm:focus:ring-4"
                >
                  <option value="">
                    Choose a course
                  </option>

                  {activeClasses.map((courseItem) => (
                    <option
                      key={courseItem.id}
                      value={String(courseItem.id)}
                    >
                      {[
                        courseItem.code,
                        courseItem.name,
                        courseItem.semester,
                      ]
                        .filter(Boolean)
                        .join(" — ")}
                    </option>
                  ))}
                </select>

                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 sm:pr-4">
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
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </div>

              {pendingCourse && (
                <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 sm:mt-3 sm:rounded-xl sm:px-4 sm:py-3">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-blue-600 sm:text-[10px]">
                    Selected course
                  </p>

                  <p className="mt-0.5 truncate text-[12px] font-bold text-slate-950 sm:mt-1 sm:text-sm">
                    {pendingCourse.name || "Unnamed course"}
                  </p>

                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-[9px] text-slate-500 sm:mt-1 sm:gap-2 sm:text-[11px]">
                    {pendingCourse.code && (
                      <span>{pendingCourse.code}</span>
                    )}

                    {pendingCourse.semester && (
                      <span>· {pendingCourse.semester}</span>
                    )}
                  </div>
                </div>
              )}
            </label>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-8 sm:py-4">
            <button
              type="button"
              onClick={cancelCourseSelection}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50 sm:h-auto sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!pendingCourse}
              onClick={continueWithSelectedCourse}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[10px] font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:h-auto sm:gap-2 sm:rounded-xl sm:px-5 sm:py-2.5 sm:text-xs"
            >
              Continue
              <span aria-hidden="true">→</span>
            </button>
          </div>

        </div>
      </div>,
      document.body
    );
  }

  if (view === "create") {
    return (
      <Suspense fallback={<WorkspaceLoading />}>
        <CreateAssignmentModal
          classes={classes}
          assignments={assignments}
          defaultClassId={
            selectedClassId ||
            workspaceRequest?.courseId ||
            (activeClasses.length === 1 ? activeClasses[0].id : "")
          }
          onCreate={async (assignmentData) => {
            const createdAssignment = await addAssignment(assignmentData);

            if (createdAssignment) {
              const relatedClass = classes.find((cls) =>
                assignmentMatchesClass(createdAssignment, cls)
              );

              setSelectedClassId(
                relatedClass ? String(relatedClass.id) : ""
              );
              setSelectedAssignmentId("");
              setSubmissionStatusFilter("All");
            }

            return createdAssignment;
          }}
          onUpdate={updateAssignment}
          onClose={() => setView("list")}
        />
      </Suspense>
    );
  }

  if (view === "edit") {
    return (
      <Suspense fallback={<WorkspaceLoading />}>
        <CreateAssignmentModal
          classes={classes}
          assignments={assignments}
          editingAssignment={selectedAssignment}
          onCreate={addAssignment}
          onUpdate={async (updatedAssignment) => {
            const savedAssignment = await updateAssignment(updatedAssignment);
            const assignmentToSelect = savedAssignment || updatedAssignment;
            const relatedClass = classes.find((cls) =>
              assignmentMatchesClass(assignmentToSelect, cls)
            );

            setSelectedAssignment(assignmentToSelect);
            setSelectedClassId(
              relatedClass ? String(relatedClass.id) : ""
            );
            setSelectedAssignmentId("");
            setSubmissionStatusFilter("All");
            return savedAssignment;
          }}
          onClose={() => {
            setSelectedAssignment(null);
            setView("list");
          }}
        />
      </Suspense>
    );
  }

  const isFirstAssignmentState =
    activeClasses.length === 1 && activeAssignments.length === 0;

  if (isFirstAssignmentState) {
    const firstCourse = activeClasses[0];

    return (
      <div className="flex min-h-[65vh] items-center justify-center px-4">
        <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-blue-200 bg-white text-center shadow-2xl shadow-blue-950/10">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-8 py-10 text-white sm:px-12 sm:py-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner">
              <BookOpen className="h-7 w-7" />
            </div>
            <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">
              Course ready · Next step
            </p>
            <h2 className="mt-2 font-serif text-3xl font-black sm:text-4xl">
              Create your first assignment
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-300">
              Add the first piece of work for{" "}
              <strong className="font-bold text-white">{firstCourse.name}</strong>.
              The course is already selected for you.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 px-8 py-7 sm:flex-row sm:justify-between sm:px-10">
            <div className="text-center sm:text-left">
              <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Selected course
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {firstCourse.code ? `${firstCourse.code} · ` : ""}
                {firstCourse.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedClassId(String(firstCourse.id));
                setSelectedAssignmentId("");
                setSelectedAssignment(null);
                setSubmissionFilterAssignment(null);
                setView("create");
              }}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              Create First Assignment
            </button>
          </div>
        </section>
      </div>
    );
  }

  const detailsAssignment = selectedAssignment || activeAssignment;
  const activeReviewClass = activeAssignment
    ? activeClasses.find((course) =>
        assignmentMatchesClass(activeAssignment, course)
      ) || null
    : null;
  const listAssignments = selectedClass ? courseAssignments : activeAssignments;
  const filteredAssignments = listAssignments.filter((assignment) => {
    const query = assignmentSearch.trim().toLowerCase();
    if (
      query &&
      !String(assignment.title || "").toLowerCase().includes(query)
    ) {
      return false;
    }

    const status =
      getAssignmentLifecycleStatus(
        assignment,
        builderDraftAssignmentId
      );
    if (assignmentStatusFilter !== "All" && status !== assignmentStatusFilter) {
      return false;
    }

    const relatedClass = activeClasses.find((course) =>
      assignmentMatchesClass(assignment, course)
    );
    const courseStudentCount = Math.max(
      Array.isArray(relatedClass?.members) ? relatedClass.members.length : 0,
      Array.isArray(relatedClass?.enrollments)
        ? relatedClass.enrollments.length
        : 0
    );
    const metrics = getAssignmentSubmissionMetrics(
      assignment,
      submissions,
      courseStudentCount
    );

    if (
      status === "Draft"
    ) {
      return (
        assignmentGradingFilter ===
        "All"
      );
    }

    if (assignmentGradingFilter === "Needs review") return metrics.pending > 0;
    if (assignmentGradingFilter === "Completed") {
      return metrics.submitted > 0 && metrics.pending === 0;
    }
    if (assignmentGradingFilter === "No submissions") {
      return metrics.submitted === 0;
    }
    return true;
  });
  const assignmentPageCount = Math.max(
    1,
    Math.ceil(filteredAssignments.length / ASSIGNMENTS_PER_PAGE)
  );
  const visibleAssignmentPage = Math.min(assignmentPage, assignmentPageCount);
  const assignmentPageStart =
    (visibleAssignmentPage - 1) * ASSIGNMENTS_PER_PAGE;
  const paginatedAssignments = filteredAssignments.slice(
    assignmentPageStart,
    assignmentPageStart + ASSIGNMENTS_PER_PAGE
  );
  const paginationItems = getPaginationItems(
    visibleAssignmentPage,
    assignmentPageCount
  );

  return (
    <>
      <div className="space-y-3 sm:space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-4">
          <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 hidden items-center gap-1 rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-blue-700 sm:inline-flex sm:gap-1.5 sm:px-2 sm:text-[9px]">
                <Layers className="h-3 w-3" />
                Assignments
              </div>
              <h2 className="text-[17px] font-bold leading-tight text-slate-950 sm:text-xl">
                Your assignments
              </h2>
              <p className="mt-0.5 hidden max-w-2xl text-[11px] leading-5 text-slate-500 sm:block sm:text-xs sm:leading-relaxed">
                Select any assignment row to view student progress and review submissions.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <button
                type="button"
                disabled={!firstPendingAssignment}
                onClick={handleReviewPending}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-[10px] font-bold transition-all sm:h-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs ${
                  firstPendingAssignment
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
                {totalPendingSubmissions > 0 ? (
                  <>
                    <span className="sm:hidden">Review ({totalPendingSubmissions})</span>
                    <span className="hidden sm:inline">Review Pending ({totalPendingSubmissions})</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">No reviews</span>
                    <span className="hidden sm:inline">No Pending Reviews</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={activeClasses.length === 0}
                onClick={handleCreateAssignmentFromList}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 text-[10px] font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none sm:h-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs"
                title={
                  activeClasses.length === 0
                    ? "Create or restore an active course first"
                    : "Create an assignment"
                }
              >
                <Plus className="h-4 w-4" />
                <span className="sm:hidden">New assignment</span>
                <span className="hidden sm:inline">Create Assignment</span>
              </button>
            </div>
          </div>

          <div className={`mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2 sm:mt-3 sm:gap-2 sm:pt-3 ${
            activeClasses.length > 1
              ? "md:grid-cols-2 xl:grid-cols-[280px_minmax(240px,1fr)_160px_180px]"
              : "md:grid-cols-[minmax(240px,1fr)_160px_180px]"
          }`}>
            {activeClasses.length > 1 && (
              <label className="order-2 col-span-2 xl:order-none xl:col-span-1">
                <span className="sr-only">Course</span>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setAssignmentPage(1);
                  setSelectedAssignmentId("");
                  setSubmissionStatusFilter("All");
                  setSelectedAssignment(null);
                  setSubmissionFilterAssignment(null);
                }}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[16px] font-semibold text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 sm:h-10 sm:rounded-xl sm:px-3.5 sm:text-xs"
              >
                <option value="">All courses</option>
                {activeClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.code ? `${cls.code}  -  ${cls.name}` : cls.name}
                  </option>
                ))}
              </select>
              </label>
            )}
            <label className="relative order-1 col-span-2 xl:order-none xl:col-span-1">
              <span className="sr-only">Search assignments</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 sm:left-3.5 sm:h-4 sm:w-4" />
              <input
                type="search"
                value={assignmentSearch}
                onChange={(event) => {
                  setAssignmentSearch(event.target.value);
                  setAssignmentPage(1);
                }}
                placeholder="Search assignments..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-[16px] text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 sm:h-10 sm:rounded-xl sm:py-2.5 sm:pl-10 sm:pr-4 sm:text-xs"
              />
            </label>

            <select
              value={assignmentStatusFilter}
              onChange={(event) => {
                setAssignmentStatusFilter(event.target.value);
                setAssignmentPage(1);
              }}
              aria-label="Filter by assignment status"
              className="order-3 h-9 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[14px] font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 sm:h-10 sm:rounded-xl sm:px-3.5 sm:text-xs xl:order-none"
            >
              <option value="All">All statuses</option>
              <option value="Draft">Draft</option>
              <option value="Unpublished">Unpublished</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Published">Published</option>
            </select>

            <select
              value={assignmentGradingFilter}
              onChange={(event) => {
                setAssignmentGradingFilter(event.target.value);
                setAssignmentPage(1);
              }}
              aria-label="Filter by grading progress"
              className="order-4 h-9 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[14px] font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 sm:h-10 sm:rounded-xl sm:px-3.5 sm:text-xs xl:order-none"
            >
              <option value="All">All grading states</option>
              <option value="Needs review">Needs review</option>
              <option value="Completed">Grading completed</option>
              <option value="No submissions">No submissions</option>
            </select>
          </div>

          {activeClasses.length === 1 && selectedClass && (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
              <BookOpen className="h-3.5 w-3.5 text-blue-500" />
              Showing {selectedClass.name}
            </p>
          )}
        </section>

        {statusChangeMessage && (
          <p
            role="status"
            className={`rounded-xl border bg-white px-4 py-3 text-xs font-semibold ${
              /could not|complete all|required|refresh/i.test(statusChangeMessage)
                ? "border-red-200 text-red-700"
                : "border-emerald-200 text-emerald-700"
            }`}
          >
            {statusChangeMessage}
          </p>
        )}

        <section>
            {activeClasses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                <AlertCircle className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-3 text-lg font-bold text-slate-900">
                  No active courses
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Create or restore a course before adding assignments.
                </p>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-12 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-blue-300" />
                <h3 className="mt-3 text-lg font-bold text-slate-900">
                  No matching assignments
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Try changing the filters or create a new assignment.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-2">
                {paginatedAssignments.map((assignment) => {
                  const assignmentStatus =
                    getAssignmentLifecycleStatus(
                      assignment,
                      builderDraftAssignmentId
                    );

                  const isInProgress =
                    assignmentStatus ===
                    "Draft";

                  const isDraft =
                    assignmentStatus ===
                    "Unpublished";

                  const lockDraftActions =
                    isInProgress ||
                    (isDraft &&
                      !isAssignmentComplete(
                        assignment
                      ));
                  const relatedClass = activeClasses.find((course) =>
                    assignmentMatchesClass(assignment, course)
                  );
                  const courseStudentCount = Math.max(
                    Array.isArray(relatedClass?.members)
                      ? relatedClass.members.length
                      : 0,
                    Array.isArray(relatedClass?.enrollments)
                      ? relatedClass.enrollments.length
                      : 0
                  );
                  const metrics = getAssignmentSubmissionMetrics(
                    assignment,
                    submissions,
                    courseStudentCount
                  );

                  const openReview = () => {
                    if (isInProgress) {
                      return;
                    }

                    reviewReturnClassIdRef.current =
                      selectedClassId;

                    if (relatedClass) {
                      setSelectedClassId(
                        String(
                          relatedClass.id
                        )
                      );
                    }

                    setSelectedAssignmentId(
                      String(
                        assignment.id
                      )
                    );

                    setSubmissionStatusFilter(
                      "All"
                    );

                    setSelectedAssignment(
                      assignment
                    );

                    setSubmissionFilterAssignment(
                      assignment
                    );
                  };

                  return (
                    <article
                      key={assignment.id}
                      role="button"
                      tabIndex={0}
                      onClick={openReview}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openReview();
                        }
                      }}
                      className="group flex cursor-pointer flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/20 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10 sm:gap-3 sm:p-3 xl:flex-row xl:items-center"
                      aria-label={
                        isInProgress
                          ? `${assignment.title || "Assignment"} is a draft. Use Edit to continue setup.`
                          : `Open ${assignment.title || "assignment"} student progress`
                      }
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2 xl:w-[32%]">
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-row flex-wrap items-center gap-1.5 sm:gap-2">
                            <h3 className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-900 sm:text-sm">
                              {assignment.title || "Untitled Assignment"}
                            </h3>
                            <span
                              className={`rounded px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${getStatusStyles(
                                assignmentStatus
                              )}`}
                            >
                              {assignmentStatus}
                            </span>
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 sm:text-[11px]">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            Due {getDueDateLabel(assignment)}
                          </p>
                          {activeClasses.length > 1 && relatedClass && (
                            <p className="mt-1 truncate text-[10px] font-semibold text-blue-600">
                              {relatedClass.name}
                            </p>
                          )}
                        </div>
                        <div
                          className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex ${
                            isInProgress
                              ? "bg-slate-50 text-slate-300"
                              : "bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white"
                          }`}
                          title={
                            isInProgress
                              ? "Details unavailable until setup is complete"
                              : "View student progress"
                          }
                          aria-hidden="true"
                        >
                          <Eye className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="flex flex-1 items-center divide-x divide-slate-200 rounded-lg border border-slate-100 bg-slate-50/80 px-1 py-1.5 sm:hidden">
                        <div className="flex flex-1 items-baseline justify-center gap-1 px-1">
                          <span className="text-[12px] font-black text-slate-800">{metrics.students}</span>
                          <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Students</span>
                        </div>

                        <div className="flex flex-1 items-baseline justify-center gap-1 px-1">
                          <span className="text-[12px] font-black text-blue-700">{metrics.submitted}</span>
                          <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Sent</span>
                        </div>

                        <div className="flex flex-1 items-baseline justify-center gap-1 px-1">
                          <span className="text-[12px] font-black text-emerald-700">{metrics.graded}</span>
                          <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Graded</span>
                        </div>
                      </div>

                      <div className="hidden flex-1 grid-cols-3 gap-2 sm:grid">
                        <AssignmentCount label="Students" value={metrics.students} tone="slate" />
                        <AssignmentCount label="Submitted" value={metrics.submitted} tone="blue" />
                        <AssignmentCount label="Graded" value={metrics.graded} tone="emerald" />
                      </div>

                      <div className="border-t border-slate-100 pt-1.5 sm:pt-2 xl:w-[410px] xl:border-l xl:border-t-0 xl:pl-3 xl:pt-0">
                          <div className="grid grid-cols-3 gap-1 xl:flex xl:flex-wrap xl:gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleAssignmentStatus(assignment);
                            }}
                            disabled={
                              lockDraftActions ||
                              statusChangeAssignmentId === String(assignment.id)
                            }
                            className="h-8 rounded-md border border-blue-600 bg-blue-600 px-1.5 text-[9px] font-bold text-white shadow-sm transition-colors hover:border-blue-700 hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 sm:h-auto sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[10px]"
                          >
                            {assignmentStatus === "Published" ? "Unpublish" : "Publish"}
                          </button>
                          <button
                            type="button"
                            disabled={
                              isInProgress ||
                              metrics.submitted === 0
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              if (
                                isInProgress ||
                                metrics.submitted === 0
                              ) return;
                              openReview();
                            }}
                            className="col-span-2 h-8 rounded-md border border-blue-200 bg-blue-50 px-1.5 text-[9px] font-bold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 sm:h-auto sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[10px] xl:col-span-1"
                          >
                            {metrics.submitted > 0 ? (
                              <>
                                <span className="sm:hidden">Review</span>
                                <span className="hidden sm:inline">Review Submissions</span>
                              </>
                            ) : (
                              "No submissions"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedAssignment(assignment);
                              setView("details");
                            }}
                            disabled={lockDraftActions}
                            className="h-8 rounded-md border border-slate-200 bg-white px-1.5 text-[9px] font-bold text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:h-auto sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[10px]"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedAssignment(assignment);
                              setView("edit");
                            }}
                            className="h-8 rounded-md border border-slate-200 bg-white px-1.5 text-[9px] font-bold text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 sm:h-auto sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[10px]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setAssignmentPendingDelete(assignment);
                            }}
                            className="h-8 rounded-md border border-red-200 bg-red-50 px-1.5 text-[9px] font-bold text-red-600 transition-colors hover:bg-red-100 sm:h-auto sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[10px]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {assignmentPageCount > 1 && (
                  <nav
                    aria-label="Assignment pages"
                    className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="text-xs font-medium text-slate-500">
                      Showing{" "}
                      <span className="font-bold text-slate-700">
                        {assignmentPageStart + 1}–
                        {Math.min(
                          assignmentPageStart + ASSIGNMENTS_PER_PAGE,
                          filteredAssignments.length
                        )}
                      </span>{" "}
                      of{" "}
                      <span className="font-bold text-slate-700">
                        {filteredAssignments.length}
                      </span>{" "}
                      assignments
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={visibleAssignmentPage === 1}
                        onClick={() =>
                          setAssignmentPage((page) => Math.max(1, page - 1))
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
                      >
                        Previous
                      </button>

                      {paginationItems.map((item) =>
                        typeof item === "number" ? (
                          <button
                            key={item}
                            type="button"
                            aria-label={`Go to assignment page ${item}`}
                            aria-current={
                              item === visibleAssignmentPage ? "page" : undefined
                            }
                            onClick={() => setAssignmentPage(item)}
                            className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition-colors ${
                              item === visibleAssignmentPage
                                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                                : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            }`}
                          >
                            {item}
                          </button>
                        ) : (
                          <span
                            key={item}
                            aria-hidden="true"
                            className="px-1 text-xs font-bold text-slate-400"
                          >
                            …
                          </span>
                        )
                      )}

                      <button
                        type="button"
                        disabled={visibleAssignmentPage === assignmentPageCount}
                        onClick={() =>
                          setAssignmentPage((page) =>
                            Math.min(assignmentPageCount, page + 1)
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
                      >
                        Next
                      </button>
                    </div>
                  </nav>
                )}
              </div>
            )}
        </section>
      </div>

      {assignmentPendingDelete &&
        createPortal(
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-2 sm:p-3 xl:p-4">
            <button
              type="button"
              aria-label="Cancel assignment deletion"
              onClick={() => {
                if (!isDeletingAssignment) setAssignmentPendingDelete(null);
              }}
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            />

            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-assignment-title"
              className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                    Delete assignment
                  </p>
                  <h2 id="delete-assignment-title" className="mt-1 text-lg font-bold text-slate-950">
                    Delete this assignment?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    <span className="font-bold text-slate-800">
                      {assignmentPendingDelete.title || "Untitled assignment"}
                    </span>{" "}
                    will be permanently removed. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAssignmentPendingDelete(null)}
                  disabled={isDeletingAssignment}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Keep assignment
                </button>
                <button
                  type="button"
                  onClick={confirmAssignmentDelete}
                  disabled={isDeletingAssignment}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-wait disabled:opacity-70"
                >
                  {isDeletingAssignment ? "Deleting…" : "Delete assignment"}
                </button>
              </div>
            </section>
          </div>,
          document.body
        )}

      {activeAssignment &&
        createPortal(
          <div className="fixed inset-0 z-[2147483646] flex items-center justify-center overflow-y-auto p-2 sm:p-3 xl:p-4 2xl:p-5">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            />

            <div className="relative z-10 my-2 flex max-h-[94dvh] w-full max-w-[1500px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-[#F8FAFC] shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-blue-600">
                    Student progress
                  </p>
                  <h2 className="truncate text-lg font-bold text-slate-900">
                    {activeAssignment.title || "Assignment"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeStudentProgress}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to list
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <Suspense fallback={<WorkspaceLoading />}>
                    <TeacherSubmissions
                      activeCourse={activeReviewClass}
                      activeAssignment={activeAssignment}
                      requestedStatusFilter={submissionStatusFilter}
                      requestedSubmissionId={
                        workspaceRequest?.submissionId || null
                      }
                    />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Details View Portal Overlay */}
      {view === "details" &&
        detailsAssignment &&
        createPortal(
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center overflow-y-auto p-2 sm:p-3 xl:p-4 2xl:p-5">
            <div
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
              onClick={() => {
                setSelectedAssignment(null);
                setView("list");
              }}
            />
            <div className="relative z-10 my-2 max-h-[92dvh] w-full max-w-[1450px] overflow-y-auto rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4 shadow-2xl sm:p-6">
              <Suspense fallback={<WorkspaceLoading />}>
                <TeacherAssignmentDetails
                  key={detailsAssignment.id}
                  modalMode
                  assignment={detailsAssignment}
                  onClose={() => {
                    setSelectedAssignment(null);
                    setView("list");
                  }}
                />
              </Suspense>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function AssignmentCount({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div
      className={`flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
        tones[tone] || tones.slate
      }`}
    >
      <p className="text-xs font-black leading-none">{value}</p>
      <p className="text-[9px] font-bold leading-tight text-slate-500">
        {label}
      </p>
    </div>
  );
}

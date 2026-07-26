import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import CreateAssignmentModal from "../../components/teacher/CreateAssignmentModal";
import { useTeacherWorkspace } from "../../hooks/useTeacherWorkspace";
import TeacherAssignmentDetails from "./TeacherAssignmentDetails";
import TeacherSubmissions from "./submissions/TeacherSubmissions";

// --- Normalize Status and Submissions Helpers ---

function normalizeAssignmentStatus(assignment) {
  const value = String(
    assignment?.status ||
      assignment?.publicationStatus ||
      assignment?.state ||
      ""
  ).toLowerCase();

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
  submissions
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
  });

  return {
    students: students.size,
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

export default function TeacherAssignments({ workspaceRequest = null }) {
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
  } = useTeacherWorkspace();

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("All");

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

    const mode = workspaceRequest.mode || "browse";

    if (mode === "create") {
      setSelectedClassId("");
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

  // Get cumulative global pending counts
  const totalPendingSubmissions = useMemo(() => {
    return activeAssignments.reduce(
      (sum, assignment) =>
        sum + getPendingSubmissionCount(assignment, submissions),
      0
    );
  }, [activeAssignments, submissions]);

  // Select shortcut for the first assignment containing pending reviews
  const firstPendingAssignment = useMemo(() => {
    return (
      activeAssignments.find(
        (assignment) => getPendingSubmissionCount(assignment, submissions) > 0
      ) || null
    );
  }, [activeAssignments, submissions]);

  // Action: Review Pending Shortcut
  function handleReviewPending() {
    if (!firstPendingAssignment) return;

    const relatedClass = activeClasses.find((cls) =>
      assignmentMatchesClass(firstPendingAssignment, cls)
    );

    if (!relatedClass) return;

    setSelectedClassId(String(relatedClass.id));
    setSelectedAssignmentId(String(firstPendingAssignment.id));
    setSubmissionStatusFilter("Pending");
    setSelectedAssignment(firstPendingAssignment);
    setSubmissionFilterAssignment(firstPendingAssignment);
    setView("list");
  }

  if (view === "create") {
    return (
      <CreateAssignmentModal
        classes={classes}
        onCreate={async (assignmentData) => {
          const createdAssignment = await addAssignment(assignmentData);

          if (createdAssignment) {
            const relatedClass = classes.find((cls) =>
              assignmentMatchesClass(createdAssignment, cls)
            );

            setSelectedClassId(
              relatedClass ? String(relatedClass.id) : ""
            );
            setSelectedAssignmentId(String(createdAssignment.id));
            setSubmissionStatusFilter("All");
          }

          return createdAssignment;
        }}
        onUpdate={updateAssignment}
        onClose={() => setView("list")}
      />
    );
  }

  if (view === "edit") {
    return (
      <CreateAssignmentModal
        classes={classes}
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
          setSelectedAssignmentId(String(assignmentToSelect.id));
          setSubmissionStatusFilter("All");
        }}
        onClose={() => {
          setSelectedAssignment(null);
          setView("list");
        }}
      />
    );
  }

  const activeAssignmentStatus = activeAssignment
    ? normalizeAssignmentStatus(activeAssignment)
    : "Draft";
  const activeAssignmentDraft = activeAssignmentStatus !== "Published";
  const activeAssignmentComplete = activeAssignment
    ? isAssignmentComplete(activeAssignment)
    : false;
  const shouldLockDraftActions =
    Boolean(activeAssignment) &&
    activeAssignmentDraft &&
    !activeAssignmentComplete;
  const detailsAssignment = selectedAssignment || activeAssignment;

  return (
    <>
      <div className="space-y-6">
        {/* Header Dashboard & Dynamic Shortcut Actions */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-blue-700">
                <Layers className="h-3 w-3" />
                Assignments & Submissions
              </div>
              <h2 className="font-serif text-xl font-bold text-slate-950">
                Assignments Workspace
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                Select a course, then choose one assignment to manage it and review only its student submissions.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Shortcut: Review Pending */}
              <button
                type="button"
                disabled={!firstPendingAssignment}
                onClick={handleReviewPending}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                  firstPendingAssignment
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
                {totalPendingSubmissions > 0
                  ? `Review Pending (${totalPendingSubmissions})`
                  : "No Pending Reviews"}
              </button>

              {/* Shortcut: Create Assignment */}
              <button
                type="button"
                disabled={activeClasses.length === 0}
                onClick={() => setView("create")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                title={
                  activeClasses.length === 0
                    ? "Create or restore an active course first"
                    : "Create an assignment"
                }
              >
                <Plus className="h-4 w-4" />
                Create Assignment
              </button>
            </div>
          </div>

          {/* Sequential Selectors */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Step 1: Course Selection */}
            <label className="space-y-1.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                1. Select Course
              </span>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedAssignmentId("");
                  setSubmissionStatusFilter("All");
                  setSelectedAssignment(null);
                  setSubmissionFilterAssignment(null);
                }}
                className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-xs font-bold text-slate-800 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">{activeClasses.length === 0 ? "No active courses" : "Select a course"}</option>
                {activeClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.code ? `${cls.code}  -  ${cls.name}` : cls.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Step 2: Assignment Selection */}
            <label className="space-y-1.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                2. Select Assignment
              </span>
              <select
                value={selectedAssignmentId}
                onChange={(e) => {
                  setSelectedAssignmentId(e.target.value);
                  setSubmissionStatusFilter("All");
                }}
                disabled={!selectedClass || courseAssignments.length === 0}
                className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-xs font-bold text-slate-800 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {!selectedClass
                    ? "Select a course first"
                    : courseAssignments.length === 0
                    ? "No assignments available"
                    : "Select an assignment"}
                </option>

                {courseAssignments.map((assignment) => {
                  const pending = getPendingSubmissionCount(
                    assignment,
                    submissions
                  );

                  return (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.title || "Untitled Assignment"}
                      {pending > 0 ? ` (${pending} pending)` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </section>

        {/* Selected Workspace Block */}
        {activeAssignment ? (
          <section className="space-y-6">
            {/* Dynamic Metadata & Management Bar */}
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-lg font-bold text-slate-950">
                    {activeAssignment.title || "Untitled Assignment"}
                  </h3>
                  <span
                    className={`inline-flex rounded px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${getStatusStyles(
                      activeAssignmentStatus
                    )}`}
                  >
                    {activeAssignmentStatus}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Due: {getDueDateLabel(activeAssignment)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {(() => {
                      const metrics =
                        getAssignmentSubmissionMetrics(
                          activeAssignment,
                          submissions
                        );

                      return (
                        <span>
                          {metrics.students} student{metrics.students === 1 ? "" : "s"} · {metrics.attempts} attempt{metrics.attempts === 1 ? "" : "s"}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Assignment Operations */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssignment(activeAssignment);
                    setView("details");
                  }}
                  disabled={shouldLockDraftActions}
                  title={shouldLockDraftActions ? "Complete assignment setup first, then Details will unlock." : "Open assignment details"}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                    shouldLockDraftActions
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Details
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssignment(activeAssignment);
                    setView("edit");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => toggleAssignmentStatus(activeAssignment.id)}
                  disabled={shouldLockDraftActions}
                  title={shouldLockDraftActions ? "Complete assignment setup first, then Publish will unlock." : activeAssignmentStatus === "Published" ? "Unpublish assignment" : "Publish assignment"}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                    shouldLockDraftActions
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : activeAssignmentStatus === "Published"
                        ? "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-white hover:text-blue-700"
                        : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {activeAssignmentStatus === "Published" ? "Unpublish" : "Publish"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const confirmed = window.confirm(
                      "Are you sure you want to delete this assignment?"
                    );
                    if (confirmed) {
                      deleteAssignment(activeAssignment.id);
                      setSelectedAssignmentId("");
                      setSubmissionStatusFilter("All");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition-all hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>

            {/* Pass current active assignment to eliminate duplicate controls */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <TeacherSubmissions
                activeCourse={selectedClass}
                activeAssignment={activeAssignment}
                requestedStatusFilter={submissionStatusFilter}
              />
            </div>
          </section>
        ) : (
          /* Empty Selection State */
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 font-serif text-lg font-bold text-slate-900">
              {!selectedClass
                ? "Select a Course"
                : "Select an Assignment"}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {!selectedClass
                ? "Choose a course first. No student submissions are displayed automatically."
                : "Choose one assignment to display only its student submissions."}
            </p>
          </div>
        )}
      </div>

      {/* Details View Portal Overlay */}
      {view === "details" &&
        detailsAssignment &&
        createPortal(
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center overflow-y-auto p-3 sm:p-5">
            <div
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
              onClick={() => {
                setSelectedAssignment(null);
                setView("list");
              }}
            />
            <div className="relative z-10 my-4 max-h-[92vh] w-full max-w-[1450px] overflow-y-auto rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4 shadow-2xl sm:p-6">
              <TeacherAssignmentDetails
                modalMode
                assignment={detailsAssignment}
                onClose={() => {
                  setSelectedAssignment(null);
                  setView("list");
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

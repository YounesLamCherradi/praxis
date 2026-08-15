import { useMemo, useState } from "react";
import { useStudentWorkspace } from "../../hooks/useStudentWorkspace";
import {
  Award,
  BookOpen,
  Calendar,
  Clock,
  FileText,
  ArrowRight,
  FileEdit,
  Send,
} from "lucide-react";

function formatAssignmentDeadline(assignment = {}) {
  const rawDeadline = String(
    assignment.dueDate ||
      assignment.deadline ||
      assignment.dueAt ||
      assignment.dueDateTime ||
      ""
  ).trim();

  if (!rawDeadline) {
    return {
      dateLabel: "End of Term",
      timeLabel: "",
      hasDeadline: false,
    };
  }

  /*
   * Parse date and time components directly first. This avoids accidental
   * timezone shifts for values such as "2026-07-23T23:59".
   */
  const localMatch = rawDeadline.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/
  );

  let dateValue = null;
  let hour = null;
  let minute = null;

  if (localMatch) {
    const [, year, month, day, matchedHour, matchedMinute] =
      localMatch;

    dateValue = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    if (
      matchedHour !== undefined &&
      matchedMinute !== undefined
    ) {
      hour = Number(matchedHour);
      minute = Number(matchedMinute);
    }
  } else {
    const parsed = new Date(rawDeadline);

    if (!Number.isNaN(parsed.getTime())) {
      dateValue = parsed;
      hour = parsed.getHours();
      minute = parsed.getMinutes();
    }
  }

  if (!dateValue || Number.isNaN(dateValue.getTime())) {
    return {
      dateLabel: rawDeadline,
      timeLabel: "",
      hasDeadline: true,
    };
  }

  const dateLabel = new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(dateValue);

  let timeLabel = "";

  if (hour !== null && minute !== null) {
    const timeValue = new Date(2000, 0, 1, hour, minute);

    timeLabel = new Intl.DateTimeFormat(
      undefined,
      {
        hour: "numeric",
        minute: "2-digit",
      }
    ).format(timeValue);
  }

  return {
    dateLabel,
    timeLabel,
    hasDeadline: true,
  };
}

export default function AssignmentTray() {
  const {
    assignments = [],
    classes = [],
    submissions = [],
    currentClassId = "__all__",
    openStudentAssignment,
    openingAssignmentId,
  } = useStudentWorkspace();
  const [activeFilter, setActiveFilter] = useState("todo");

  function getCourseName(assignment = {}) {
    const matchedCourse = classes.find(
      (course) => String(course?.id) === String(assignment.classId)
    );
    const rawName = String(
      matchedCourse?.name ||
        matchedCourse?.courseName ||
        assignment.className ||
        assignment.courseName ||
        "Course"
    ).trim();
    const courseCode = String(
      matchedCourse?.code || assignment.classCode || assignment.courseCode || ""
    )
      .trim()
      .toUpperCase();
    const nameParts = rawName.split(":");

    if (
      nameParts.length > 1 &&
      nameParts[0].trim().toUpperCase() === courseCode
    ) {
      return nameParts.slice(1).join(":").trim() || rawName;
    }

    return rawName;
  }

  const filteredAssignments = assignments.filter((assignment) => {
    if (currentClassId === "__all__") return true;
    return String(assignment.classId) === String(currentClassId);
  });

  function getSubmission(assignmentId) {
    return (
      submissions
        .filter(
          (submission) =>
            String(submission.assignmentId) === String(assignmentId) &&
            submission.isCurrent !== false
        )
        .sort((a, b) => {
          const aTime = new Date(
            a.reopenedAt ||
              a.resubmittedAt ||
              a.submittedAt ||
              a.updatedAt ||
              a.createdAt ||
              0
          ).getTime();

          const bTime = new Date(
            b.reopenedAt ||
              b.resubmittedAt ||
              b.submittedAt ||
              b.updatedAt ||
              b.createdAt ||
              0
          ).getTime();

          return bTime - aTime;
        })[0] || null
    );
  }

  function getStatusConfig(rawStatus) {
    const status = String(rawStatus || "todo").toLowerCase();

    if (status === "graded") {
      return {
        label: "Graded",
        icon: Award,
        className: "bg-blue-50 text-blue-700 border border-blue-200",
        buttonText: "Review feedback",
      };
    }

    if (status === "submitted") {
      return {
        label: "Submitted",
        icon: Send,
        className: "bg-indigo-50 text-indigo-700 border border-indigo-200",
        buttonText: "View submission",
      };
    }

    if (status === "reopened") {
      return {
        label: "Revision requested",
        icon: FileEdit,
        className: "bg-sky-50 text-sky-700 border border-sky-200",
        buttonText: "Revise and resubmit",
      };
    }

    if (status === "late") {
      return {
        label: "Submitted late",
        icon: Clock,
        className: "bg-amber-50 text-amber-700 border border-amber-200",
        buttonText: "View submission",
      };
    }

    if (status === "missing") {
      return {
        label: "Past due",
        icon: FileEdit,
        className: "bg-red-50 text-red-700 border border-red-200",
        buttonText: "Start assignment",
      };
    }

    if (status === "draft") {
      return {
        label: "Draft",
        icon: FileEdit,
        className: "bg-slate-50 text-slate-600 border border-slate-200",
        buttonText: "Continue assignment",
      };
    }

    return {
        label: "Not started",
      icon: BookOpen,
      className: "bg-slate-50 text-slate-600 border border-slate-200",
      buttonText: "Open assignment",
    };
  }

  function getAssignmentState(assignment) {
    const submission = getSubmission(assignment.id);
    const status = String(submission?.status || "todo").toLowerCase();
    if (status === "graded") return "graded";
    if (status === "submitted" || status === "late") return "submitted";
    return "todo";
  }

  const filterCounts = useMemo(
    () =>
      filteredAssignments.reduce(
        (counts, assignment) => {
          const state = getAssignmentState(assignment);
          counts[state] += 1;
          counts.all += 1;
          return counts;
        },
        { todo: 0, submitted: 0, graded: 0, all: 0 }
      ),
    [filteredAssignments, submissions]
  );

  const displayedAssignments = useMemo(
    () =>
      filteredAssignments
        .filter(
          (assignment) =>
            activeFilter === "all" ||
            getAssignmentState(assignment) === activeFilter
        )
        .sort((a, b) => {
          const aDue = new Date(a.dueDate || a.deadline || 8640000000000000).getTime();
          const bDue = new Date(b.dueDate || b.deadline || 8640000000000000).getTime();
          return aDue - bDue;
        }),
    [activeFilter, filteredAssignments, submissions]
  );

  const filters = [
    {
      id: "todo",
      label: "To do",
      description: "Continue assignments that still need your attention.",
    },
    {
      id: "submitted",
      label: "Submitted",
      description: "Track work waiting for instructor feedback.",
    },
    {
      id: "graded",
      label: "Graded",
      description: "Review your grades and instructor feedback.",
    },
    {
      id: "all",
      label: "All",
      description: "View every assignment across your courses.",
    },
  ];

  const activeFilterDescription =
    filters.find((filter) => filter.id === activeFilter)?.description ||
    "Continue unfinished work or review completed assignments.";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Your assignments
          </h2>
          <p
            className="mt-1 text-xs font-medium text-slate-500"
            aria-live="polite"
          >
            {activeFilterDescription}
          </p>
        </div>

        <div
          className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
          aria-label="Filter assignments by status"
        >
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              aria-pressed={activeFilter === filter.id}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                activeFilter === filter.id
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {filter.label}
              <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[9px] ${
                activeFilter === filter.id
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}>
                {filterCounts[filter.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {filteredAssignments.length === 0 ? (
        <div className="col-span-full border border-dashed border-slate-300 rounded-2xl p-12 text-center text-xs font-mono text-slate-400 uppercase tracking-widest bg-[#F8FAFC]/70">
          No assignments found for this course.
        </div>
      ) : displayedAssignments.length === 0 ? (
        <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">Nothing here right now</p>
          <p className="mt-1 text-xs text-slate-500">Choose another tab to view your other assignments.</p>
        </div>
      ) : (
        displayedAssignments.map((assignment) => {
          const submission = getSubmission(assignment.id);
          const status = String(submission?.status || "todo").toLowerCase();
          const statusConfig = getStatusConfig(status);
          const StatusIcon = statusConfig.icon;
          const deadline =
            formatAssignmentDeadline(assignment);
          const gradeMaximum =
            submission?.rubricTotal ||
            assignment?.rubricTotal ||
            assignment?.rubricSchema?.totalPoints ||
            assignment?.gradeScale ||
            null;

          return (
            <div
              key={assignment.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-md hover:shadow-blue-100/50"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="max-w-[48%] truncate rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    {getCourseName(assignment)}
                  </span>

                  {status === "graded" ? (
                    <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      <Award className="h-3 w-3 shrink-0" />
                      <span>Graded:</span>
                      <span className="font-mono font-black">
                        {submission.score ?? "N/A"}
                        {gradeMaximum !== null && (
                          <span className="ml-0.5 text-slate-500">/{gradeMaximum}</span>
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className={`inline-flex min-w-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusConfig.className}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig.label}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">
                    {assignment.title}
                  </h3>
                  <p className="line-clamp-1 text-xs text-slate-500">
                    {assignment.description || assignment.prompt}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-slate-500">
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    {assignment.wordCountMin || assignment.minWords || 0}+ words
                  </span>

                  <div className="min-w-0 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="w-3.5 h-3.5 text-blue-400" />
                        {deadline.dateLabel}
                      </span>

                      {deadline.timeLabel && (
                        <>
                          <span
                            aria-hidden="true"
                            className="hidden text-slate-300 sm:inline"
                          >
                            •
                          </span>

                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            {deadline.timeLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    // Start downloading the workflow while the first durable
                    // submission record is created. Navigation happens only
                    // when both the assignment data and UI are ready.
                    const workspaceReady = import("./ActiveAssignmentWorkflow.jsx");
                    void openStudentAssignment(assignment.id, {
                      workspaceReady,
                    });
                  }}
                  onPointerEnter={() => {
                    void import("./ActiveAssignmentWorkflow.jsx");
                  }}
                  onFocus={() => {
                    void import("./ActiveAssignmentWorkflow.jsx");
                  }}
                  disabled={Boolean(openingAssignmentId)}
                  className="group flex w-full items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-all hover:border-blue-600 hover:bg-blue-600 hover:text-white"
                >
                  <span>
                    {String(openingAssignmentId) === String(assignment.id)
                      ? "Opening…"
                      : statusConfig.buttonText}
                  </span>
                  <ArrowRight className="w-4 h-4 text-blue-500 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>
          );
        })
      )}
      </div>
    </div>
  );
}

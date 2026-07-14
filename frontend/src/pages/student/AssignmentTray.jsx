import React from "react";
import { useStudentWorkspace } from "../../contexts/StudentWorkspaceContext";
import {
  Award,
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  FileEdit,
  Send,
} from "lucide-react";

export default function AssignmentTray() {
  const {
    assignments = [],
    submissions = [],
    currentClassId = "__all__",
    setSelectedAssignmentId,
    setStudentStep,
  } = useStudentWorkspace();

  const filteredAssignments = assignments.filter((assignment) => {
    if (currentClassId === "__all__") return true;
    return assignment.classId === currentClassId;
  });

  function getSubmission(assignmentId) {
    return (
      submissions
        .filter(
          (submission) =>
            String(submission.assignmentId) === String(assignmentId)
        )
        .sort((a, b) => {
          const aTime = new Date(
            a.resubmittedAt || a.submittedAt || a.createdAt || 0
          ).getTime();

          const bTime = new Date(
            b.resubmittedAt || b.submittedAt || b.createdAt || 0
          ).getTime();

          return bTime - aTime;
        })[0] || null
    );
  }

  function getStatusConfig(status) {
    if (status === "graded") {
      return {
        label: "GRADED",
        icon: Award,
        className: "bg-blue-50 text-blue-700 border border-blue-200",
        buttonText: "View Grade & Feedback",
      };
    }

    if (status === "submitted") {
      return {
        label: "SUBMITTED",
        icon: Send,
        className: "bg-indigo-50 text-indigo-700 border border-indigo-200",
        buttonText: "View Submission",
      };
    }

    if (status === "reopened") {
      return {
        label: "REVISION REQUESTED",
        icon: FileEdit,
        className: "bg-sky-50 text-sky-700 border border-sky-200",
        buttonText: "Revise and Resubmit",
      };
    }

    if (status === "late") {
      return {
        label: "LATE",
        icon: Clock,
        className: "bg-amber-50 text-amber-700 border border-amber-200",
        buttonText: "Submit Late Assignment",
      };
    }

    if (status === "missing") {
      return {
        label: "MISSING",
        icon: FileEdit,
        className: "bg-red-50 text-red-700 border border-red-200",
        buttonText: "Submit Assignment",
      };
    }

    if (status === "draft") {
      return {
        label: "IN DRAFT",
        icon: FileEdit,
        className: "bg-slate-50 text-slate-600 border border-slate-200",
        buttonText: "Continue Assignment",
      };
    }

    return {
      label: "NOT STARTED",
      icon: BookOpen,
      className: "bg-slate-50 text-slate-600 border border-slate-200",
      buttonText: "Open Assignment",
    };
  }

  function openAssignment(assignment, status) {
    setSelectedAssignmentId(assignment.id);

    if (status === "submitted" || status === "graded") {
      setStudentStep(4);
      return;
    }

    if (
      status === "reopened" ||
      status === "late" ||
      status === "missing" ||
      status === "draft"
    ) {
      setStudentStep(2);
      return;
    }

    setStudentStep(1);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredAssignments.length === 0 ? (
        <div className="col-span-full border border-dashed border-slate-300 rounded-2xl p-12 text-center text-xs font-mono text-slate-400 uppercase tracking-widest bg-[#F8FAFC]/70">
          No assignments found for this course.
        </div>
      ) : (
        filteredAssignments.map((assignment) => {
          const submission = getSubmission(assignment.id);
          const status = submission?.status || "todo";
          const statusConfig = getStatusConfig(status);
          const StatusIcon = statusConfig.icon;

          return (
            <div
              key={assignment.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-lg hover:shadow-blue-100/60 hover:border-blue-200"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-mono font-bold text-blue-700 uppercase tracking-wider bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                    {assignment.classCode ||
                      assignment.courseCode ||
                      "AUI ACADEMY"}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${statusConfig.className}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig.label}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-serif text-base font-black text-slate-900 line-clamp-1">
                    {assignment.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {assignment.description || assignment.prompt}
                  </p>
                </div>

                <div className="pt-2 grid grid-cols-2 gap-2 text-[11px] font-mono font-medium text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    {assignment.wordCountMin || assignment.minWords || 0}+ words
                  </span>

                  <span className="flex items-center gap-1 justify-end">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    {assignment.dueDate || "End of Term"}
                  </span>
                </div>

                {status === "graded" && (
                  <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-[11px] font-bold text-blue-700">
                      Score: {submission.score ?? "N/A"}
                    </p>

                    {submission.feedback && (
                      <p className="text-[11px] text-blue-800 mt-1 line-clamp-2">
                        {submission.feedback}
                      </p>
                    )}
                  </div>
                )}

                {status === "submitted" && (
                  <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                    <p className="text-[11px] font-bold text-indigo-700">
                      Submitted — awaiting professor review.
                    </p>
                  </div>
                )}

                {status === "reopened" && (
                  <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
                    <p className="text-[11px] font-bold text-sky-700">
                      Your teacher requested a revision. You can edit and
                      resubmit this assignment.
                    </p>
                  </div>
                )}

                {status === "late" && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[11px] font-bold text-amber-700">
                      This assignment has been marked late. You can still submit
                      it if allowed by your teacher.
                    </p>
                  </div>
                )}

                {status === "missing" && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-[11px] font-bold text-red-700">
                      This assignment has been marked missing. Submit your work
                      as soon as possible.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-5 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => openAssignment(assignment, status)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all group cursor-pointer"
                >
                  <span>{statusConfig.buttonText}</span>

                  <ArrowRight className="w-4 h-4 text-blue-500 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
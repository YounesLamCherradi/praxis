import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  CheckCircle2,
  Eye,
  FileText,
  Filter,
  Layers,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";

import CreateAssignmentModal from "../../components/teacher/CreateAssignmentModal";
import { useTeacherWorkspace } from "../../contexts/TeacherWorkspaceContext";
import TeacherAssignmentDetails from "./TeacherAssignmentDetails";

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

function getStatusStyles(status) {
  if (status === "Published") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-slate-50 text-slate-600 border-slate-200";
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

function getAssignmentSubmissionsCount(assignment, submissions) {
  return submissions.filter(
    (submission) => String(submission.assignmentId) === String(assignment.id)
  ).length;
}

function getDueDateLabel(assignment) {
  return (
    assignment.dueDate ||
    assignment.deadline ||
    assignment.endDate ||
    "No due date"
  );
}

export default function TeacherAssignments({ onOpenSubmissions }) {
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

  const [selectedClassId, setSelectedClassId] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const selectedClass = useMemo(() => {
    if (selectedClassId === "__all__") return null;

    return (
      classes.find((cls) => String(cls.id) === String(selectedClassId)) || null
    );
  }, [classes, selectedClassId]);

  const filteredAssignments = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const status = normalizeAssignmentStatus(assignment);

      const matchesClass =
        !selectedClass || assignmentMatchesClass(assignment, selectedClass);

      const matchesStatus = statusFilter === "All" || status === statusFilter;

      const matchesSearch =
        !cleanSearch ||
        assignment.title?.toLowerCase().includes(cleanSearch) ||
        assignment.description?.toLowerCase().includes(cleanSearch) ||
        assignment.classCode?.toLowerCase().includes(cleanSearch) ||
        assignment.className?.toLowerCase().includes(cleanSearch);

      return matchesClass && matchesStatus && matchesSearch;
    });
  }, [assignments, selectedClass, statusFilter, searchTerm]);

  const assignmentStats = useMemo(() => {
    const baseAssignments = selectedClass
      ? assignments.filter((assignment) =>
          assignmentMatchesClass(assignment, selectedClass)
        )
      : assignments;

    const published = baseAssignments.filter(
      (assignment) => normalizeAssignmentStatus(assignment) === "Published"
    ).length;

    const draft = baseAssignments.filter(
      (assignment) => normalizeAssignmentStatus(assignment) === "Draft"
    ).length;

    const totalSubmissions = baseAssignments.reduce(
      (sum, assignment) =>
        sum + getAssignmentSubmissionsCount(assignment, submissions),
      0
    );

    return {
      total: baseAssignments.length,
      published,
      draft,
      totalSubmissions,
    };
  }, [assignments, selectedClass, submissions]);

  if (view === "create") {
    return (
      <CreateAssignmentModal
        classes={classes}
        onCreate={addAssignment}
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
        onUpdate={(updatedAssignment) => {
          updateAssignment(updatedAssignment);
          setSelectedAssignment(updatedAssignment);
        }}
        onClose={() => {
          setSelectedAssignment(null);
          setView("list");
        }}
      />
    );
  }

  return (
    <>
      <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60 transition-all">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded mb-2">
              <Layers className="w-3 h-3" />
              Assignment Workspace
            </div>

            <h2 className="font-serif text-xl font-bold text-slate-950">
              Assignment Management
            </h2>

            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Choose a course, filter assignments, and manage publishing,
              editing, and submissions from one organized workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setView("create")}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all self-start xl:self-center shadow-sm shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Create Assignment
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Course / Class
            </span>

            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
            >
              <option value="__all__">All Courses</option>

              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.code ? `${cls.code} — ${cls.name}` : cls.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Assignment Status
            </span>

            <div className="relative">
              <Filter className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-800 text-xs font-bold rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              >
                <option value="All">All Statuses</option>
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Search
            </span>

            <div className="relative">
              <Search className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search assignment..."
                className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Assignments"
            value={assignmentStats.total}
            tone="slate"
          />

          <StatCard
            label="Published"
            value={assignmentStats.published}
            tone="blue"
          />

          <StatCard
            label="Draft"
            value={assignmentStats.draft}
            tone="slate"
          />

          <StatCard
            label="Submissions"
            value={assignmentStats.totalSubmissions}
            tone="indigo"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />

            <h3 className="font-serif text-lg font-bold text-slate-950">
              Assignment List
            </h3>
          </div>

          <p className="text-xs text-slate-400 mt-1">
            {selectedClass
              ? `Showing assignments for ${
                  selectedClass.code || selectedClass.name
                }.`
              : "Showing assignments across all courses."}
          </p>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-3">
              <FileText className="w-7 h-7 text-blue-500" />
            </div>

            <h3 className="font-serif text-lg font-bold text-slate-900">
              No assignments found
            </h3>

            <p className="text-sm text-slate-400 mt-1">
              Try changing the course, status filter, or search term.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            <div className="hidden lg:grid grid-cols-[1.5fr_0.9fr_0.8fr_0.8fr_0.8fr_1.3fr] gap-4 px-5 py-3 bg-[#F8FAFC] text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              <span>Assignment</span>
              <span>Course</span>
              <span>Status</span>
              <span>Due Date</span>
              <span>Submissions</span>
              <span className="text-right">Actions</span>
            </div>

            {filteredAssignments.map((assignment) => {
              const status = normalizeAssignmentStatus(assignment);

              const submissionsCount = getAssignmentSubmissionsCount(
                assignment,
                submissions
              );

              return (
                <div
                  key={assignment.id}
                  className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.9fr_0.8fr_0.8fr_0.8fr_1.3fr] gap-3 lg:gap-4 px-5 py-4 items-center hover:bg-[#F8FAFC]/80 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {assignment.title || "Untitled Assignment"}
                    </p>

                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                      {assignment.description ||
                        "No assignment description provided."}
                    </p>
                  </div>

                  <div className="text-xs text-slate-500">
                    <p className="font-bold text-slate-700">
                      {assignment.classCode || "No code"}
                    </p>

                    <p className="text-[11px] text-slate-400 truncate">
                      {assignment.className || "No course name"}
                    </p>
                  </div>

                  <div>
                    <span
                      className={`inline-flex text-[9px] font-mono font-bold uppercase border px-2 py-1 rounded ${getStatusStyles(
                        status
                      )}`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    {getDueDateLabel(assignment)}
                  </div>

                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    {submissionsCount}
                  </div>

                  <div className="flex flex-wrap lg:justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssignment(assignment);
                        setView("details");
                      }}
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssignment(assignment);
                        setView("edit");
                      }}
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleAssignmentStatus(assignment.id)}
                      className={`inline-flex items-center gap-1.5 border text-xs font-bold px-3 py-2 rounded-xl transition-all ${
                        status === "Published"
                          ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-blue-200 hover:text-blue-700"
                          : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {status === "Published" ? "Unpublish" : "Publish"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSubmissionFilterAssignment(assignment);
                        onOpenSubmissions();
                      }}
                      className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-indigo-100 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submissions
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Are you sure you want to delete this assignment?"
                          )
                        ) {
                          deleteAssignment(assignment.id);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-red-100 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {view === "details" &&
        selectedAssignment &&
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

function StatCard({ label, value, tone = "slate" }) {
  const styles = {
    blue: {
      card: "border-blue-200 bg-blue-50",
      label: "text-blue-600",
      value: "text-blue-700",
    },
    indigo: {
      card: "border-indigo-200 bg-indigo-50",
      label: "text-indigo-500",
      value: "text-indigo-700",
    },
    slate: {
      card: "border-slate-200 bg-[#F8FAFC]",
      label: "text-slate-500",
      value: "text-slate-800",
    },
  };

  const selected = styles[tone] || styles.slate;

  return (
    <div className={`rounded-xl border p-3 ${selected.card}`}>
      <p
        className={`text-[10px] font-mono font-bold uppercase tracking-wider ${selected.label}`}
      >
        {label}
      </p>

      <p className={`text-lg font-serif font-bold ${selected.value}`}>
        {value}
      </p>
    </div>
  );
}
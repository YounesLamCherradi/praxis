import React from "react";
import {
  Calendar,
  Users,
  Clock,
  FileText,
  Trash2,
  Send,
  EyeOff,
  Pencil,
  Eye,
} from "lucide-react";

function getCriteriaCount(assignment = {}) {
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

  const criteriaCount = getCriteriaCount(assignment);

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
      criteriaCount > 0
  );
}

export default function AssignmentCard({
  assignment,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
  onOpenSubmissions,
}) {
  const normalizedStatus = String(assignment.status || "Draft").toLowerCase();
  const isPublished = normalizedStatus === "published";
  const isDraft = normalizedStatus === "draft" || !isPublished;
  const isComplete = isAssignmentComplete(assignment);
  const isLockedDraft = isDraft && !isComplete;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 transition-all duration-300 hover:-translate-y-1 glow-box-classes flex flex-col justify-between space-y-5">
      
      {/* ─── CARD UPPER HEADER FIELD METADATA ─── */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1 max-w-[80%]">
          <h3 className="font-serif text-lg font-bold text-slate-900 tracking-tight">
            {assignment.title}
          </h3>

          <p className="text-xs text-slate-400 font-medium leading-relaxed font-sans line-clamp-2">
            {assignment.description || "No assignment description provided."}
          </p>
        </div>

        <span
          className={`text-[9px] font-mono border px-2.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 self-start ${
            isPublished
              ? "bg-emerald-500/10 text-[#00A376] border-[#00A376]/20"
              : "bg-orange-500/10 text-[#C2592A] border-orange-500/20 status-pulse"
          }`}
        >
          {isPublished ? "PUBLISHED" : "DRAFT - CONTINUE WORKING"}
        </span>
      </div>

      {/* ─── RUNTIME TELEMETRY SYSTEM CORE INFO CARD GRID ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        
        {/* Core Route Box */}
        <div className="rounded-xl bg-[#FBF9F6] border border-slate-200/60 p-3 flex items-start gap-2.5 shadow-inner">
          <div className="w-7 h-7 rounded-lg bg-orange-500/5 text-[#C2592A] border border-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <Users className="w-3.5 h-3.5 stroke-[1.8]" />
          </div>
          <div className="min-w-0">
            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
              Course
            </span>
            <p className="font-mono text-[11px] font-bold text-slate-700 truncate">
              {assignment.classCode || "000"} · {assignment.className || "Global"}
            </p>
          </div>
        </div>

        {/* Expiration Lock Box */}
        <div className="rounded-xl bg-[#FBF9F6] border border-slate-200/60 p-3 flex items-start gap-2.5 shadow-inner">
          <div className="w-7 h-7 rounded-lg bg-orange-500/5 text-[#C2592A] border border-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <Calendar className="w-3.5 h-3.5 stroke-[1.8]" />
          </div>
          <div className="min-w-0">
            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
              Due Date
            </span>
            <p className="font-mono text-[11px] font-bold text-slate-700 truncate">
              {assignment.dueDate ? `Due ${assignment.dueDate}` : "No due date set"}
            </p>
          </div>
        </div>

        {/* Runtime Context State */}
        <div className="rounded-xl bg-[#FBF9F6] border border-slate-200/60 p-3 flex items-start gap-2.5 shadow-inner">
          <div className="w-7 h-7 rounded-lg bg-orange-500/5 text-[#C2592A] border border-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="w-3.5 h-3.5 stroke-[1.8]" />
          </div>
          <div className="min-w-0">
            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
              Assignment Status
            </span>
            <p className="font-mono text-[11px] font-bold text-slate-700 uppercase tracking-wide truncate">
              {assignment.status || "Draft"}
            </p>
          </div>
        </div>

      </div>

      {/* ─── TERMINAL COMMAND ACTION BUTTON TRACK ─── */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2 font-mono text-[11px]">
        
        {/* Inspection Action */}
        <button
          onClick={onView}
          disabled={isLockedDraft}
          title={isLockedDraft ? "Complete assignment setup first, then Details will unlock." : "View details"}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm ${
            isLockedDraft
              ? "cursor-not-allowed bg-slate-200 text-slate-500"
              : "cursor-pointer bg-[#0B1320] text-white hover:bg-slate-800 hover:scale-[1.01]"
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View Details</span>
        </button>

        {/* Modify Node */}
        <button
          onClick={onEdit}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-[#FBF9F6] text-slate-700 font-bold hover:bg-white hover:border-slate-300 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5 text-slate-400" />
          <span>{isDraft ? "Continue" : "Edit"}</span>
        </button>

        {/* Stream Toggle Status Action */}
        <button
          onClick={onToggleStatus}
          disabled={isLockedDraft}
          title={isLockedDraft ? "Complete assignment setup first, then Publish will unlock." : isPublished ? "Unpublish assignment" : "Publish assignment"}
          className={`px-3 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 shadow-sm ${
            isLockedDraft
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : isPublished
                ? "cursor-pointer border-orange-200/60 text-[#C2592A] bg-orange-50/10 hover:bg-orange-50 hover:border-orange-300"
                : "cursor-pointer border-emerald-200/60 text-[#00A376] bg-emerald-50/10 hover:bg-emerald-50 hover:border-emerald-300"
          }`}
        >
          {isPublished ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Unpublish</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Publish</span>
            </>
          )}
        </button>

        {isLockedDraft && (
          <span className="ml-1 text-[10px] font-bold text-slate-400">
            Finish all required fields to unlock Details and Publish.
          </span>
        )}

        {/* Submissions Channel Feed */}
        <button
          onClick={onOpenSubmissions}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-[#FBF9F6] text-slate-700 font-bold hover:bg-white hover:border-slate-300 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span>Submissions</span>
        </button>

        {/* Purge System Node */}
        <button
          onClick={onDelete}
          className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 bg-red-50/20 hover:bg-red-50 hover:border-red-300 font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ml-auto sm:ml-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>

      </div>

    </div>
  );
}